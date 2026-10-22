const mongoose = require('mongoose');

const labSchema = new mongoose.Schema({
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  branch: { type: String, required: true, trim: true, uppercase: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
  year: { type: Number, min: 1, max: 4 },  // optional, derived from semester
  // Academic session the lab belongs to (optional for legacy records).
  session: { type: String, trim: true },
  l: { type: Number, default: 0, min: 0 },
  t: { type: Number, default: 0, min: 0 },
  p: { type: Number, default: 0, min: 0 },
  credits: { type: Number, default: 1 },
  // Marks structure per scheme
  theoryEndMax:    { type: Number, default: 0,  min: 0 },
  cwMax:           { type: Number, default: 0,  min: 0 },
  practicalEndMax: { type: Number, default: 60, min: 0 },
  swMax:           { type: Number, default: 40, min: 0 },
  syllabusText: { type: String, trim: true },
  syllabusFile: { type: String, trim: true },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
  // Year 1 common scheme — if true this lab appears for ALL departments
  isCommon: { type: Boolean, default: false },
}, { timestamps: true, autoIndex: false });

// Composite uniqueness per session+branch+semester+code. Created through the
// controlled migration (see src/migrations/academicScheme.js), not autoIndex.
labSchema.index(
  { session: 1, branch: 1, semester: 1, code: 1 },
  { unique: true, name: 'scheme_session_branch_semester_code' },
);

module.exports = mongoose.model('Lab', labSchema);
