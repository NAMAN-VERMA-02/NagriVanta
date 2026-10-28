import { z } from 'zod';
import { CATEGORIES, CITY_NAMES, PRIORITIES, STATUSES } from '../config/constants.js';
import { env } from '../config/env.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
// multipart forms send numbers as strings
const num = (min, max) => z.coerce.number().min(min).max(max);

// "2026-10-28" means that local day (APP_TZ_OFFSET), not UTC midnight. endOfDay makes "to" inclusive.
const dateParam = (endOfDay) => z.string().max(40).transform((s, ctx) => {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = new Date(dateOnly ? `${s}T${endOfDay ? '23:59:59.999' : '00:00:00'}${env.tzOffset}` : s);
  if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: 'custom', message: 'Invalid date' }); return z.NEVER; }
  return d;
});

export const registerSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(120),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  phone: z.string().trim().max(20).optional(),
});

export const loginSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1).max(100),
});

export const createStaffSchema = registerSchema.extend({
  role: z.enum(['officer', 'admin']),
  departmentId: objectId.optional(),
});

export const createComplaintSchema = z.strictObject({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(2000),
  category: z.enum([...CATEGORIES, 'auto']).default('auto'),
  // optional only because a photo's GPS can supply the location; the controller enforces one of them
  lat: num(-90, 90).optional(),
  lng: num(-180, 180).optional(),
  locationSource: z.enum(['gps', 'map']).optional(),
  address: z.string().trim().max(200).optional(),
  ward: z.string().trim().max(80).optional(),
  city: z.enum(CITY_NAMES).optional(),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Pincode must be 6 digits').optional(),
  source: z.enum(['web', 'mobile', 'voice', 'chat']).optional(),
});

export const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  ward: z.string().max(80).optional(),
  departmentId: objectId.optional(),
  overdue: z.enum(['true', 'false']).optional(),
  q: z.string().max(100).optional(),
  city: z.enum(CITY_NAMES).optional(),
  from: dateParam(false).optional(),
  to: dateParam(true).optional(),
  near: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).optional(), // "lat,lng" for the community feed
  sort: z.enum(['new', 'top']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const statusSchema = z.strictObject({
  to: z.enum(STATUSES),
  note: z.string().trim().max(1000).optional(),
});

export const assignSchema = z.strictObject({
  departmentId: objectId,
  assignedTo: objectId.optional(),
  dueAt: z.coerce.date().optional(),
  note: z.string().trim().max(1000).optional(),
});

export const reviewSchema = z.strictObject({
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  ward: z.string().trim().max(80).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const noteSchema = z.strictObject({
  note: z.string().trim().min(1).max(1000),
  internal: z.boolean().default(false), // internal notes are hidden from citizens
});

export const feedbackSchema = z.strictObject({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export const reopenSchema = z.strictObject({ reason: z.string().trim().min(5).max(500) });

export const nearbySchema = z.object({
  lat: num(-90, 90),
  lng: num(-180, 180),
  text: z.string().max(2000).optional(),
  category: z.enum([...CATEGORIES, 'auto']).optional(),
});

export const chatSchema = z.strictObject({
  messages: z.array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) })).min(1).max(20),
  lang: z.enum(['en', 'hi']).optional(),
});

export const open311CreateSchema = z.object({
  api_key: z.string().min(8).max(200),
  service_code: z.enum(CATEGORIES),
  lat: num(-90, 90),
  long: num(-180, 180),
  description: z.string().trim().min(10).max(2000),
  address_string: z.string().trim().max(200).optional(),
  account_id: z.string().trim().max(80).optional(), // the caller's own id for this request (shared case id)
  first_name: z.string().trim().max(60).optional(),
});

export const updateProfileSchema = z.strictObject({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/, 'Enter a valid phone number').or(z.literal('')).optional(),
  preferredLanguage: z.enum(['en', 'hi']).optional(),
  city: z.enum(CITY_NAMES).optional(),
});

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(100),
});

export const geoReverseSchema = z.object({ lat: num(-90, 90), lng: num(-180, 180) });

export const departmentSlaSchema = z.strictObject({
  slaHours: z.strictObject(Object.fromEntries(PRIORITIES.map((p) => [p, z.number().int().min(1).max(24 * 60)]))).partial(),
});
