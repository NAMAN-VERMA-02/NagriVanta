import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { upload, verifyMedia } from '../middleware/upload.js';
import * as auth from '../controllers/auth.js';
import * as complaints from '../controllers/complaints.js';
import * as admin from '../controllers/admin.js';
import * as open311 from '../controllers/open311.js';
import { escalateOverdue } from '../jobs/sla.js';
import { chat } from '../services/assistant.js';
import { retryPendingTriage } from '../services/complaints.js';
import { forbidden, ok } from '../utils/http.js';
import { chatSchema } from '../validators/schemas.js';

const r = Router();
// shortcut: in-memory limits are per server instance; on Vercel add a Firewall rate-limit rule for /api/v1/auth/*
const limit = (windowMs, max) => rateLimit({ windowMs, limit: env.isTest ? 10000 : max, standardHeaders: 'draft-8', legacyHeaders: false });
const authLimiter = limit(15 * 60 * 1000, 20);
const createLimiter = limit(60 * 60 * 1000, 30);
const chatLimiter = limit(60 * 1000, 20);
const staff = requireRole('officer', 'admin');
const adminOnly = requireRole('admin');

// auth
r.post('/auth/register', authLimiter, auth.register);
r.post('/auth/login', authLimiter, auth.login);
r.post('/auth/logout', requireAuth, auth.logout);
r.get('/auth/me', requireAuth, auth.me);

// public (no auth, aggregates and anonymised data only)
r.get('/public/scorecard', admin.scorecard);
r.get('/public/risk-alerts', admin.risk);
r.get('/public/open-data.:format', admin.openDataExport);
r.get('/departments', admin.departments);
r.get('/cities', admin.cities);

// AI civic assistant (chat channel); signed-in users can also look up their own cases
r.post('/assistant/chat', chatLimiter, optionalAuth, async (req, res) => ok(res, await chat(chatSchema.parse(req.body), req.user)));

// complaints
r.post('/complaints', requireAuth, requireRole('citizen'), createLimiter,
  upload.fields([{ name: 'images', maxCount: 3 }, { name: 'videos', maxCount: 1 }]), verifyMedia, complaints.create);
r.get('/complaints/mine', requireAuth, complaints.mine);
r.get('/complaints/nearby', requireAuth, complaints.nearby);
r.get('/complaints', requireAuth, complaints.list);
r.get('/complaints/:id', requireAuth, complaints.getOne);
r.get('/complaints/:id/integrity', requireAuth, complaints.integrity);
r.patch('/complaints/:id', requireAuth, adminOnly, complaints.review);
r.patch('/complaints/:id/status', requireAuth, staff, upload.array('evidence', 3), verifyMedia, complaints.changeStatus);
r.patch('/complaints/:id/assign', requireAuth, adminOnly, complaints.assign);
r.post('/complaints/:id/notes', requireAuth, staff, complaints.addNote);
r.post('/complaints/:id/feedback', requireAuth, requireRole('citizen'), complaints.feedback);
r.post('/complaints/:id/reopen', requireAuth, requireRole('citizen'), complaints.reopen);
r.post('/complaints/:id/upvote', requireAuth, requireRole('citizen'), complaints.upvote);
r.delete('/complaints/:id/upvote', requireAuth, requireRole('citizen'), complaints.upvote);

// admin / staff
r.get('/admin/analytics', requireAuth, staff, admin.analytics);
r.get('/admin/workload', requireAuth, adminOnly, admin.workload);
r.get('/admin/users', requireAuth, adminOnly, admin.listUsers);
r.post('/admin/users', requireAuth, adminOnly, admin.createStaff);
r.patch('/admin/departments/:id', requireAuth, adminOnly, admin.updateDepartmentSla);

// scheduled job trigger (Vercel Cron sends Authorization: Bearer <CRON_SECRET>)
r.get('/jobs/sla', async (req, res) => {
  if (!env.cronSecret || req.get('authorization') !== `Bearer ${env.cronSecret}`) throw forbidden();
  ok(res, { escalated: await escalateOverdue(), retriedTriage: await retryPendingTriage() });
});

// notifications
r.get('/notifications', requireAuth, admin.notifications);
r.post('/notifications/read-all', requireAuth, admin.markAllRead);
r.patch('/notifications/:id/read', requireAuth, admin.markRead);

// Open311 GeoReport v2 integration (government / partner systems)
export const open311Router = Router();
open311Router.get('/services.json', open311.services);
open311Router.get('/requests.json', open311.listRequests);
open311Router.get('/requests/:id.json', open311.getRequest);
open311Router.post('/requests.json', limit(60 * 1000, 60), open311.createRequest);

export default r;
