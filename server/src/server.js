import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';
import { startSlaJob } from './jobs/sla.js';

if (!env.jwtSecret || env.jwtSecret.startsWith('replace-')) {
  console.error('Set JWT_SECRET in server/.env (see .env.example)');
  process.exit(1);
}
await connectDb(env.mongoUri);
startSlaJob(env.slaCheckMinutes);
// 0.0.0.0 so the Expo app on a phone in the same Wi-Fi can reach it
createApp().listen(env.port, '0.0.0.0', () => {
  console.log(`CivicLens API on http://localhost:${env.port}  (AI: ${env.geminiKey ? env.geminiModel : 'rules fallback - set GEMINI_API_KEY to enable Gemini'})`);
});
