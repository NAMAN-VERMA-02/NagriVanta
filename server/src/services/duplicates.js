import Complaint from '../models/Complaint.js';
import { ACTIVE_STATUSES, DUPLICATE_RADIUS_M, DUPLICATE_WINDOW_DAYS } from '../config/constants.js';
import { hammingHex } from '../middleware/upload.js';
import { haversineM, textSimilarity } from '../utils/text.js';

/**
 * Pure multi-signal scoring (text + location + category + photo), testable without a DB.
 * The photo signal only counts when both reports have photos; weights are renormalised otherwise.
 */
export function scoreCandidate({ coords, text, category, hashes = [] }, other) {
  const distanceM = Math.round(haversineM(coords, other.location.coordinates));
  const sim = textSimilarity(text, `${other.title} ${other.description}`);
  const sameCat = Boolean(category && category !== 'auto' && category === other.category);
  const proximity = Math.max(0, 1 - distanceM / DUPLICATE_RADIUS_M);
  const otherHashes = other.imageHashes || [];
  const photoDist = hashes.length && otherHashes.length ? Math.min(...hashes.flatMap((a) => otherHashes.map((b) => hammingHex(a, b)))) : null;

  let weighted = 0.4 * sim + 0.25 * proximity + 0.15 * (sameCat ? 1 : 0);
  let total = 0.8;
  if (photoDist !== null) { weighted += 0.2 * Math.max(0, 1 - photoDist / 20); total += 0.2; }
  const score = +(weighted / total).toFixed(3);

  const signals = [`${distanceM} m away`];
  if (sim >= 0.15) signals.push(`similar wording (${Math.round(sim * 100)}%)`);
  if (sameCat) signals.push('same category');
  if (photoDist !== null && photoDist <= 10) signals.push(`similar photo (${64 - photoDist}/64 bits match)`);
  return { score, distanceM, signals };
}

// Suggests possible duplicates. Never merges anything - staff decide.
export async function findDuplicates({ lat, lng, text, category, hashes, excludeId, limit = 5 }) {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 864e5);
  const near = await Complaint.find({
    location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: DUPLICATE_RADIUS_M } },
    status: { $in: [...ACTIVE_STATUSES, 'resolved'] },
    createdAt: { $gte: since },
    ...(excludeId && { _id: { $ne: excludeId } }),
  }).limit(30).select('referenceId title description category status location imageHashes upvotes createdAt');

  return near
    .map((c) => ({ c, ...scoreCandidate({ coords: [lng, lat], text, category, hashes }, c) }))
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c, score, distanceM, signals }) => ({
      complaintId: c._id, referenceId: c.referenceId, title: c.title, category: c.category, status: c.status, upvotes: c.upvotes, score, distanceM, signals,
    }));
}
