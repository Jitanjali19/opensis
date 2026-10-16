const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  department: { type: String, required: true, trim: true },
  year: {
    type: Number,
    required: true,
    min: 1,
    max: 4,
    validate: { validator: Number.isInteger, message: 'Year must be an integer between 1 and 4' },
  },
  sectionName: { type: String, required: true, trim: true },
  batches: [{ type: String, trim: true }],
}, { timestamps: true });

sectionSchema.index({ department: 1, year: 1, sectionName: 1 }, { unique: true });

module.exports = mongoose.model('Section', sectionSchema);