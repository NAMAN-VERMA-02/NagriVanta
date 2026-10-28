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

/**
 * Recurrence hotspots: places (~110 m grid cells) with 3+ reports of the same category in 90 days.
 * Recurring issues point to a root cause (bad drainage, weak resurfacing) rather than one-off damage.
 */
export async function recurrenceHotspots({ city, days = 90, min = 3 } = {}) {
  const rows = await Complaint.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - days * 864e5) }, ...(city && { city }) } },
    {
      $group: {
        _id: {
          lat: { $round: [{ $arrayElemAt: ['$location.coordinates', 1] }, 3] },
          lng: { $round: [{ $arrayElemAt: ['$location.coordinates', 0] }, 3] },
          category: '$category',
        },
        count: { $sum: 1 },
        ward: { $first: '$ward' },
        city: { $first: '$city' },
        open: { $sum: { $cond: [{ $in: ['$status', ACTIVE_STATUSES] }, 1, 0] } },
        last: { $max: '$createdAt' },
      },
    },
    { $match: { count: { $gte: min } } },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ]);
  return rows.map((r) => ({ ...r._id, count: r.count, open: r.open, ward: r.ward, city: r.city, lastReportedAt: r.last }));
}

export async function operationalMetrics({ from, to, departmentId, city } = {}) {
  const match = {};
  if (from || to) match.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  if (departmentId) match.departmentId = departmentId;
  if (city) match.city = city;
  const now = new Date();

  const [facet] = await Complaint.aggregate([
    { $match: match },
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
        byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
        byWard: [{ $group: { _id: '$ward', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }],
        byCity: [{ $group: { _id: '$city', count: { $sum: 1 } } }],
        bySource: [{ $group: { _id: '$source', count: { $sum: 1 } } }],
        verification: [{ $match: { 'resolution.verification.status': { $exists: true } } }, { $group: { _id: '$resolution.verification.status', count: { $sum: 1 } } }],
        autoRouted: [{ $match: { 'routing.method': 'auto' } }, { $count: 'n' }],
        workload: [
          { $match: { status: { $in: ACTIVE_STATUSES }, assignedTo: { $ne: null } } },
          { $group: { _id: '$assignedTo', active: { $sum: 1 }, overdue: { $sum: { $cond: [{ $lt: ['$sla.dueAt', now] }, 1, 0] } } } },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
          { $project: { active: 1, overdue: 1, name: { $first: '$u.name' } } },
          { $sort: { active: -1 } },
        ],
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
    byCity: toMap(facet.byCity),
    bySource: toMap(facet.bySource),
    verification: toMap(facet.verification),
    autoRouted: facet.autoRouted[0]?.n || 0,
    workload: facet.workload.map((w) => ({ officer: w.name || 'Unknown', active: w.active, overdue: w.overdue })),
    hotspots: await recurrenceHotspots({ city }),
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
export async function publicScorecard({ city } = {}) {
  const now = new Date();
  const rows = await Complaint.aggregate([
    { $match: city ? { city } : {} },
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
  const byCategory = toMap(await Complaint.aggregate([{ $match: city ? { city } : {} }, { $group: { _id: '$category', count: { $sum: 1 } } }]));
  const points = await Complaint.find(city ? { city } : {}, 'location category status').sort({ createdAt: -1 }).limit(500).lean();
  return {
    wards,
    byCategory,
    // ~110 m rounding so no exact home locations are exposed
    points: points.map((p) => ({ lat: Math.round(p.location.coordinates[1] * 1000) / 1000, lng: Math.round(p.location.coordinates[0] * 1000) / 1000, category: p.category, status: p.status })),
    hotspots: await recurrenceHotspots({ city }),
    minGroupSize: PUBLIC_MIN_GROUP,
    generatedAt: now,
  };
}

// Anonymised open data: no names, no free text, locations rounded to ~110 m.
export async function openData({ city, limit = 5000 } = {}) {
  const rows = await Complaint.find(city ? { city } : {}, 'referenceId category priority status city ward location upvotes createdAt resolution.resolvedAt source')
    .sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((c) => ({
    reference_id: c.referenceId,
    category: c.category,
    priority: c.priority,
    status: c.status,
    city: c.city,
    ward: c.ward || '',
    lat: Math.round(c.location.coordinates[1] * 1000) / 1000,
    lng: Math.round(c.location.coordinates[0] * 1000) / 1000,
    upvotes: c.upvotes || 0,
    channel: c.source,
    reported_at: c.createdAt?.toISOString(),
    resolved_at: c.resolution?.resolvedAt?.toISOString() || '',
  }));
}

export function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  return [cols.join(','), ...rows.map((r) => cols.map((k) => esc(r[k] ?? '')).join(','))].join('\n');
}
