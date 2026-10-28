import { randomBytes } from 'node:crypto';
import Complaint from '../models/Complaint.js';
import { triage } from './ai.js';
import { findDuplicates } from './duplicates.js';
import { ruleCategory, scorePriority } from './rules.js';
import { recordHistory } from './workflow.js';
import { roundCoord } from '../utils/text.js';

export function newReferenceId(date = new Date()) {
  const d = date.toISOString().slice(2, 10).replace(/-/g, '');
  return `CIV-${d}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

// Persist first; AI runs afterwards and can never block or undo the save.
export async function createComplaint(input, user, images = []) {
  const text = `${input.title} ${input.description}`;
  const auto = input.category === 'auto';
  const category = auto ? ruleCategory(text).category : input.category;
  const duplicates = await findDuplicates({ lat: input.lat, lng: input.lng, text, category });
  const score = scorePriority({ text, category, duplicateCount: duplicates.length });

  const complaint = await Complaint.create({
    referenceId: newReferenceId(),
    title: input.title,
    description: input.description,
    category,
    categorySource: auto ? 'ai' : 'citizen',
    priority: score.priority,
    priorityScore: { total: score.total, factors: score.factors },
    location: { type: 'Point', coordinates: [input.lng, input.lat] },
    address: input.address,
    ward: input.ward,
    images,
    source: input.source || 'web',
    reportedBy: user._id,
    duplicateCandidates: duplicates,
  });
  await recordHistory(complaint, user, 'created', { toStatus: 'submitted' });
  return complaint;
}

export async function runTriage(complaintId) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) return null;
  const analysis = await triage(complaint.title, complaint.description);
  complaint.aiAnalysis = analysis;
  // Only fill the working category when the citizen asked for a suggestion and staff have not confirmed one.
  if (complaint.categorySource === 'ai' && analysis.status === 'done') complaint.category = analysis.category;
  await complaint.save();
  await recordHistory(complaint, null, 'ai_analysis', {
    internal: true,
    note: `${analysis.status}: suggested ${analysis.category} / ${analysis.priority}`,
    metadata: { model: analysis.model, latencyMs: analysis.latencyMs, error: analysis.error },
  });
  return complaint;
}

export function triageInBackground(id) {
  setImmediate(() => runTriage(id).catch((err) => console.error('triage failed', id, err.message)));
}

// Field-level views per audience.
export function toPublicView(c) {
  return {
    id: c._id,
    referenceId: c.referenceId,
    title: c.title,
    category: c.category,
    status: c.status,
    ward: c.ward,
    location: { lat: roundCoord(c.location.coordinates[1]), lng: roundCoord(c.location.coordinates[0]) },
    createdAt: c.createdAt,
  };
}

export function toCitizenView(c) {
  const o = c.toObject ? c.toObject() : c;
  delete o.duplicateCandidates;
  delete o.priorityScore;
  if (o.aiAnalysis) delete o.aiAnalysis.error;
  return o;
}
