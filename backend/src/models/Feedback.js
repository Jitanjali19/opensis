const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  session: String,
  term: { type: String, enum: ['july-december', 'january-june'] },
  semester: Number,
  ratings: {
    knowledge: { type: Number, min: 1, max: 5 },
    clarity: { type: Number, min: 1, max: 5 },
    punctuality: { type: Number, min: 1, max: 5 },
    interaction: { type: Number, min: 1, max: 5 },
    doubtSolving: { type: Number, min: 1, max: 5 },
    fairness: { type: Number, min: 1, max: 5 },
  },
  comments: String,
  status: { type: String, enum: ['submitted', 'under_review', 'action_taken', 'closed'], default: 'submitted' },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

feedbackSchema.index({ studentId: 1, subjectId: 1, facultyId: 1, session: 1, term: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
