import Complaint from '../models/Complaint.js';
import User from '../models/User.js';
import { ACTIVE_STATUSES } from '../config/constants.js';
import { notify, recordHistory } from '../services/workflow.js';

// Marks newly overdue cases as escalated once, logs it, and alerts the assignee + admins.
export async function escalateOverdue(now = new Date()) {
  const overdue = await Complaint.find({ status: { $in: ACTIVE_STATUSES }, 'sla.dueAt': { $lt: now }, 'sla.escalatedAt': null });
  if (!overdue.length) return 0;
  const admins = await User.find({ role: 'admin', isActive: true }, '_id');
  for (const c of overdue) {
    c.sla.escalatedAt = now;
    await c.save();
    await recordHistory(c, null, 'escalated', { note: `SLA due ${c.sla.dueAt.toISOString()} missed`, metadata: { dueAt: c.sla.dueAt } });
    await notify([c.assignedTo, ...admins.map((a) => a._id)], c, 'escalation', `Overdue: ${c.referenceId}`, c.title);
  }
  return overdue.length;
}

export function startSlaJob(minutes) {
  const run = () => escalateOverdue().catch((err) => console.error('SLA job failed:', err.message));
  run();
  return setInterval(run, minutes * 60 * 1000).unref();
}
