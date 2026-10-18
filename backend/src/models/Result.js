const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  semester: { type: Number, required: true },
  session: String,
  branch: String,
  subjectMarks: [{
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab' },
    itemType: { type: String, enum: ['class', 'lab'], default: 'class' },
    itemCode: String,
    itemName: String,
    cw: { type: Number, min: 0, max: 30 },
    midTerm1: { type: Number, min: 0, max: 20 },
    midTerm2: { type: Number, min: 0, max: 20 },
    midTermMode: { type: String, enum: ['average', 'best'], default: 'average' },
    midTermAverage: { type: Number, min: 0, max: 20 },
    assignmentMarks: { type: Number, min: 0, max: 10 },
    attendanceMarks: { type: Number, min: 0, max: 10 },
    internalMarks: { type: Number, min: 0, max: 40 },
    sw: { type: Number, min: 0, max: 40 },
    theory: { type: Number, min: 0, max: 70 },
    practical: { type: Number, min: 0, max: 60 },
    internalMarks: Number,
    externalMarks: Number,
    totalMarks: Number,
    grade: String,
    gradePoints: Number,
    credits: Number,
    creditPoints: Number,      // gradePoints × credits
    submissionStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
    submittedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    reviewedAt: Date,
    rejectionReason: String,
  }],
  sgpa: Number,
  cgpa: Number,                 // cumulative across all semesters
  percentage: Number,
  status: { type: String, enum: ['pass', 'fail'], default: 'pass' },
  totalCredits: Number,         // total credits this semester
  earnedCredits: Number,        // credits earned (passed subjects only)
  rank: Number,                 // rank in class for this semester
  remarks: String,              // e.g. "Promoted", "Detained"
  isPublished: { type: Boolean, default: false },
  publishedAt: Date,
  isGenerated: { type: Boolean, default: false },  // gradesheet generated?
}, { timestamps: true });

// Compound index for efficient querying
resultSchema.index({ semester: 1, session: 1, branch: 1 });
resultSchema.index({ studentId: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Result', resultSchema);
