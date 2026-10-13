const mongoose = require('mongoose');

const studentAcademicHistorySchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  session: { type: String, required: true, trim: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  year: { type: Number, required: true, min: 1, max: 4 },
  term: { type: String, enum: ['july-december', 'january-june'], required: true },
  branch: { type: String, required: true, trim: true },
  section: String,
  status: { type: String, enum: ['active', 'completed', 'withdrawn'], default: 'active' },
}, { timestamps: true });

studentAcademicHistorySchema.index({ studentId: 1, session: 1, term: 1 }, { unique: true });

module.exports = mongoose.model('StudentAcademicHistory', studentAcademicHistorySchema);
