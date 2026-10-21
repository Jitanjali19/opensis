const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true },
  audience: { type: String, enum: ['all', 'students', 'faculty'], default: 'all' },
  session: { type: String, trim: true },
  term: { type: String, enum: ['july-december', 'january-june'] },
  targetStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  attachments: [String],
  isPinned: { type: Boolean, default: false },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Notice', noticeSchema);
