import { randomBytes } from 'node:crypto';
import Complaint from '../models/Complaint.js';
import Upload from '../models/Upload.js';
import User from '../models/User.js';
import { cityOfWard, inferWard, nearestCity } from '../config/constants.js';
import { keyOf } from '../middleware/upload.js';
import { env } from '../config/env.js';
import { aiEnabled, localTriage, triage } from './ai.js';
import { background } from './background.js';
import { findDuplicates } from './duplicates.js';
import { autoRoute } from './routing.js';
import { ruleCategory, scorePriority } from './rules.js';
import { notify, recordHistory } from './workflow.js';
import { roundCoord } from '../utils/text.js';

// 4 random bytes: ~4.3 billion ids per day, so collisions stay negligible at city scale.
export function newReferenceId(date = new Date()) {
  const d = date.toISOString().slice(2, 10).replace(/-/g, '');
  return `CIV-${d}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

const detectLanguage = (text) => {
  const deva = (text.match(/\p{Script=Devanagari}/gu) || []).length;
  if (!deva) return 'en';
  return deva / text.replace(/\s/g, '').length > 0.6 ? 'hi' : 'mixed';
};

// Persist first; AI and routing run afterwards and can never block or undo the save.
export async function createComplaint(input, user, media = {}) {
  const text = `${input.title} ${input.description}`;
  const auto = input.category === 'auto';
  const category = auto ? ruleCategory(text).category : input.category;
  // a photo's GPS is used only when the citizen gave no location of their own
  const lat = input.lat ?? media.exif?.lat;
  const lng = input.lng ?? media.exif?.lng;
  const hashes = media.hashes || [];
  const ward = input.ward || inferWard(lat, lng);
  const duplicates = await findDuplicates({ lat, lng, text, category, hashes });
  const score = scorePriority({ text, category, duplicateCount: duplicates.length });

  const complaint = await Complaint.create({
    referenceId: newReferenceId(),
    title: input.title,
    description: input.description,
    language: detectLanguage(text),
    category,
    categorySource: auto ? 'ai' : 'citizen',
    priority: score.priority,
    priorityScore: { total: score.total, factors: score.factors },
    city: input.city || cityOfWard(ward) || nearestCity(lat, lng),
    location: { type: 'Point', coordinates: [lng, lat] },
    locationSource: input.lat != null ? (input.locationSource || 'map') : 'photo',
    address: input.address,
    pincode: input.pincode,
    ward,
    images: media.images || [],
    videos: media.videos || [],
    imageHashes: hashes,
    media: media.exif ? { takenAt: media.exif.takenAt, gps: media.exif.lat != null ? { lat: media.exif.lat, lng: media.exif.lng } : undefined } : undefined,
    source: input.source || 'web',
    externalId: input.externalId,
    reportedBy: user._id,
    duplicateCandidates: duplicates,
  });
  await recordHistory(complaint, user, 'created', { toStatus: 'submitted', metadata: media.sha256?.length ? { mediaSha256: media.sha256 } : undefined });
  return complaint;
}

async function saveAnalysis(complaint, analysis) {
  complaint.aiAnalysis = analysis;
  // Only fill the working category when the citizen asked for a suggestion and staff have not confirmed one.
  if (complaint.categorySource === 'ai') complaint.category = analysis.category;
  await complaint.save();
  await recordHistory(complaint, null, 'ai_analysis', {
    internal: true,
    note: `${analysis.engine}: suggested ${analysis.category} / ${analysis.priority} (${Math.round((analysis.confidence ?? 0) * 100)}%)`,
    metadata: { model: analysis.model, latencyMs: analysis.latencyMs, usedImage: analysis.usedImage, error: analysis.error },
  });
  return complaint;
}

/**
 * Triage one complaint. `ai: false` uses only the in-process model (milliseconds);
 * otherwise Gemini (text + first photo) is tried first and the local model is the fallback.
 */
export async function runTriage(complaintId, { ai = true } = {}) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) return null;
  if (!ai) return saveAnalysis(complaint, { ...localTriage(complaint.title, complaint.description), latencyMs: 0, analyzedAt: new Date() });
  const image = complaint.images?.[0] ? await Upload.findOne({ key: keyOf(complaint.images[0]) }, 'data contentType') : null;
  return saveAnalysis(complaint, await triage(complaint.title, complaint.description, image));
}

/**
 * Background refinement with Gemini after the citizen already has their answer.
 * Keeps the local result when Gemini fails, re-routes a still-unassigned case when Gemini is
 * confident, and flags auto-routed cases where Gemini disagrees, so staff can correct them.
 */
export async function refineWithAi(id) {
  const c = await Complaint.findById(id);
  if (!c) return null;
  const before = c.category;
  const image = c.images?.[0] ? await Upload.findOne({ key: keyOf(c.images[0]) }, 'data contentType') : null;
  const started = Date.now();
  let analysis = await triage(c.title, c.description, image);
  // Gemini's 503 "high demand" spikes are usually short: one more try if there is time left
  if (analysis.status !== 'done' && /503|high demand|aborted|timeout/i.test(String(analysis.error)) && Date.now() - started < 20000 && !env.isTest) {
    await new Promise((r) => setTimeout(r, 4000));
    analysis = await triage(c.title, c.description, image);
  }
  if (analysis.status !== 'done') {
    await recordHistory(c, null, 'ai_analysis', { internal: true, note: `Gemini unavailable, kept offline result (${String(analysis.error || '').slice(0, 120)})` });
    return c;
  }
  if (c.status !== 'submitted' && c.categorySource === 'ai' && analysis.category !== before) {
    // already auto-routed on the offline result: keep it, but tell the admins Gemini disagrees
    c.aiAnalysis = analysis;
    await c.save();
    await recordHistory(c, null, 'ai_analysis', { internal: true, note: `Gemini suggests "${analysis.category}" but the case was routed as "${before}". Please review.` });
    const admins = await User.find({ role: 'admin', isActive: true }, '_id');
    await notify(admins.map((a) => a._id), c, 'ai_review', `AI disagrees on ${c.referenceId}`, `Gemini: ${analysis.category}, routed as ${before}`);
    return c;
  }
  await saveAnalysis(c, analysis);
  return c.status === 'submitted' ? autoRoute(c) : c;
}

/** Fast path for new reports: offline triage + routing now, Gemini refinement after the response. */
export async function processNewComplaint(id) {
  try {
    await runTriage(id, { ai: false });
    const routed = await autoRoute(await Complaint.findById(id));
    if (aiEnabled()) {
      const job = refineWithAi(id);
      if (env.isTest) await job; else background(job); // tests need a deterministic order
    }
    return routed;
  } catch (err) {
    // the complaint is already saved; staff can triage it by hand
    console.error('post-create processing failed', String(id), err.message);
    return Complaint.findById(id);
  }
}

// Safety net: re-run triage/routing for reports whose processing was interrupted (e.g. a crashed instance).
export async function retryPendingTriage() {
  const stuck = await Complaint.find({ 'aiAnalysis.status': 'pending', createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }, '_id').limit(50);
  for (const { _id } of stuck) await processNewComplaint(_id);
  // recent open cases that never got a Gemini answer (e.g. a 503 spike): try Gemini again
  let refined = 0;
  if (aiEnabled()) {
    const missed = await Complaint.find({
      'aiAnalysis.engine': { $ne: 'gemini' }, status: { $in: ['submitted', 'under_review', 'assigned', 'in_progress'] },
      createdAt: { $gte: new Date(Date.now() - 3 * 864e5) }, source: { $ne: 'seed' },
    }, '_id').limit(10);
    for (const { _id } of missed) { await refineWithAi(_id); refined += 1; }
  }
  return stuck.length + refined;
}

// Field-level views per audience.
export function toPublicView(c) {
  return {
    id: c._id,
    referenceId: c.referenceId,
    title: c.title,
    category: c.category,
    status: c.status,
    city: c.city,
    ward: c.ward,
    upvotes: c.upvotes || 0,
    image: c.images?.[0],
    location: { lat: roundCoord(c.location.coordinates[1]), lng: roundCoord(c.location.coordinates[0]) },
    createdAt: c.createdAt,
  };
}

export function toCitizenView(c) {
  const o = c.toObject ? c.toObject() : c;
  delete o.duplicateCandidates;
  delete o.priorityScore;
  delete o.imageHashes;
  delete o.routing;
  if (o.aiAnalysis) delete o.aiAnalysis.error;
  // staff contact details are not for citizens
  if (o.assignedTo && typeof o.assignedTo === 'object') o.assignedTo = { name: o.assignedTo.name };
  return o;
}
