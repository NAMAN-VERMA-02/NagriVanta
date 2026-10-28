import Complaint from '../models/Complaint.js';
import User from '../models/User.js';
import { ACTIVE_STATUSES } from '../config/constants.js';
import { retryPendingTriage } from '../services/complaints.js';
import { notify, recordHistory } from '../services/workflow.js';

// Marks newly overdue cases as escalated once, logs it, and alerts the assignee + admins.
export async function escalateOverdue(now = new Date()) {
  const overdue = await Complaint.find({ status: { $in: ACTIVE_STATUSES }, 'sla.dueAt': { $lt: now }, 'sla.escalatedAt': null }, '_id');
  if (!overdue.length) return 0;
  const admins = await User.find({ role: 'admin', isActive: true }, '_id');
  let escalated = 0;
  for (const { _id } of overdue) {
    // claim atomically, so two job runs at the same time never escalate a case twice
    const c = await Complaint.findOneAndUpdate({ _id, 'sla.escalatedAt': null }, { $set: { 'sla.escalatedAt': now } }, { returnDocument: 'after' });
    if (!c) continue;
    escalated += 1;
    await recordHistory(c, null, 'escalated', { note: `SLA due ${c.sla.dueAt.toISOString()} missed`, metadata: { dueAt: c.sla.dueAt } });
    await notify([c.assignedTo, ...admins.map((a) => a._id)], c, 'escalation', `Overdue: ${c.referenceId}`, c.title);
  }
  return escalated;
}

export function startSlaJob(minutes) {
  const run = () => Promise.all([escalateOverdue(), retryPendingTriage()]).catch((err) => console.error('scheduled job failed:', err.message));
  run();
  return setInterval(run, minutes * 60 * 1000).unref();
}
