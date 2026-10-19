const mongoose = require('mongoose');

const feedbackConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'default' },
  isOpen: { type: Boolean, default: true },
  startsAt: Date,
  endsAt: Date,
  requireCommentForLowRating: { type: Boolean, default: true },
  criteria: [{
    key: { type: String, required: true },
    label: { type: String, required: true },
    enabled: { type: Boolean, default: true },
  }],
}, { timestamps: true });

module.exports = mongoose.model('FeedbackConfig', feedbackConfigSchema);
