// Open311 GeoReport v2 (https://wiki.open311.org/GeoReport_v2): the standard API many municipal
// systems (e.g. MCD 311, FixMyStreet, SeeClickFix) speak. Lets other government apps read cases and
// file new ones into the same workflow, so one case has one shared ID across channels.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import Complaint from '../models/Complaint.js';
import User from '../models/User.js';
import { ACTIVE_STATUSES, CATEGORIES, nearestCity } from '../config/constants.js';
import { env } from '../config/env.js';
import { createComplaint, processNewComplaint } from '../services/complaints.js';
import { badRequest, forbidden, notFound } from '../utils/http.js';
import { open311CreateSchema } from '../validators/schemas.js';

const NAMES = { road: 'Road / pothole', garbage: 'Garbage / waste', water: 'Water supply / leak', streetlight: 'Streetlight', drainage: 'Drainage / sewer', other: 'Other civic issue' };

const toRequest = (c) => ({
  service_request_id: c.referenceId,
  status: ACTIVE_STATUSES.includes(c.status) ? 'open' : 'closed',
  status_notes: c.status,
  service_name: NAMES[c.category],
  service_code: c.category,
  requested_datetime: c.createdAt?.toISOString(),
  updated_datetime: c.updatedAt?.toISOString(),
  expected_datetime: c.sla?.dueAt?.toISOString() || null,
  address: c.ward ? `${c.ward}, ${c.city}` : c.city,
  lat: Math.round(c.location.coordinates[1] * 1000) / 1000, // public: rounded to ~110 m
  long: Math.round(c.location.coordinates[0] * 1000) / 1000,
  account_id: c.externalId || null,
});

export const services = (req, res) => res.json(CATEGORIES.map((code) => ({
  service_code: code, service_name: NAMES[code], description: NAMES[code], metadata: false, type: 'realtime', keywords: code, group: 'civic',
})));

export async function listRequests(req, res) {
  const filter = {};
  if (CATEGORIES.includes(req.query.service_code)) filter.category = req.query.service_code;
  if (req.query.status === 'open') filter.status = { $in: ACTIVE_STATUSES };
  if (req.query.status === 'closed') filter.status = { $nin: ACTIVE_STATUSES };
  const start = req.query.start_date && new Date(req.query.start_date);
  const end = req.query.end_date && new Date(req.query.end_date);
  if ((start && !Number.isNaN(start.getTime())) || (end && !Number.isNaN(end.getTime()))) {
    filter.createdAt = { ...(start && !Number.isNaN(start.getTime()) && { $gte: start }), ...(end && !Number.isNaN(end.getTime()) && { $lte: end }) };
  }
  const items = await Complaint.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(items.map(toRequest));
}

export async function getRequest(req, res) {
  const c = await Complaint.findOne({ referenceId: String(req.params.id).toUpperCase() });
  if (!c) throw notFound('Unknown service_request_id');
  res.json([toRequest(c)]);
}

const keyMatches = (key) => env.open311Keys.some((k) => k.length === key.length && timingSafeEqual(Buffer.from(k), Buffer.from(key)));

// One gateway account per partner key prefix owns the cases it files.
async function gatewayUser(apiKey) {
  const email = `open311-${apiKey.slice(0, 6).toLowerCase().replace(/[^a-z0-9]/g, 'x')}@gateway.civiclens.local`;
  return (await User.findOne({ email }))
    || User.create({ name: 'Open311 partner', email, role: 'citizen', passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10) });
}

export async function createRequest(req, res) {
  const body = open311CreateSchema.parse(req.body);
  if (!env.open311Keys.length || !keyMatches(body.api_key)) throw forbidden('Invalid api_key');
  if (body.account_id && await Complaint.exists({ externalId: body.account_id })) throw badRequest('A request with this account_id already exists');
  const user = await gatewayUser(body.api_key);
  const complaint = await createComplaint({
    title: body.description.split(/[.!?\n]/)[0].slice(0, 100).padEnd(5, '.'),
    description: body.description,
    category: body.service_code,
    lat: body.lat,
    lng: body.long,
    address: body.address_string,
    city: nearestCity(body.lat, body.long),
    source: 'open311',
    externalId: body.account_id,
  }, user);
  const done = await processNewComplaint(complaint._id);
  res.status(201).json([{ service_request_id: done.referenceId, service_notice: `Received. Status: ${done.status}`, account_id: body.account_id || null }]);
}
