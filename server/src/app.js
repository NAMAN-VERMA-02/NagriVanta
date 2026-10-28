import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler, requestId } from './middleware/error.js';
import { UPLOAD_DIR } from './middleware/upload.js';
import { aiEnabled } from './services/ai.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // images are loaded by the web/mobile apps
  app.use(cors({
    // requests with no Origin (mobile apps, curl) are allowed; browsers must be on the allowlist
    origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(rateLimit({ windowMs: 60 * 1000, limit: env.isTest ? 10000 : 300, standardHeaders: 'draft-8', legacyHeaders: false }));

  app.get('/health', (req, res) => res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'up' : 'down',
    ai: aiEnabled() ? 'gemini' : 'rules-fallback',
    time: new Date().toISOString(),
  }));
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false }));
  app.use('/api/v1', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
