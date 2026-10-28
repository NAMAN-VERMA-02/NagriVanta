import Complaint from '../models/Complaint.js';
import { ACTIVE_STATUSES, DUPLICATE_RADIUS_M, DUPLICATE_WINDOW_DAYS } from '../config/constants.js';
import { haversineM, textSimilarity } from '../utils/text.js';

// Pure scoring so it can be unit-tested without a DB.
export function scoreCandidate({ coords, text, category }, other) {
  const distanceM = Math.round(haversineM(coords, other.location.coordinates));
  const sim = textSimilarity(text, `${other.title} ${other.description}`);
  const sameCat = category && category !== 'auto' && category === other.category;
  const proximity = Math.max(0, 1 - distanceM / DUPLICATE_RADIUS_M);
  const score = +(0.5 * sim + 0.3 * proximity + 0.2 * (sameCat ? 1 : 0)).toFixed(3);
  const signals = [`${distanceM} m away`];
  if (sim >= 0.15) signals.push(`similar wording (${Math.round(sim * 100)}%)`);
  if (sameCat) signals.push('same category');
  return { score, distanceM, signals };
}

// Suggests possible duplicates. Never merges anything - staff decide.
export async function findDuplicates({ lat, lng, text, category, excludeId, limit = 5 }) {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 864e5);
  const near = await Complaint.find({
    location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: DUPLICATE_RADIUS_M } },
    status: { $in: [...ACTIVE_STATUSES, 'resolved'] },
    createdAt: { $gte: since },
    ...(excludeId && { _id: { $ne: excludeId } }),
  }).limit(30).select('referenceId title description category status location createdAt');

  return near
    .map((c) => ({ c, ...scoreCandidate({ coords: [lng, lat], text, category }, c) }))
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c, score, distanceM, signals }) => ({
      complaintId: c._id, referenceId: c.referenceId, title: c.title, category: c.category, status: c.status, score, distanceM, signals,
    }));
}
