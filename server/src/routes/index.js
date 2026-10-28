import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload, verifyImages } from '../middleware/upload.js';
import * as auth from '../controllers/auth.js';
import * as complaints from '../controllers/complaints.js';
import * as admin from '../controllers/admin.js';

const r = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isTest ? 1000 : 20, standardHeaders: 'draft-8', legacyHeaders: false });
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: env.isTest ? 1000 : 30, standardHeaders: 'draft-8', legacyHeaders: false });
const staff = requireRole('officer', 'admin');
const adminOnly = requireRole('admin');

// auth
r.post('/auth/register', authLimiter, auth.register);
r.post('/auth/login', authLimiter, auth.login);
r.post('/auth/logout', requireAuth, auth.logout);
r.get('/auth/me', requireAuth, auth.me);

// public (no auth, aggregates only)
r.get('/public/scorecard', admin.scorecard);
r.get('/departments', admin.departments);

// complaints
r.post('/complaints', requireAuth, requireRole('citizen'), createLimiter, upload.array('images', 3), verifyImages, complaints.create);
r.get('/complaints/mine', requireAuth, complaints.mine);
r.get('/complaints/nearby', requireAuth, complaints.nearby);
r.get('/complaints', requireAuth, complaints.list);
r.get('/complaints/:id', requireAuth, complaints.getOne);
r.patch('/complaints/:id', requireAuth, adminOnly, complaints.review);
r.patch('/complaints/:id/status', requireAuth, staff, upload.array('evidence', 3), verifyImages, complaints.changeStatus);
r.patch('/complaints/:id/assign', requireAuth, adminOnly, complaints.assign);
r.post('/complaints/:id/notes', requireAuth, staff, complaints.addNote);
r.post('/complaints/:id/feedback', requireAuth, requireRole('citizen'), complaints.feedback);
r.post('/complaints/:id/reopen', requireAuth, requireRole('citizen'), complaints.reopen);

// admin / staff
r.get('/admin/analytics', requireAuth, staff, admin.analytics);
r.get('/admin/users', requireAuth, adminOnly, admin.listUsers);
r.post('/admin/users', requireAuth, adminOnly, admin.createStaff);
r.patch('/admin/departments/:id', requireAuth, adminOnly, admin.updateDepartmentSla);

// notifications
r.get('/notifications', requireAuth, admin.notifications);
r.post('/notifications/read-all', requireAuth, admin.markAllRead);
r.patch('/notifications/:id/read', requireAuth, admin.markRead);

export default r;
