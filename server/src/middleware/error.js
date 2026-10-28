import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../utils/http.js';

export function requestId(req, res, next) {
  res.locals.requestId = randomUUID();
  res.set('X-Request-Id', res.locals.requestId);
  next();
}

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' }, requestId: res.locals.requestId });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = 500;
  let code = 'INTERNAL';
  let message = 'Something went wrong';
  let details;

  if (err instanceof AppError) ({ status, code, message, details } = err);
  else if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION'; message = 'Some fields are invalid';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof multer.MulterError) {
    status = 400; code = 'UPLOAD'; message = err.message;
  } else if (err.name === 'CastError') {
    status = 400; code = 'BAD_ID'; message = 'Invalid id';
  } else if (err.code === 11000) {
    status = 409; code = 'DUPLICATE'; message = 'Already exists';
  } else if (err.type === 'entity.too.large') {
    status = 413; code = 'TOO_LARGE'; message = 'Request body too large';
  }

  if (status >= 500) console.error(`[${res.locals.requestId}]`, err); // never log request bodies (may hold passwords)
  res.status(status).json({ success: false, error: { code, message, ...(details && { details }) }, requestId: res.locals.requestId });
}
