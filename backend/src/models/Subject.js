const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['theory', 'lab'], default: 'theory' },
  branch: { type: String, required: true, trim: true, uppercase: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  // Academic session the subject belongs to (e.g. "2025-2026"). Optional so that
  // records created before the scheme feature remain readable as legacy data.
  session: { type: String, trim: true },
  // Scheme metadata
  category: { type: String, trim: true, uppercase: true, default: 'PCC' },
  l: { type: Number, default: 0, min: 0 },
  t: { type: Number, default: 0, min: 0 },
  p: { type: Number, default: 0, min: 0 },
  credits: { type: Number, default: 3 },
  // Marks structure per the scheme document
  theoryEndMax: { type: Number, default: 70, min: 0 },  // Theory / End-Sem marks
  cwMax:        { type: Number, default: 30, min: 0 },  // CW / Internal marks
  practicalEndMax: { type: Number, default: 0, min: 0 }, // Practical / End-Sem
  swMax:        { type: Number, default: 0, min: 0 },  // SW / Sessional Work
  syllabusText: { type: String, trim: true },
  syllabusFile: { type: String, trim: true },
  electiveOptions: [{ type: String, trim: true }],
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
  // Year 1 common scheme — if true this subject appears for ALL departments
  isCommon: { type: Boolean, default: false },
}, { timestamps: true, autoIndex: false });

// Composite uniqueness per session+branch+semester+code. Created through the
// controlled migration (see src/migrations/academicScheme.js), not autoIndex.
subjectSchema.index(
  { session: 1, branch: 1, semester: 1, code: 1 },
  { unique: true, name: 'scheme_session_branch_semester_code' },
);

module.exports = mongoose.model('Subject', subjectSchema);
