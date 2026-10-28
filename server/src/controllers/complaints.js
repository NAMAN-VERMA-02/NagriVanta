import Complaint from '../models/Complaint.js';
import ComplaintHistory from '../models/ComplaintHistory.js';
import Department from '../models/Department.js';
import Feedback from '../models/Feedback.js';
import User from '../models/User.js';
import Vote from '../models/Vote.js';
import { ACTIVE_STATUSES, ASSIGNABLE_FROM, REOPENABLE_FROM, REOPEN_WINDOW_DAYS } from '../config/constants.js';
import { saveMedia } from '../middleware/upload.js';
import { createComplaint, processNewComplaint, toCitizenView, toPublicView } from '../services/complaints.js';
import { findDuplicates } from '../services/duplicates.js';
import { slaDueAt } from '../services/routing.js';
import { scorePriority } from '../services/rules.js';
import { aiVisualCheck, verifyEvidence } from '../services/verification.js';
import { background } from '../services/background.js';
import { env } from '../config/env.js';
import {
  allowedNext, applyTransition, assertTransition, canOfficerAct, notify, recordHistory, STATUS_LABEL, verifyHistoryChain,
} from '../services/workflow.js';
import { badRequest, conflict, forbidden, notFound, ok, paginate } from '../utils/http.js';
import {
  assignSchema, createComplaintSchema, feedbackSchema, listQuerySchema, nearbySchema, noteSchema, reopenSchema, reviewSchema, statusSchema,
} from '../validators/schemas.js';

const isOwner = (user, c) => String(c.reportedBy?._id || c.reportedBy) === String(user._id);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function loadForUser(id, user) {
  const c = await Complaint.findById(id)
    .populate('reportedBy', 'name email phone')
    .populate('assignedTo', 'name email')
    .populate('departmentId', 'name code city');
  if (!c) throw notFound('Complaint not found');
  if (user.role === 'citizen' && !isOwner(user, c)) throw notFound('Complaint not found');
  if (user.role === 'officer' && !canOfficerAct(user, { assignedTo: c.assignedTo?._id, departmentId: c.departmentId?._id })) throw forbidden();
  return c;
}

export async function create(req, res) {
  const input = createComplaintSchema.parse(req.body);
  const media = await saveMedia(req);
  if ((input.lat == null || input.lng == null) && media.exif?.lat == null) {
    throw badRequest('Location is required: share your location, pick it on the map, or attach a photo with GPS');
  }
  const complaint = await createComplaint(input, req.user, media);
  // awaited (not fire-and-forget) because serverless hosts may freeze the function after responding
  const processed = await processNewComplaint(complaint._id);
  ok(res, toCitizenView(processed), null, 201);
}

export async function mine(req, res) {
  const { page, limit, skip } = paginate(req.query);
  const filter = { reportedBy: req.user._id };
  const [items, total] = await Promise.all([
    Complaint.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Complaint.countDocuments(filter),
  ]);
  ok(res, items.map(toCitizenView), { page, limit, total });
}

export async function list(req, res) {
  const q = listQuerySchema.parse(req.query);
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  for (const k of ['status', 'category', 'priority', 'ward', 'departmentId', 'city']) if (q[k]) filter[k] = q[k];
  if (q.from || q.to) filter.createdAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  if (q.overdue === 'true') Object.assign(filter, { status: { $in: ACTIVE_STATUSES }, 'sla.dueAt': { $lt: new Date() } });
  if (q.q) filter.$or = [{ title: new RegExp(escapeRegex(q.q), 'i') }, { referenceId: new RegExp(escapeRegex(q.q), 'i') }];
  if (q.near) {
    const [lat, lng] = q.near.split(',').map(Number);
    filter.location = { $geoWithin: { $centerSphere: [[lng, lat], 3 / 6378.1] } }; // 3 km
  }
  if (req.user.role === 'officer') {
    filter.$and = [{ $or: [{ assignedTo: req.user._id }, ...(req.user.departmentId ? [{ departmentId: req.user.departmentId }] : [])] }];
  }
  const sort = q.sort === 'top' ? { upvotes: -1, createdAt: -1 } : { createdAt: -1 };
  const query = Complaint.find(filter).sort(sort).skip(skip).limit(limit);
  if (req.user.role !== 'citizen') query.populate('assignedTo', 'name').populate('departmentId', 'name code');
  const [items, total] = await Promise.all([query, Complaint.countDocuments(filter)]);
  if (req.user.role !== 'citizen') return ok(res, items, { page, limit, total });

  // Citizens browsing the community feed only get the public-safe subset, plus their own votes.
  const voted = new Set((await Vote.find({ userId: req.user._id, complaintId: { $in: items.map((i) => i._id) } }, 'complaintId')).map((v) => String(v.complaintId)));
  return ok(res, items.map((c) => ({ ...toPublicView(c), hasVoted: voted.has(String(c._id)), isMine: isOwner(req.user, c) })), { page, limit, total });
}

