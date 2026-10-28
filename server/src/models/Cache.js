import mongoose from 'mongoose';

// Shared cache (weather forecasts) so serverless instances do not each call external APIs.
const cacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: mongoose.Schema.Types.Mixed,
  expiresAt: { type: Date, required: true },
});

cacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Cache', cacheSchema);
