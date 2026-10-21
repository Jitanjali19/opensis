const mongoose = require('mongoose');

const facultyTeachingAssignmentSchema = new mongoose.Schema({
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  // 'class' assignments reference a Subject, 'lab' assignments reference a Lab.
  itemType: { type: String, enum: ['class', 'lab'], default: 'class' },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  labId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lab' },
  session: { type: String, required: true, trim: true },
  term: { type: String, enum: ['july-december', 'january-june'], required: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  branch: { type: String, required: true, trim: true },
  section: { type: String, trim: true, default: '' },
  // Optional descriptor, e.g. "Units 1-2" or "Lab batch A".
  note: { type: String, trim: true },
}, { timestamps: true, autoIndex: false });

facultyTeachingAssignmentSchema.index(
  { facultyId: 1, itemType: 1, subjectId: 1, labId: 1, session: 1, term: 1, section: 1 },
  { unique: true, name: 'teaching_assignment_unique' },
);

module.exports = mongoose.model('FacultyTeachingAssignment', facultyTeachingAssignmentSchema);
