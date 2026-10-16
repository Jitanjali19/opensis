const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  type: { type: String, enum: ['classroom', 'lab'], required: true },
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);