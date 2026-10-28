import { randomBytes } from 'node:crypto';
import Complaint from '../models/Complaint.js';
import Upload from '../models/Upload.js';
import { cityOfWard, nearestCity } from '../config/constants.js';
import { keyOf } from '../middleware/upload.js';
import { triage } from './ai.js';
import { findDuplicates } from './duplicates.js';
import { autoRoute } from './routing.js';
import { ruleCategory, scorePriority } from './rules.js';
import { recordHistory } from './workflow.js';
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
    city: input.city || cityOfWard(input.ward) || nearestCity(lat, lng),
    location: { type: 'Point', coordinates: [lng, lat] },
    locationSource: input.lat != null ? (input.locationSource || 'map') : 'photo',
    address: input.address,
    ward: input.ward,
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

/** AI triage (text + first photo) then smart routing. Awaited by the request, so it also runs on serverless. */
export async function runTriage(complaintId) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) return null;
  const image = complaint.images?.[0] ? await Upload.findOne({ key: keyOf(complaint.images[0]) }, 'data contentType') : null;
  const analysis = await triage(complaint.title, complaint.description, image);
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

export async function processNewComplaint(id) {
  try {
    await runTriage(id);
    const c = await Complaint.findById(id);
    return await autoRoute(c);
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
  return stuck.length;
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
