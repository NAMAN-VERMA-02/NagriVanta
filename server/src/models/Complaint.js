import mongoose from 'mongoose';
import { CATEGORIES, PRIORITIES, STATUSES } from '../config/constants.js';

const { ObjectId } = mongoose.Schema.Types;

const complaintSchema = new mongoose.Schema({
  referenceId: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, enum: CATEGORIES, required: true },
  categorySource: { type: String, enum: ['citizen', 'ai', 'staff'], default: 'citizen' },
  priority: { type: String, enum: PRIORITIES, default: 'medium' },
  priorityConfirmed: { type: Boolean, default: false },
  status: { type: String, enum: STATUSES, default: 'submitted', index: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat] - longitude first
  },
  address: { type: String, trim: true, maxlength: 200 },
  ward: { type: String, trim: true, maxlength: 80, index: true },
  images: [String],
  source: { type: String, enum: ['web', 'mobile', 'seed'], default: 'web' },
  reportedBy: { type: ObjectId, ref: 'User', required: true, index: true },
  departmentId: { type: ObjectId, ref: 'Department', index: true },
  assignedTo: { type: ObjectId, ref: 'User', index: true },
  // AI output stays apart from the confirmed fields above; staff decide.
  aiAnalysis: {
    status: { type: String, enum: ['pending', 'done', 'fallback', 'failed'], default: 'pending' },
    category: { type: String, enum: CATEGORIES },
    summary: String,
    priority: { type: String, enum: PRIORITIES },
    reasons: [String],
    confidence: Number,
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
  sla: { dueAt: Date, escalatedAt: Date },
  resolution: { note: String, evidence: [String], resolvedAt: Date, resolvedBy: { type: ObjectId, ref: 'User' } },
  reopenCount: { type: Number, default: 0 },
}, { timestamps: true });

complaintSchema.index({ location: '2dsphere' });
complaintSchema.index({ createdAt: -1 });

export default mongoose.model('Complaint', complaintSchema);
