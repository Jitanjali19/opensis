const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: String,
  itemType: { type: String, enum: ['class', 'lab'], default: 'class' },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab' },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  session: String,
  fileUrl: String,
  dueDate: Date,
  maxMarks: { type: Number, default: 100 },
  isClosed: { type: Boolean, default: false },
  submissions: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    fileUrl: String,
    submittedAt: Date,
    marks: Number,
    feedback: String,
    resubmissionRequested: { type: Boolean, default: false },
  }],
}, { timestamps: true });

assignmentSchema.pre('validate', function(next) {
  const hasClass = this.itemType === 'class' && this.subjectId;
  const hasLab = this.itemType === 'lab' && this.labId;
  if (!hasClass && !hasLab) {
    return next(new Error('Assignment must be linked to a class subject or lab'));
  }
  next();
});

module.exports = mongoose.model('Assignment', assignmentSchema);
