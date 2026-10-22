const mongoose = require('mongoose');

const admitCardSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    session: { type: String, required: true, trim: true },
    term: {
      type: String,
      enum: ['july-december', 'january-june'],
      required: true,
    },
    examType: {
      type: String,
      enum: ['end-sem'],
      required: true,
      default: 'end-sem',
    },
    branch: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    year: { type: Number, required: true, min: 1, max: 4 },
    section: { type: String, trim: true },
    examMonthLabel: { type: String, trim: true },
    studentSnapshot: {
      name: String,
      enrollmentNo: String,
      classLabel: String,
      sectionName: String,
      semester: Number,
      semesterLabel: String,
      gender: String,
      programName: String,
      branch: String,
      session: String,
      fatherName: String,
      profilePhotoUrl: String,
      signatureUrl: String,
    },
    papers: [
      {
        srNo: Number,
        paperCode: String,
        subjectName: String,
        subjectType: { type: String, enum: ['theory', 'practical'] },
      },
    ],
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

admitCardSchema.index(
  { studentId: 1, session: 1, term: 1, examType: 1 },
  { unique: true }
);

module.exports = mongoose.model('AdmitCard', admitCardSchema);
