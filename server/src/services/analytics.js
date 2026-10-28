import Complaint from '../models/Complaint.js';
import Feedback from '../models/Feedback.js';
import { ACTIVE_STATUSES, PUBLIC_MIN_GROUP } from '../config/constants.js';

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id ?? 'unknown', r.count]));

export async function operationalMetrics({ from, to, departmentId } = {}) {
  const match = {};
  if (from || to) match.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  if (departmentId) match.departmentId = departmentId;
  const now = new Date();

  const [facet] = await Complaint.aggregate([
    { $match: match },
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
        byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
        byWard: [{ $group: { _id: '$ward', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }],
        overdue: [{ $match: { status: { $in: ACTIVE_STATUSES }, 'sla.dueAt': { $lt: now } } }, { $count: 'n' }],
        reopened: [{ $match: { reopenCount: { $gt: 0 } } }, { $count: 'n' }],
        aiStatus: [{ $group: { _id: '$aiAnalysis.status', count: { $sum: 1 } } }],
        daily: [
          { $match: { createdAt: { $gte: new Date(now - 30 * 864e5) } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        resolved: [
          { $match: { 'resolution.resolvedAt': { $exists: true } } },
          { $project: { hours: { $divide: [{ $subtract: ['$resolution.resolvedAt', '$createdAt'] }, 36e5] } } },
        ],
        points: [{ $sort: { createdAt: -1 } }, { $limit: 1000 }, { $project: { c: '$location.coordinates', category: 1, priority: 1 } }],
        total: [{ $count: 'n' }],
      },
    },
  ]);

  const total = facet.total[0]?.n || 0;
  const ratings = await Feedback.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  return {
    total,
    byStatus: toMap(facet.byStatus),
    byCategory: toMap(facet.byCategory),
    byPriority: toMap(facet.byPriority),
    byWard: facet.byWard.map((r) => ({ ward: r._id || 'Unknown', count: r.count })),
    daily: facet.daily.map((r) => ({ date: r._id, count: r.count })),
    overdue: facet.overdue[0]?.n || 0,
    reopenRate: total ? round1(((facet.reopened[0]?.n || 0) / total) * 100) : 0,
    medianResolutionHours: round1(median(facet.resolved.map((r) => r.hours))),
    aiStatus: toMap(facet.aiStatus),
    avgRating: round1(ratings[0]?.avg),
    ratingsCount: ratings[0]?.n || 0,
    points: facet.points.map((p) => ({ lng: p.c[0], lat: p.c[1], category: p.category, priority: p.priority })),
    definitions: {
      overdue: 'Active cases whose SLA due date has passed',
      reopenRate: 'Share of cases reopened at least once',
      medianResolutionHours: 'Median hours from submission to resolution, resolved cases only',
    },
  };
}

// Privacy-safe public scorecard: aggregates only, small wards suppressed.
export async function publicScorecard() {
  const now = new Date();
  const rows = await Complaint.aggregate([
    {
      $group: {
        _id: '$ward',
        total: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } },
        overdue: { $sum: { $cond: [{ $and: [{ $in: ['$status', ACTIVE_STATUSES] }, { $lt: ['$sla.dueAt', now] }, { $gt: ['$sla.dueAt', null] }] }, 1, 0] } },
        resHours: { $push: { $cond: [{ $gt: ['$resolution.resolvedAt', null] }, { $divide: [{ $subtract: ['$resolution.resolvedAt', '$createdAt'] }, 36e5] }, '$$REMOVE'] } },
      },
    },
    { $sort: { total: -1 } },
  ]);
  const wards = rows.map((r) => (r.total < PUBLIC_MIN_GROUP
    ? { ward: r._id || 'Unknown', suppressed: true }
    : {
      ward: r._id || 'Unknown',
      total: r.total,
      resolvedPct: round1((r.resolved / r.total) * 100),
      overduePct: round1((r.overdue / r.total) * 100),
      medianResolutionHours: round1(median(r.resHours)),
    }));
  const byCategory = toMap(await Complaint.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]));
  const points = await Complaint.find({}, 'location category status').sort({ createdAt: -1 }).limit(500).lean();
  return {
    wards,
    byCategory,
    // ~110 m rounding so no exact home locations are exposed
    points: points.map((p) => ({ lat: Math.round(p.location.coordinates[1] * 1000) / 1000, lng: Math.round(p.location.coordinates[0] * 1000) / 1000, category: p.category, status: p.status })),
    minGroupSize: PUBLIC_MIN_GROUP,
    generatedAt: now,
  };
}
