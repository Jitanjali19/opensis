const mongoose = require('mongoose');

const subjectMarksSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  enrollmentNo: { type: String, required: true, trim: true, index: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true, index: true },
  semester: { type: Number, required: true, index: true },
  department: { type: String, required: true, trim: true, index: true },
  section: { type: String, required: true, trim: true, index: true },
  session: { type: String, required: true, trim: true, index: true },
  cw: { type: Number, min: 0, max: 30, default: 0 },
  sw: { type: Number, min: 0, max: 40, default: 0 },
  theory: { type: Number, min: 0, max: 70, default: 0 },
  midTerm: { type: Number, default: 0 },
  endSem: { type: Number, default: 0 },
  assignment: { type: Number, default: 0 },
  quiz: { type: Number, default: 0 },
  attendance: { type: Number, default: 0 },
  practical: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'locked', 'published'],
    default: 'pending',
    index: true,
  },
  uploadBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResultUploadBatch', index: true },
  uploadedAt: { type: Date, default: Date.now },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  approvedAt: Date,
  rejectionReason: String,
}, { timestamps: true });

subjectMarksSchema.index({ studentId: 1, subjectId: 1, semester: 1, section: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('SubjectMarks', subjectMarksSchema);
