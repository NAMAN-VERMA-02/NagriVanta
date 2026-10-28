// Seeds demo departments, users and complaints from ../data/civic_labelled_india.json (synthetic data).
// WARNING: wipes the CivicLens collections in the target database. Run: npm run seed
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDb } from '../src/config/db.js';
import Complaint from '../src/models/Complaint.js';
import ComplaintHistory from '../src/models/ComplaintHistory.js';
import Department from '../src/models/Department.js';
import Feedback from '../src/models/Feedback.js';
import Notification from '../src/models/Notification.js';
import Upload from '../src/models/Upload.js';
import User from '../src/models/User.js';
import { ruleTriage } from '../src/services/ai.js';
import { newReferenceId } from '../src/services/complaints.js';
import { scorePriority } from '../src/services/rules.js';

// Set SEED_PASSWORD in .env for any database other people can reach.
export const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'Demo@12345';

const DEPARTMENTS = [
  { code: 'PWD', name: 'Public Works (Roads)', categories: ['road'], description: 'Roads, potholes, footpaths' },
  { code: 'SAN', name: 'Sanitation', categories: ['garbage'], description: 'Waste collection and cleaning' },
  { code: 'JAL', name: 'Water Supply', categories: ['water'], description: 'Water pipelines and supply' },
  { code: 'ELE', name: 'Electrical (Streetlights)', categories: ['streetlight'], description: 'Street lighting' },
  { code: 'DRN', name: 'Drainage & Sewerage', categories: ['drainage', 'other'], description: 'Drains, sewers, waterlogging' },
];

// status by index: a realistic spread across the lifecycle
const FLOW = ['submitted', 'submitted', 'under_review', 'assigned', 'assigned', 'in_progress', 'resolved', 'resolved', 'closed', 'reopened'];

export async function seed({ log = console.log } = {}) {
  const data = JSON.parse(fs.readFileSync(new URL('../../data/civic_labelled_india.json', import.meta.url), 'utf8'));
  await Promise.all([Complaint, ComplaintHistory, Department, Feedback, Notification, Upload, User].map((m) => m.deleteMany({})));
  await Complaint.syncIndexes();

  const depts = await Department.insertMany(DEPARTMENTS);
  const deptFor = (cat) => depts.find((d) => d.categories.includes(cat));
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admin = await User.create({ name: 'Asha Admin', email: 'admin@civiclens.local', role: 'admin', passwordHash });
  const officers = await User.insertMany(depts.map((d) => ({
    name: `${d.code} Officer`, email: `${d.code.toLowerCase()}.officer@civiclens.local`, role: 'officer', departmentId: d._id, passwordHash,
  })));
  const citizens = await User.insertMany(['Ravi Kumar', 'Priya Sharma', 'Imran Khan'].map((name, i) => ({
    name, email: `citizen${i + 1}@civiclens.local`, role: 'citizen', passwordHash,
  })));

  const histories = [];
  const now = Date.now();
  for (const [i, item] of data.items.entries()) {
    const createdAt = new Date(now - item.daysAgo * 864e5 - (i % 12) * 36e5);
    const status = FLOW[i % FLOW.length];
    const citizen = citizens[i % citizens.length];
    const dept = deptFor(item.label.category);
    const officer = officers.find((o) => String(o.departmentId) === String(dept._id));
    const ai = ruleTriage(item.title, item.description);
    const score = scorePriority({ text: `${item.title} ${item.description}`, category: item.label.category });
    const assigned = !['submitted', 'under_review'].includes(status);
    const resolved = ['resolved', 'closed', 'reopened'].includes(status);
    const at = (h) => new Date(createdAt.getTime() + h * 36e5);
    // some open cases are deliberately overdue so the SLA views have data
    const dueAt = assigned ? at(i % 3 === 0 ? 24 : 24 * 6) : undefined;

    const c = await Complaint.create({
      referenceId: newReferenceId(createdAt),
      title: item.title,
      description: item.description,
      category: item.label.category,
      priority: item.label.priority,
      priorityConfirmed: assigned,
      status,
      location: { type: 'Point', coordinates: [item.location.lng, item.location.lat] },
      ward: item.ward,
      source: 'seed',
      reportedBy: citizen._id,
      departmentId: assigned ? dept._id : undefined,
      assignedTo: assigned ? officer._id : undefined,
      aiAnalysis: { ...ai, latencyMs: 1, analyzedAt: createdAt },
      priorityScore: { total: score.total, factors: score.factors },
      sla: dueAt ? { dueAt } : undefined,
      resolution: resolved ? { note: 'Work completed by field team (seeded demo record).', evidence: [], resolvedAt: at(20 + (i % 5) * 12), resolvedBy: officer._id } : undefined,
      reopenCount: status === 'reopened' ? 1 : 0,
    });
    await Complaint.collection.updateOne({ _id: c._id }, { $set: { createdAt } });

    const h = (hours, actor, action, extra) => histories.push({ complaintId: c._id, actorId: actor?._id, actorRole: actor?.role || 'system', action, internal: false, createdAt: at(hours), ...extra });
    h(0, citizen, 'created', { toStatus: 'submitted' });
    h(0.01, null, 'ai_analysis', { internal: true, note: `fallback: suggested ${ai.category} / ${ai.priority}` });
    if (status !== 'submitted') h(2, admin, 'status_change', { fromStatus: 'submitted', toStatus: 'under_review' });
    if (assigned) h(4, admin, 'assigned', { fromStatus: 'under_review', toStatus: 'assigned', metadata: { department: dept.name, dueAt } });
    if (['in_progress', 'resolved', 'closed', 'reopened'].includes(status)) h(8, officer, 'status_change', { fromStatus: 'assigned', toStatus: 'in_progress', note: 'Team dispatched' });
    if (resolved) h(20 + (i % 5) * 12, officer, 'status_change', { fromStatus: 'in_progress', toStatus: 'resolved', note: c.resolution.note });
    if (status === 'closed') {
      await Feedback.create({ complaintId: c._id, citizenId: citizen._id, rating: 3 + (i % 3), comment: 'Fixed, thank you.' });
      h(40 + (i % 5) * 12, citizen, 'feedback', { fromStatus: 'resolved', toStatus: 'closed', metadata: { rating: 3 + (i % 3) } });
    }
    if (status === 'reopened') h(40 + (i % 5) * 12, citizen, 'reopened', { fromStatus: 'resolved', toStatus: 'reopened', note: 'Problem is back after one rain.' });
  }
  await ComplaintHistory.collection.insertMany(histories);

  log(`Seeded ${depts.length} departments, ${1 + officers.length + citizens.length} users, ${data.items.length} complaints, ${histories.length} history events.`);
  log(`Demo logins (password ${process.env.SEED_PASSWORD ? 'from SEED_PASSWORD in .env' : DEMO_PASSWORD}): admin@civiclens.local, pwd.officer@civiclens.local, citizen1@civiclens.local`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await connectDb(env.mongoUri);
  await seed();
  await mongoose.disconnect();
}
