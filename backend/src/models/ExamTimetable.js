const mongoose = require('mongoose');

const examTimetableSchema = new mongoose.Schema(
  {
    session: { type: String, required: true, trim: true },
    term: {
      type: String,
      enum: ['july-december', 'january-june'],
      required: true,
    },
    examType: {
      type: String,
      enum: ['mid-sem-1', 'mid-sem-2', 'end-sem'],
      required: true,
      default: 'end-sem',
    },
    title: { type: String, trim: true, default: 'Exam Time Table' },
    fileUrl: { type: String, required: true, trim: true },
    originalName: { type: String, trim: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

examTimetableSchema.index({ session: 1, term: 1, examType: 1 }, { unique: true });

module.exports = mongoose.model('ExamTimetable', examTimetableSchema);