export async function getOne(req, res) {
  const c = await loadForUser(req.params.id, req.user);
  const staff = req.user.role !== 'citizen';
  const [history, feedback, integrity] = await Promise.all([
    ComplaintHistory.find({ complaintId: c._id, ...(!staff && { internal: false }) }).sort({ createdAt: 1, _id: 1 }).populate('actorId', 'name role'),
    Feedback.findOne({ complaintId: c._id }),
    verifyHistoryChain(c._id),
  ]);
  const data = staff ? c.toObject() : toCitizenView(c);
  if (!staff) data.reportedBy = { name: c.reportedBy?.name };
  ok(res, {
    complaint: data,
    history: history.map((h) => {
      const o = h.toObject();
      delete o.prevHash;
      return o;
    }),
    feedback,
    integrity: { intact: integrity.intact, entries: integrity.entries },
    allowedTransitions: allowedNext(c.status, req.user.role),
    canAssign: req.user.role === 'admin' && ASSIGNABLE_FROM.includes(c.status),
    canReopen: !staff && REOPENABLE_FROM.includes(c.status),
    canFeedback: !staff && c.status === 'resolved' && !feedback,
  });
}

// Admin confirms or corrects category / priority / ward. Records old -> new values.
export async function review(req, res) {
  const body = reviewSchema.parse(req.body);
  const c = await Complaint.findById(req.params.id);
  if (!c) throw notFound();
  const changes = {};
  if (body.category && body.category !== c.category) { changes.category = [c.category, body.category]; c.category = body.category; }
  if (body.ward && body.ward !== c.ward) { changes.ward = [c.ward, body.ward]; c.ward = body.ward; }
  if (body.priority) { if (body.priority !== c.priority) changes.priority = [c.priority, body.priority]; c.priority = body.priority; c.priorityConfirmed = true; }
  if (body.category) c.categorySource = 'staff';
  await c.save();
  await recordHistory(c, req.user, 'reviewed', { note: body.note, internal: true, metadata: { changes, aiSuggestion: { category: c.aiAnalysis?.category, priority: c.aiAnalysis?.priority } } });
  ok(res, c);
}

export async function changeStatus(req, res) {
  const body = statusSchema.parse(req.body);
  const c = await Complaint.findById(req.params.id);
  if (!c) throw notFound();
  // validate first, so a rejected request never leaves stored photos behind
  assertTransition(c, body.to, req.user, { note: body.note, evidenceCount: (req.files || []).length });
  const media = await saveMedia(req);
  const verification = body.to === 'resolved' ? await verifyEvidence(c, media) : undefined;
  await applyTransition(c, body.to, req.user, { note: body.note, evidence: media.images, evidenceSha256: media.sha256, verification });
  if (verification?.aiPending) {
    const job = aiVisualCheck(c._id); // Gemini photo comparison after the response
    if (env.isTest) await job; else background(job);
  }
  if (verification?.status === 'needs_review') {
    const admins = await User.find({ role: 'admin', isActive: true }, '_id');
    await notify(admins.map((a) => a._id), c, 'verification', `Check evidence for ${c.referenceId}`, verification.checks.filter((x) => x.ok === false).map((x) => x.name).join(', '));
  }
  ok(res, c);
}

export async function assign(req, res) {
  const body = assignSchema.parse(req.body);
  const c = await Complaint.findById(req.params.id);
  if (!c) throw notFound();
  if (!ASSIGNABLE_FROM.includes(c.status)) throw badRequest(`Cannot assign a case that is "${STATUS_LABEL[c.status]}"`);
  const dept = await Department.findOne({ _id: body.departmentId, isActive: true });
  if (!dept) throw badRequest('Unknown department');
  if (body.assignedTo) {
    const officer = await User.findOne({ _id: body.assignedTo, role: 'officer', isActive: true });
    if (!officer) throw badRequest('Assignee must be an active officer');
  }
  const from = c.status;
  c.departmentId = dept._id;
  c.assignedTo = body.assignedTo;
  c.status = 'assigned';
  c.sla = { dueAt: body.dueAt || slaDueAt(dept, c.priority) };
  c.routing = { ...c.routing?.toObject?.(), method: 'manual', reason: `Assigned by ${req.user.name}`, at: new Date() };
  await c.save();
  await recordHistory(c, req.user, 'assigned', {
    fromStatus: from, toStatus: 'assigned', note: body.note,
    metadata: { department: dept.name, assignedTo: body.assignedTo, dueAt: c.sla.dueAt, slaHours: body.dueAt ? 'custom' : dept.slaHours?.[c.priority] },
  });
  await notify([c.reportedBy], c, 'status', `${c.referenceId}: Assigned to ${dept.name}`, `Target date ${c.sla.dueAt.toDateString()}`);
  await notify([body.assignedTo], c, 'assigned', `New case ${c.referenceId}`, c.title);
  ok(res, c);
}

