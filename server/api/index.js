// Vercel serverless entry: every request is rewritten here (see vercel.json).
import { env } from '../src/config/env.js';
import { connectDb } from '../src/config/db.js';
import { createApp } from '../src/app.js';

await connectDb(env.mongoUri); // reused across invocations while the instance stays warm
export default createApp();
