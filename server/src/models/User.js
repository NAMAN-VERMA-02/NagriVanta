import mongoose from 'mongoose';
import { ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'citizen' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  phone: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const { _id, name, email, role, departmentId, phone, createdAt } = this;
  return { id: _id, name, email, role, departmentId, phone, createdAt };
};

export default mongoose.model('User', userSchema);
