import mongoose from 'mongoose';
import { CITY_NAMES, ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'citizen' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  phone: { type: String, trim: true },
  city: { type: String, enum: CITY_NAMES }, // staff work in one city
  preferredLanguage: { type: String, enum: ['en', 'hi'], default: 'en' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const { _id, name, email, role, departmentId, phone, city, preferredLanguage, createdAt } = this;
  return { id: _id, name, email, role, departmentId, phone, city, preferredLanguage, createdAt };
};

export default mongoose.model('User', userSchema);
