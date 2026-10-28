import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: String,
  readAt: Date,
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
