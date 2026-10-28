import mongoose from 'mongoose';
import { CATEGORIES, CITY_NAMES, PRIORITIES, STATUSES } from '../config/constants.js';

const { ObjectId } = mongoose.Schema.Types;

const complaintSchema = new mongoose.Schema({
  referenceId: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  language: { type: String, enum: ['en', 'hi', 'mixed'], default: 'en' },
  category: { type: String, enum: CATEGORIES, required: true },
  categorySource: { type: String, enum: ['citizen', 'ai', 'staff'], default: 'citizen' },
  priority: { type: String, enum: PRIORITIES, default: 'medium' },
  priorityConfirmed: { type: Boolean, default: false },
  status: { type: String, enum: STATUSES, default: 'submitted', index: true },
  city: { type: String, enum: CITY_NAMES, default: CITY_NAMES[0], index: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat] - longitude first
  },
  locationSource: { type: String, enum: ['gps', 'map', 'photo', 'channel'], default: 'map' },
  address: { type: String, trim: true, maxlength: 200 },
  pincode: { type: String, match: /^[1-9]\d{5}$/ },
  ward: { type: String, trim: true, maxlength: 80, index: true },
  images: [String],
  videos: [String],
  imageHashes: [String], // 64-bit perceptual hashes (hex) for photo-based duplicate checks
  media: {
    // Read from the first photo's EXIF data on the server, never trusted from the client.
    takenAt: Date,
    gps: { lat: Number, lng: Number },
  },
  source: { type: String, enum: ['web', 'mobile', 'voice', 'chat', 'open311', 'seed'], default: 'web' },
  externalId: { type: String, trim: true, maxlength: 80 }, // id in a partner system (Open311 integrations)
  reportedBy: { type: ObjectId, ref: 'User', required: true, index: true },
  departmentId: { type: ObjectId, ref: 'Department', index: true },
  assignedTo: { type: ObjectId, ref: 'User', index: true },
  routing: {
    method: { type: String, enum: ['auto', 'manual'] },
    suggestedDepartmentId: { type: ObjectId, ref: 'Department' },
    reason: String,
    at: Date,
  },
  // AI output stays apart from the confirmed fields above; staff decide.
  aiAnalysis: {
    status: { type: String, enum: ['pending', 'done', 'fallback', 'failed'], default: 'pending' },
    engine: String, // gemini | naive-bayes | rules
    category: { type: String, enum: CATEGORIES },
    summary: String,
    priority: { type: String, enum: PRIORITIES },
    reasons: [String],
    confidence: Number,
    usedImage: Boolean,
    model: String,
    latencyMs: Number,
    error: String,
    analyzedAt: Date,
  },
  priorityScore: {
    total: Number,
    factors: [{ label: String, points: Number, _id: false }],
  },
  duplicateCandidates: [{
    complaintId: { type: ObjectId, ref: 'Complaint' },
    referenceId: String,
    title: String,
    score: Number,
    distanceM: Number,
    signals: [String],
    _id: false,
  }],
  upvotes: { type: Number, default: 0 },
  sla: { dueAt: Date, escalatedAt: Date },
  resolution: {
    note: String,
    evidence: [String],
    resolvedAt: Date,
    resolvedBy: { type: ObjectId, ref: 'User' },
    verification: {
      status: { type: String, enum: ['passed', 'needs_review', 'unverified'] },
      checks: [{ name: String, ok: Boolean, detail: String, _id: false }],
      verifiedAt: Date,
    },
  },
  reopenCount: { type: Number, default: 0 },
}, { timestamps: true });

complaintSchema.index({ location: '2dsphere' });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ city: 1, status: 1, createdAt: -1 });

export default mongoose.model('Complaint', complaintSchema);
