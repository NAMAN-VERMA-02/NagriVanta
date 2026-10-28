import Complaint from '../models/Complaint.js';
import Department from '../models/Department.js';
import User from '../models/User.js';
import { ACTIVE_STATUSES, AUTO_ASSIGN_MIN_CONFIDENCE, DEFAULT_SLA_HOURS } from '../config/constants.js';
import { env } from '../config/env.js';
import { notify, recordHistory } from './workflow.js';

export const departmentFor = (city, category) => Department.findOne({ city, categories: category, isActive: true });

// Active case count per officer of a department (the workload used for balancing).
export async function officerWorkload(departmentId) {
  const officers = await User.find({ role: 'officer', departmentId, isActive: true }, 'name email').lean();
  const counts = await Complaint.aggregate([
    { $match: { assignedTo: { $in: officers.map((o) => o._id) }, status: { $in: ACTIVE_STATUSES } } },
    { $group: { _id: '$assignedTo', n: { $sum: 1 } } },
  ]);
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  return officers.map((o) => ({ ...o, activeCases: byId[String(o._id)] || 0 })).sort((a, b) => a.activeCases - b.activeCases);
}

export const slaDueAt = (dept, priority, from = Date.now()) => new Date(from + (dept.slaHours?.[priority] ?? DEFAULT_SLA_HOURS[priority]) * 36e5);

/**
 * Smart routing. Finds the department for the city + category and the least-loaded officer.
 * Assigns automatically only when the category is reliable (chosen by the citizen, or AI
 * confidence >= AUTO_ASSIGN_MIN_CONFIDENCE) and AUTO_ASSIGN is on; otherwise it only records
 * a suggestion for the triage queue. Staff can always reassign.
 */
export async function autoRoute(complaint) {
  const dept = await departmentFor(complaint.city, complaint.category);
  if (!dept) return complaint;
  const reliable = complaint.categorySource === 'citizen'
    || (complaint.aiAnalysis?.category === complaint.category && (complaint.aiAnalysis?.confidence ?? 0) >= AUTO_ASSIGN_MIN_CONFIDENCE);

  if (!env.autoAssign || !reliable || complaint.status !== 'submitted') {
    complaint.routing = { suggestedDepartmentId: dept._id, reason: reliable ? `Suggested: ${dept.name}` : `Low confidence in category; suggested ${dept.name}, needs review`, at: new Date() };
    await complaint.save();
    return complaint;
  }

  const [officer] = await officerWorkload(dept._id);
  complaint.departmentId = dept._id;
  complaint.assignedTo = officer?._id;
  complaint.status = 'assigned';
  complaint.sla = { dueAt: slaDueAt(dept, complaint.priority) };
  complaint.routing = {
    method: 'auto',
    suggestedDepartmentId: dept._id,
    reason: `${complaint.categorySource === 'citizen' ? 'Citizen-selected' : 'AI'} category "${complaint.category}" in ${complaint.city} → ${dept.name}${officer ? `; least-loaded officer (${officer.activeCases} active)` : ''}`,
    at: new Date(),
  };
  await complaint.save();
  await recordHistory(complaint, null, 'assigned', {
    fromStatus: 'submitted', toStatus: 'assigned', note: complaint.routing.reason,
    metadata: { department: dept.name, assignedTo: officer?._id, dueAt: complaint.sla.dueAt, auto: true },
  });
  await notify([complaint.reportedBy], complaint, 'status', `${complaint.referenceId}: Assigned to ${dept.name}`, `Target date ${complaint.sla.dueAt.toDateString()}`);
  await notify([officer?._id], complaint, 'assigned', `New case ${complaint.referenceId}`, complaint.title);
  return complaint;
}
