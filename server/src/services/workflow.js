import { createHash } from 'node:crypto';
import ComplaintHistory from '../models/ComplaintHistory.js';
import Notification from '../models/Notification.js';
import { TRANSITIONS } from '../config/constants.js';
import { badRequest, forbidden } from '../utils/http.js';
import { emitEvent } from './webhook.js';

export const STATUS_LABEL = {
  submitted: 'Submitted', under_review: 'Under review', needs_info: 'Needs information', assigned: 'Assigned',
  in_progress: 'In progress', blocked: 'Blocked', resolved: 'Resolved', reopened: 'Reopened', rejected: 'Rejected', closed: 'Closed',
};

export function allowedNext(status, role) {
  return Object.entries(TRANSITIONS[status] || {}).filter(([, roles]) => roles.includes(role)).map(([to]) => to);
}

// Officers act only on cases assigned to them or their department.
export function canOfficerAct(user, complaint) {
  if (user.role !== 'officer') return true;
  return String(complaint.assignedTo) === String(user._id)
    || (user.departmentId && String(complaint.departmentId) === String(user.departmentId));
}

/**
 * Pure rule check, throws AppError. Kept separate from persistence so it is unit-testable,
 * and so callers can validate before storing any uploaded evidence.
 * `evidenceCount` is the number of NEW photos sent with this request.
 */
export function assertTransition(complaint, to, user, { note, evidenceCount = 0 } = {}) {
  const roles = TRANSITIONS[complaint.status]?.[to];
  if (!roles) throw badRequest(`Cannot move from "${STATUS_LABEL[complaint.status]}" to "${STATUS_LABEL[to] || to}"`);
  if (!roles.includes(user.role)) throw forbidden(`Your role cannot move a case to "${STATUS_LABEL[to]}"`);
  if (!canOfficerAct(user, complaint)) throw forbidden('This case is not assigned to you or your department');
  if (['rejected', 'blocked', 'needs_info'].includes(to) && !note) throw badRequest('A reason is required');
  if (to === 'resolved') {
    if (!note) throw badRequest('A resolution note is required');
    // every resolution needs fresh proof, including re-resolving a reopened case
    if (!evidenceCount) throw badRequest('At least one new after-photo is required to resolve');
  }
}

// Canonical form of an entry; the same function is used when writing and when verifying.
export function historyDigest(e, prevHash) {
  const canonical = JSON.stringify({
    complaintId: String(e.complaintId),
    actorId: e.actorId ? String(e.actorId._id || e.actorId) : null,
    actorRole: e.actorRole ?? null,
    action: e.action,
    fromStatus: e.fromStatus ?? null,
    toStatus: e.toStatus ?? null,
    note: e.note ?? null,
    internal: Boolean(e.internal),
    metadata: e.metadata ?? null,
    createdAt: new Date(e.createdAt).toISOString(),
  });
  return createHash('sha256').update(`${prevHash}|${canonical}`).digest('hex');
}

export async function recordHistory(complaint, user, action, extra = {}) {
  const last = await ComplaintHistory.findOne({ complaintId: complaint._id }).sort({ createdAt: -1, _id: -1 }).select('hash');
  const prevHash = last?.hash || 'GENESIS';
  const entry = await ComplaintHistory.create({
    complaintId: complaint._id, actorId: user?._id, actorRole: user?.role || 'system', action, ...extra, prevHash,
  });
  entry.hash = historyDigest(entry, prevHash);
  await entry.save();
  if (extra.toStatus) await emitEvent(action === 'created' ? 'complaint.created' : 'complaint.status_changed', complaint, { action, from: extra.fromStatus, to: extra.toStatus });
  return entry;
}

// Re-computes the hash chain; any edited, deleted or inserted entry breaks it.
export async function verifyHistoryChain(complaintId) {
  const entries = await ComplaintHistory.find({ complaintId }).sort({ createdAt: 1, _id: 1 }).lean();
  let prev = 'GENESIS';
  for (const [i, e] of entries.entries()) {
    if (!e.hash) return { intact: false, entries: entries.length, brokenAt: i, reason: 'Entry has no hash' };
    if (e.prevHash !== prev || historyDigest(e, prev) !== e.hash) return { intact: false, entries: entries.length, brokenAt: i, reason: 'Hash mismatch' };
    prev = e.hash;
  }
  return { intact: true, entries: entries.length, head: prev };
}

export async function notify(userIds, complaint, type, title, message) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return;
  await Notification.insertMany(ids.map((userId) => ({ userId, complaintId: complaint._id, type, title, message })));
}

export async function applyTransition(complaint, to, user, { note, evidence = [], evidenceSha256 = [], verification } = {}) {
  assertTransition(complaint, to, user, { note, evidenceCount: evidence.length });
  const from = complaint.status;
  complaint.status = to;
  if (to === 'resolved') {
    complaint.resolution = { note, evidence, resolvedAt: new Date(), resolvedBy: user._id, verification };
  }
  await complaint.save();
  await recordHistory(complaint, user, 'status_change', {
    fromStatus: from, toStatus: to, note,
    metadata: evidence.length ? { evidence, evidenceSha256, verification: verification?.status } : undefined,
  });
  await notify([complaint.reportedBy], complaint, 'status', `${complaint.referenceId}: ${STATUS_LABEL[to]}`, note);
  return complaint;
}
