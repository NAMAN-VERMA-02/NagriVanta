import mongoose from 'mongoose';

// Append-only by convention: the app only ever calls create() on this model.
const historySchema = new mongoose.Schema({
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorRole: String,
  action: { type: String, required: true },
  fromStatus: String,
  toStatus: String,
  note: String,
  internal: { type: Boolean, default: false }, // hidden from citizens
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.model('ComplaintHistory', historySchema);
