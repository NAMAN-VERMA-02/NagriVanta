import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { forbidden, unauthorized } from '../utils/http.js';

export const signToken = (user) => jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

// Bearer tokens work the same for the web app and the mobile app.
export async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw unauthorized('Session expired, please sign in again');
  }
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw unauthorized();
  req.user = user;
  next();
}

// Attaches req.user when a valid token is sent, but never rejects the request.
export async function optionalAuth(req, res, next) {
  if (!req.get('authorization')) return next();
  try {
    await requireAuth(req, res, () => {});
  } catch {
    req.user = undefined;
  }
  return next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw forbidden();
  next();
};
