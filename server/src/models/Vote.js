import mongoose from 'mongoose';

// One "me too" per citizen per complaint; the unique index makes double votes impossible.
const voteSchema = new mongoose.Schema({
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

voteSchema.index({ complaintId: 1, userId: 1 }, { unique: true });

export default mongoose.model('Vote', voteSchema);
