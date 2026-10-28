import ComplaintHistory from '../models/ComplaintHistory.js';
import Notification from '../models/Notification.js';
import { TRANSITIONS } from '../config/constants.js';
import { badRequest, forbidden } from '../utils/http.js';

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

// Pure rule check, throws AppError. Kept separate from persistence so it is unit-testable.
export function assertTransition(complaint, to, user, { note, evidence = [] } = {}) {
  const roles = TRANSITIONS[complaint.status]?.[to];
  if (!roles) throw badRequest(`Cannot move from "${STATUS_LABEL[complaint.status]}" to "${STATUS_LABEL[to] || to}"`);
  if (!roles.includes(user.role)) throw forbidden(`Your role cannot move a case to "${STATUS_LABEL[to]}"`);
  if (!canOfficerAct(user, complaint)) throw forbidden('This case is not assigned to you or your department');
  if (['rejected', 'blocked', 'needs_info'].includes(to) && !note) throw badRequest('A reason is required');
  if (to === 'resolved') {
    if (!note) throw badRequest('A resolution note is required');
    if (!evidence.length && !complaint.resolution?.evidence?.length) throw badRequest('At least one evidence photo is required to resolve');
  }
}

export async function recordHistory(complaint, user, action, extra = {}) {
  return ComplaintHistory.create({
    complaintId: complaint._id,
    actorId: user?._id,
    actorRole: user?.role || 'system',
    action,
    ...extra,
  });
}

export async function notify(userIds, complaint, type, title, message) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return;
  await Notification.insertMany(ids.map((userId) => ({ userId, complaintId: complaint._id, type, title, message })));
}

export async function applyTransition(complaint, to, user, { note, evidence = [] } = {}) {
  assertTransition(complaint, to, user, { note, evidence });
  const from = complaint.status;
  complaint.status = to;
  if (to === 'resolved') {
    complaint.resolution = {
      note,
      evidence: [...(complaint.resolution?.evidence || []), ...evidence],
      resolvedAt: new Date(),
      resolvedBy: user._id,
    };
  }
  await complaint.save();
  await recordHistory(complaint, user, 'status_change', { fromStatus: from, toStatus: to, note, metadata: evidence.length ? { evidence } : undefined });
  await notify([complaint.reportedBy], complaint, 'status', `${complaint.referenceId}: ${STATUS_LABEL[to]}`, note);
  return complaint;
}