export async function addNote(req, res) {
  const body = noteSchema.parse(req.body);
  const c = await loadForUser(req.params.id, req.user);
  await recordHistory(c, req.user, 'note', { note: body.note, internal: body.internal });
  if (!body.internal) await notify([c.reportedBy?._id], c, 'note', `Update on ${c.referenceId}`, body.note);
  ok(res, { added: true }, null, 201);
}

export async function feedback(req, res) {
  const body = feedbackSchema.parse(req.body);
  const c = await Complaint.findById(req.params.id);
  if (!c || !isOwner(req.user, c)) throw notFound();
  if (c.status !== 'resolved') throw badRequest('Feedback is possible once the case is resolved');
  if (await Feedback.exists({ complaintId: c._id })) throw conflict('Feedback already submitted');
  const fb = await Feedback.create({ complaintId: c._id, citizenId: req.user._id, ...body });
  c.status = 'closed';
  await c.save();
  await recordHistory(c, req.user, 'feedback', { fromStatus: 'resolved', toStatus: 'closed', note: body.comment, metadata: { rating: body.rating } });
  ok(res, fb, null, 201);
}

export async function reopen(req, res) {
  const { reason } = reopenSchema.parse(req.body);
  const c = await Complaint.findById(req.params.id);
  if (!c || !isOwner(req.user, c)) throw notFound();
  if (!REOPENABLE_FROM.includes(c.status)) throw badRequest('Only resolved or closed cases can be reopened');
  const resolvedAt = c.resolution?.resolvedAt;
  if (resolvedAt && Date.now() - resolvedAt > REOPEN_WINDOW_DAYS * 864e5) throw badRequest(`Cases can be reopened within ${REOPEN_WINDOW_DAYS} days of resolution`);
  const from = c.status;
  c.status = 'reopened';
  c.reopenCount += 1;
  await c.save();
  await recordHistory(c, req.user, 'reopened', { fromStatus: from, toStatus: 'reopened', note: reason });
  const admins = await User.find({ role: 'admin', isActive: true }, '_id');
  await notify([c.assignedTo, ...admins.map((a) => a._id)], c, 'reopened', `${c.referenceId} reopened by citizen`, reason);
  ok(res, c);
}

// "Me too": one vote per citizen; votes raise the explainable priority score until staff confirm a priority.
export async function upvote(req, res) {
  const c = await Complaint.findById(req.params.id);
  if (!c) throw notFound();
  if (isOwner(req.user, c)) throw badRequest('You cannot upvote your own report');
  if (req.method === 'DELETE') {
    if ((await Vote.deleteOne({ complaintId: c._id, userId: req.user._id })).deletedCount) c.upvotes = Math.max(0, c.upvotes - 1);
  } else {
    try {
      await Vote.create({ complaintId: c._id, userId: req.user._id });
      c.upvotes += 1;
    } catch (err) {
      if (err.code !== 11000) throw err; // already voted: idempotent
    }
  }
  c.upvotes = await Vote.countDocuments({ complaintId: c._id }); // recount: exact under concurrent votes
  const score = scorePriority({ text: `${c.title} ${c.description}`, category: c.category, duplicateCount: c.duplicateCandidates?.length || 0, upvotes: c.upvotes });
  c.priorityScore = { total: score.total, factors: score.factors };
  if (!c.priorityConfirmed) c.priority = score.priority;
  await c.save();
  ok(res, { upvotes: c.upvotes, hasVoted: req.method !== 'DELETE', priority: c.priority });
}

export async function integrity(req, res) {
  const c = await loadForUser(req.params.id, req.user);
  ok(res, await verifyHistoryChain(c._id));
}

// Live duplicate hints for the report form. Returns only public-safe fields.
export async function nearby(req, res) {
  const q = nearbySchema.parse(req.query);
  const dups = await findDuplicates({ lat: q.lat, lng: q.lng, text: q.text || '', category: q.category });
  ok(res, dups.map(({ complaintId, ...rest }) => ({ id: complaintId, ...rest })));
}
