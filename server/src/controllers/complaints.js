import Complaint from '../models/Complaint.js';
import ComplaintHistory from '../models/ComplaintHistory.js';
import Department from '../models/Department.js';
import Feedback from '../models/Feedback.js';
import User from '../models/User.js';
import { ACTIVE_STATUSES, ASSIGNABLE_FROM, DEFAULT_SLA_HOURS, REOPENABLE_FROM, REOPEN_WINDOW_DAYS } from '../config/constants.js';
import { fileUrls } from '../middleware/upload.js';
import { createComplaint, toCitizenView, toPublicView, triageInBackground } from '../services/complaints.js';
import { findDuplicates } from '../services/duplicates.js';
import { allowedNext, applyTransition, canOfficerAct, notify, recordHistory, STATUS_LABEL } from '../services/workflow.js';
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
    .populate('departmentId', 'name code');
  if (!c) throw notFound('Complaint not found');
  if (user.role === 'citizen' && !isOwner(user, c)) throw notFound('Complaint not found');
  if (user.role === 'officer' && !canOfficerAct(user, { assignedTo: c.assignedTo?._id, departmentId: c.departmentId?._id })) throw forbidden();
  return c;
}

export async function create(req, res) {
  const input = createComplaintSchema.parse(req.body);
  const complaint = await createComplaint(input, req.user, fileUrls(req));
  triageInBackground(complaint._id);
  ok(res, toCitizenView(complaint), null, 201);
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
  for (const k of ['status', 'category', 'priority', 'ward', 'departmentId']) if (q[k]) filter[k] = q[k];
  if (q.from || q.to) filter.createdAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
  if (q.overdue === 'true') Object.assign(filter, { status: { $in: ACTIVE_STATUSES }, 'sla.dueAt': { $lt: new Date() } });
  if (q.q) filter.$or = [{ title: new RegExp(escapeRegex(q.q), 'i') }, { referenceId: new RegExp(escapeRegex(q.q), 'i') }];

  if (req.user.role === 'officer') {
    filter.$and = [{ $or: [{ assignedTo: req.user._id }, ...(req.user.departmentId ? [{ departmentId: req.user.departmentId }] : [])] }];
  }
  const query = Complaint.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  if (req.user.role !== 'citizen') query.populate('assignedTo', 'name').populate('departmentId', 'name code');
  const [items, total] = await Promise.all([query, Complaint.countDocuments(filter)]);
  // Citizens browsing the community list only get the public-safe subset.
  ok(res, req.user.role === 'citizen' ? items.map(toPublicView) : items, { page, limit, total });
}

export async function getOne(req, res) {
  const c = await loadForUser(req.params.id, req.user);
  const staff = req.user.role !== 'citizen';
  const [history, feedback] = await Promise.all([
    ComplaintHistory.find({ complaintId: c._id, ...(!staff && { internal: false }) }).sort({ createdAt: 1 }).populate('actorId', 'name role'),
    Feedback.findOne({ complaintId: c._id }),
  ]);
  const data = staff ? c.toObject() : toCitizenView(c);
  if (!staff) data.reportedBy = { name: c.reportedBy?.name };
  ok(res, {
    complaint: data,
    history,
    feedback,
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
  await applyTransition(c, body.to, req.user, { note: body.note, evidence: fileUrls(req) });
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
  const hours = dept.slaHours?.[c.priority] ?? DEFAULT_SLA_HOURS[c.priority];
  c.departmentId = dept._id;
  c.assignedTo = body.assignedTo;
  c.status = 'assigned';
  c.sla = { dueAt: body.dueAt || new Date(Date.now() + hours * 36e5) };
  await c.save();
  await recordHistory(c, req.user, 'assigned', {
    fromStatus: from, toStatus: 'assigned', note: body.note,
    metadata: { department: dept.name, assignedTo: body.assignedTo, dueAt: c.sla.dueAt, slaHours: body.dueAt ? 'custom' : hours },
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

// Live duplicate hints for the report form. Returns only public-safe fields.
export async function nearby(req, res) {
  const q = nearbySchema.parse(req.query);
  const dups = await findDuplicates({ lat: q.lat, lng: q.lng, text: q.text || '', category: q.category });
  ok(res, dups.map(({ complaintId, ...rest }) => ({ id: complaintId, ...rest })));
}
