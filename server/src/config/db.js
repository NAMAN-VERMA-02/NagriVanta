import mongoose from 'mongoose';

export async function connectDb(uri) {
  if (!uri) throw new Error('MONGODB_URI is not set (see server/.env.example)');
  await mongoose.connect(uri);
  return mongoose.connection;
}
