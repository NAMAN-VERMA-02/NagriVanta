// Vercel serverless entry: every request is rewritten here (see vercel.json).
import { env } from '../src/config/env.js';
import { connectDb } from '../src/config/db.js';
import { createApp } from '../src/app.js';

const app = createApp();
let connecting = null; // one shared connection per warm instance

export default async function handler(req, res) {
  try {
    connecting ??= connectDb(env.mongoUri);
    await connecting;
  } catch (err) {
    connecting = null; // retry on the next request
    console.error('database connection failed:', err.name);
    // /health still answers so the problem is visible; everything else gets a clear JSON error
    if (!req.url.startsWith('/health')) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'Database unreachable. Check MONGODB_URI and MongoDB Atlas Network Access (allow 0.0.0.0/0 for Vercel).' } }));
    }
  }
  return app(req, res);
}
