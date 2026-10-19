const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['theory', 'lab'], default: 'theory' },
  branch: { type: String, required: true },
  semester: { type: Number, required: true },
  credits: { type: Number, default: 3 },
  facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
