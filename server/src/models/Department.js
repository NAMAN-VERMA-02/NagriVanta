import mongoose from 'mongoose';
import { CATEGORIES, DEFAULT_SLA_HOURS } from '../config/constants.js';

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  description: String,
  categories: [{ type: String, enum: CATEGORIES }],
  slaHours: {
    low: { type: Number, default: DEFAULT_SLA_HOURS.low },
    medium: { type: Number, default: DEFAULT_SLA_HOURS.medium },
    high: { type: Number, default: DEFAULT_SLA_HOURS.high },
    critical: { type: Number, default: DEFAULT_SLA_HOURS.critical },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Department', departmentSchema);
