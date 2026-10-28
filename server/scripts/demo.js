// Zero-setup demo: starts an in-memory MongoDB, seeds it and runs the API.
// Data is lost when you stop it. Use `npm run dev` with a real MONGODB_URI for persistence.
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri('nagrivanta');
process.env.JWT_SECRET ||= 'demo-only-secret-change-me';
process.env.SEED_PASSWORD = ''; // throwaway in-memory data always uses the documented demo password

const { seed } = await import('./seed.js');
const { connectDb } = await import('../src/config/db.js');
await connectDb(process.env.MONGODB_URI);
await seed();
await import('../src/server.js');
