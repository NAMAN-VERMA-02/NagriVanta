import mongoose from 'mongoose';

const uploadSchema = new mongoose.Schema({
  // Random, unguessable public key. The ObjectId is never exposed because its counter part is sequential.
  key: { type: String, required: true, unique: true },
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  kind: { type: String, enum: ['image', 'video'], default: 'image' },
  size: Number,
  sha256: String, // fingerprint of the stored bytes, recorded in history for tamper evidence
  phash: String, // perceptual hash for images
  exif: { takenAt: Date, lat: Number, lng: Number },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: { createdAt: true, updatedAt: false } });

uploadSchema.index({ phash: 1 });

export default mongoose.model('Upload', uploadSchema);
