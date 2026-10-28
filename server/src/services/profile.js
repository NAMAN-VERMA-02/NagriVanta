import Complaint from '../models/Complaint.js';
import ComplaintHistory from '../models/ComplaintHistory.js';
import Feedback from '../models/Feedback.js';
import Vote from '../models/Vote.js';
import { ACTIVE_STATUSES } from '../config/constants.js';

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
};

// Civic points: transparent, published rules (shown on the profile page).
export const POINTS = { report: 10, reportWithPhoto: 5, resolved: 5, vote: 2, feedback: 3 };
export const LEVELS = [
  { name: 'Newcomer', min: 0 },
  { name: 'Active Citizen', min: 30 },
  { name: 'Neighbourhood Watch', min: 80 },
  { name: 'Civic Champion', min: 160 },
  { name: 'City Guardian', min: 300 },
];

export function levelFor(points) {
  const i = LEVELS.findLastIndex((l) => points >= l.min);
  const next = LEVELS[i + 1];
  return { name: LEVELS[i].name, index: i, points, nextName: next?.name || null, nextAt: next?.min || null, progress: next ? (points - LEVELS[i].min) / (next.min - LEVELS[i].min) : 1 };
}

function monthly(dates, months = 6) {
  const now = new Date();
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en', { month: 'short' }), count: 0 };
  });
  for (const dt of dates) {
    const d = new Date(dt);
    const b = buckets.find((x) => x.key === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    if (b) b.count += 1;
  }
  return buckets;
}

async function recentActivity(userId) {
  const rows = await ComplaintHistory.find({ actorId: userId, action: { $ne: 'ai_analysis' } })
    .sort({ createdAt: -1 }).limit(40).populate('complaintId', 'referenceId title category status').lean();
  return rows.filter((r) => r.complaintId).map((r) => ({
    at: r.createdAt,
    action: r.action,
    fromStatus: r.fromStatus,
    toStatus: r.toStatus,
    note: r.internal ? undefined : r.note,
    complaint: { id: r.complaintId._id, referenceId: r.complaintId.referenceId, title: r.complaintId.title, category: r.complaintId.category, status: r.complaintId.status },
  }));
}

async function citizenProfile(user) {
  const [mine, votes, feedback] = await Promise.all([
    Complaint.find({ reportedBy: user._id }, 'referenceId title category status ward city images createdAt location upvotes resolution.resolvedAt').sort({ createdAt: -1 }).lean(),
    Vote.countDocuments({ userId: user._id }),
    Feedback.find({ citizenId: user._id }, 'rating').lean(),
  ]);
  const resolved = mine.filter((c) => ['resolved', 'closed'].includes(c.status));
  const withPhoto = mine.filter((c) => c.images?.length).length;
  const wards = new Set(mine.map((c) => c.ward).filter(Boolean));
  const supportReceived = mine.reduce((s, c) => s + (c.upvotes || 0), 0);
  const points = mine.length * POINTS.report + withPhoto * POINTS.reportWithPhoto + resolved.length * POINTS.resolved + votes * POINTS.vote + feedback.length * POINTS.feedback;
  const byCategory = {};
  for (const c of mine) byCategory[c.category] = (byCategory[c.category] || 0) + 1;

  const badges = [
    { id: 'first', name: 'First report', earned: mine.length >= 1, hint: 'File your first report' },
    { id: 'photo', name: 'Photo evidence', earned: withPhoto >= 1, hint: 'Attach a photo to a report' },
    { id: 'fixed', name: 'Got it fixed', earned: resolved.length >= 1, hint: 'Have a report resolved' },
    { id: 'voice', name: 'Community voice', earned: votes >= 5, hint: 'Support 5 nearby issues' },
    { id: 'rater', name: 'Fair reviewer', earned: feedback.length >= 3, hint: 'Rate 3 resolved cases' },
    { id: 'explorer', name: 'Ward explorer', earned: wards.size >= 3, hint: 'Report in 3 different wards' },
    { id: 'trusted', name: 'Trusted reporter', earned: supportReceived >= 5, hint: 'Get 5 "me too" votes on your reports' },
    { id: 'regular', name: 'Regular', earned: mine.length >= 10, hint: 'File 10 reports' },
  ];

  return {
    stats: {
      reports: mine.length,
      open: mine.filter((c) => ACTIVE_STATUSES.includes(c.status)).length,
      resolved: resolved.length,
      resolutionRate: mine.length ? Math.round((resolved.length / mine.length) * 100) : 0,
      medianResolutionHours: median(resolved.filter((c) => c.resolution?.resolvedAt).map((c) => (new Date(c.resolution.resolvedAt) - new Date(c.createdAt)) / 36e5)),
      votesGiven: votes,
      supportReceived,
      ratingsGiven: feedback.length,
      avgRatingGiven: feedback.length ? Math.round((feedback.reduce((s, f) => s + f.rating, 0) / feedback.length) * 10) / 10 : null,
      wards: wards.size,
    },
    level: levelFor(points),
    pointsRules: POINTS,
    badges,
    byCategory,
    monthly: monthly(mine.map((c) => c.createdAt)),
    reports: mine.slice(0, 50).map((c) => ({
      id: c._id, referenceId: c.referenceId, title: c.title, category: c.category, status: c.status, ward: c.ward, createdAt: c.createdAt,
      lat: c.location.coordinates[1], lng: c.location.coordinates[0],
    })),
  };
}

async function staffProfile(user) {
  const scope = user.role === 'officer' ? { assignedTo: user._id } : {};
  const now = new Date();
  const [cases, actions] = await Promise.all([
    Complaint.find(scope, 'referenceId title category status createdAt sla resolution location').lean(),
    ComplaintHistory.aggregate([{ $match: { actorId: user._id } }, { $group: { _id: '$action', n: { $sum: 1 } } }]),
  ]);
  const resolved = cases.filter((c) => c.resolution?.resolvedAt && String(c.resolution.resolvedBy || '') === String(user._id));
  const ratings = await Feedback.find({ complaintId: { $in: resolved.map((c) => c._id) } }, 'rating').lean();
  const active = cases.filter((c) => ACTIVE_STATUSES.includes(c.status));
  const byAction = Object.fromEntries(actions.map((a) => [a._id, a.n]));
  return {
    stats: {
      active: active.length,
      overdue: active.filter((c) => c.sla?.dueAt && new Date(c.sla.dueAt) < now).length,
      resolvedByMe: resolved.length,
      medianResolutionHours: median(resolved.map((c) => (new Date(c.resolution.resolvedAt) - new Date(c.createdAt)) / 36e5)),
      avgCitizenRating: ratings.length ? Math.round((ratings.reduce((s, f) => s + f.rating, 0) / ratings.length) * 10) / 10 : null,
      ratings: ratings.length,
      assignmentsMade: byAction.assigned || 0,
      reviews: byAction.reviewed || 0,
      statusUpdates: byAction.status_change || 0,
      notes: byAction.note || 0,
    },
    monthly: monthly(resolved.map((c) => c.resolution.resolvedAt)),
    reports: active.slice(0, 50).map((c) => ({
      id: c._id, referenceId: c.referenceId, title: c.title, category: c.category, status: c.status, createdAt: c.createdAt,
      lat: c.location.coordinates[1], lng: c.location.coordinates[0],
    })),
  };
}

export async function buildProfile(user) {
  const body = user.role === 'citizen' ? await citizenProfile(user) : await staffProfile(user);
  return { user: user.toSafeJSON(), ...body, activity: await recentActivity(user._id) };
}
