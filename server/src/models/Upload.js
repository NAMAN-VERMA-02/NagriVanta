import mongoose from 'mongoose';

const uploadSchema = new mongoose.Schema({
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  size: Number,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.model('Upload', uploadSchema);
