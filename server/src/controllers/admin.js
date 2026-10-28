import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Department from '../models/Department.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { CITIES, CITY_NAMES } from '../config/constants.js';
import { openData, operationalMetrics, publicScorecard, toCsv } from '../services/analytics.js';
import { riskAlerts } from '../services/risk.js';
import { officerWorkload } from '../services/routing.js';
import { badRequest, conflict, notFound, ok } from '../utils/http.js';
import { createStaffSchema, departmentSlaSchema, listQuerySchema } from '../validators/schemas.js';

export async function analytics(req, res) {
  const q = listQuerySchema.pick({ from: true, to: true, departmentId: true, city: true }).parse(req.query);
  // officers only see their own department
  const dept = req.user.role === 'officer' ? req.user.departmentId : q.departmentId;
  ok(res, await operationalMetrics({ from: q.from, to: q.to, city: q.city, departmentId: dept && new mongoose.Types.ObjectId(String(dept)) }));
}

export async function listUsers(req, res) {
  const role = ['citizen', 'officer', 'admin'].includes(req.query.role) ? req.query.role : undefined;
  const users = await User.find(role ? { role } : {}).sort({ createdAt: -1 }).limit(200).populate('departmentId', 'name');
  ok(res, users.map((u) => ({ ...u.toSafeJSON(), departmentId: u.departmentId?._id, department: u.departmentId?.name })));
}

export async function createStaff(req, res) {
  const body = createStaffSchema.parse(req.body);
  const email = body.email.toLowerCase();
  if (await User.exists({ email })) throw conflict('Email already in use');
  if (body.role === 'officer' && !body.departmentId) throw badRequest('Officers need a department');
  const dept = body.departmentId && await Department.findById(body.departmentId);
  if (body.departmentId && !dept) throw badRequest('Unknown department');
  const user = await User.create({ ...body, email, city: dept?.city, password: undefined, passwordHash: await bcrypt.hash(body.password, 12) });
  ok(res, user.toSafeJSON(), null, 201);
}

export async function departments(req, res) {
  const city = CITY_NAMES.includes(req.query.city) ? req.query.city : undefined;
  ok(res, await Department.find({ isActive: true, ...(city && { city }) }).sort({ city: 1, name: 1 }));
}

export const cities = (req, res) => ok(res, Object.entries(CITIES).map(([name, c]) => ({ name, center: c.center, wards: Object.entries(c.wards).map(([ward, p]) => ({ name: ward, ...p })) })));

export async function workload(req, res) {
  const depts = await Department.find({ isActive: true }).sort({ city: 1, name: 1 });
  ok(res, await Promise.all(depts.map(async (d) => ({ department: d.name, city: d.city, officers: await officerWorkload(d._id) }))));
}

const cityParam = (req) => (CITY_NAMES.includes(req.query.city) ? req.query.city : undefined);

export const risk = async (req, res) => ok(res, await riskAlerts({ city: cityParam(req) }));

export async function openDataExport(req, res) {
  const rows = await openData({ city: cityParam(req) });
  res.set('Cache-Control', 'public, max-age=300');
  if (req.params.format === 'csv') {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="civiclens-open-data.csv"' });
    return res.send(toCsv(rows));
  }
  return ok(res, rows, { count: rows.length, licence: 'CC BY 4.0', note: 'Anonymised: no names or free text; locations rounded to ~110 m.' });
}

export async function updateDepartmentSla(req, res) {
  const { slaHours } = departmentSlaSchema.parse(req.body);
  const dept = await Department.findById(req.params.id);
  if (!dept) throw notFound();
  Object.assign(dept.slaHours, slaHours);
  await dept.save();
  ok(res, dept);
}

export const scorecard = async (req, res) => ok(res, await publicScorecard({ city: cityParam(req) }));

export async function notifications(req, res) {
  const items = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  const unread = await Notification.countDocuments({ userId: req.user._id, readAt: null });
  ok(res, items, { unread });
}

export async function markRead(req, res) {
  await Notification.updateOne({ _id: req.params.id, userId: req.user._id }, { readAt: new Date() });
  ok(res, { read: true });
}

export async function markAllRead(req, res) {
  await Notification.updateMany({ userId: req.user._id, readAt: null }, { readAt: new Date() });
  ok(res, { read: true });
}
