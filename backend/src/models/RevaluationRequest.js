const mongoose = require('mongoose');

const revaluationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  semester: { type: Number, required: true },
  session: String,
  reason: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  internalMarks: Number,
  externalMarks: Number,
  totalMarks: Number,
  reviewedAt: Date,
  requestedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('RevaluationRequest', revaluationSchema);
