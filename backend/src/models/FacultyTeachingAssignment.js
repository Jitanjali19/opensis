const mongoose = require('mongoose');

const facultyTeachingAssignmentSchema = new mongoose.Schema({
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  session: { type: String, required: true, trim: true },
  term: { type: String, enum: ['july-december', 'january-june'], required: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  branch: { type: String, required: true, trim: true },
  section: { type: String, trim: true, default: '' },
}, { timestamps: true });

facultyTeachingAssignmentSchema.index(
  { facultyId: 1, subjectId: 1, session: 1, term: 1, section: 1 },
  { unique: true },
);

module.exports = mongoose.model('FacultyTeachingAssignment', facultyTeachingAssignmentSchema);
