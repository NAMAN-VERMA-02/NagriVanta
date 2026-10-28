import { z } from 'zod';
import { CATEGORIES, PRIORITIES, STATUSES } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
// multipart forms send numbers as strings
const num = (min, max) => z.coerce.number().min(min).max(max);

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
  lat: num(-90, 90),
  lng: num(-180, 180),
  address: z.string().trim().max(200).optional(),
  ward: z.string().trim().max(80).optional(),
  source: z.enum(['web', 'mobile']).optional(),
});

export const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  ward: z.string().max(80).optional(),
  departmentId: objectId.optional(),
  overdue: z.enum(['true', 'false']).optional(),
  q: z.string().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
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

export const departmentSlaSchema = z.strictObject({
  slaHours: z.strictObject(Object.fromEntries(PRIORITIES.map((p) => [p, z.number().int().min(1).max(24 * 60)]))).partial(),
});
