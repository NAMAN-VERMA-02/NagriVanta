import bcrypt from 'bcryptjs';
import Complaint from '../models/Complaint.js';
import ComplaintHistory from '../models/ComplaintHistory.js';
import User from '../models/User.js';
import { lookupPincode, reverseGeocode, searchPlaces } from '../services/geo.js';
import { buildProfile } from '../services/profile.js';
import { badRequest, notFound, ok, unauthorized } from '../utils/http.js';
import { changePasswordSchema, geoReverseSchema, updateProfileSchema } from '../validators/schemas.js';

export const getProfile = async (req, res) => ok(res, await buildProfile(req.user));

export async function updateProfile(req, res) {
  const body = updateProfileSchema.parse(req.body);
  Object.assign(req.user, body);
  await req.user.save();
  ok(res, { user: req.user.toSafeJSON() });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw unauthorized('Current password is incorrect');
  if (currentPassword === newPassword) throw badRequest('The new password must be different');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  ok(res, { changed: true });
}

// Public tracking by reference ID: status milestones only (no names, notes or exact location).
export async function track(req, res) {
  const ref = String(req.params.ref || '').trim().toUpperCase();
  if (!/^CIV-\d{6}-[0-9A-F]{6,8}$/.test(ref)) throw badRequest('Reference IDs look like CIV-261028-1A2B3C4D');
  const c = await Complaint.findOne({ referenceId: ref }, 'referenceId category status city ward createdAt updatedAt sla upvotes resolution.resolvedAt resolution.verification.status departmentId')
    .populate('departmentId', 'name').lean();
  if (!c) throw notFound('No complaint with this reference ID');
  const steps = await ComplaintHistory.find({ complaintId: c._id, internal: false, toStatus: { $exists: true, $ne: null } }, 'toStatus createdAt').sort({ createdAt: 1 }).lean();
  ok(res, {
    referenceId: c.referenceId,
    category: c.category,
    status: c.status,
    city: c.city,
    ward: c.ward,
    department: c.departmentId?.name || null,
    reportedAt: c.createdAt,
    updatedAt: c.updatedAt,
    targetDate: c.sla?.dueAt || null,
    resolvedAt: c.resolution?.resolvedAt || null,
    evidenceCheck: c.resolution?.verification?.status || null,
    supporters: c.upvotes || 0,
    timeline: steps.map((s) => ({ status: s.toStatus, at: s.createdAt })),
  });
}

export const pincode = async (req, res) => ok(res, await lookupPincode(req.params.pin));

export async function reverse(req, res) {
  const { lat, lng } = geoReverseSchema.parse(req.query);
  try {
    ok(res, await reverseGeocode(lat, lng));
  } catch {
    ok(res, null); // address lookup is a convenience; never block reporting on it
  }
}

export async function search(req, res) {
  try {
    ok(res, await searchPlaces(req.query.q));
  } catch {
    ok(res, []);
  }
}
