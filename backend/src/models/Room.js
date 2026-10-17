const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  building: { type: String, enum: ['ATC', 'LT'], required: true, uppercase: true, trim: true },
  roomNo: { type: String, required: true, trim: true },
  name: { type: String, trim: true },
  type: { type: String, enum: ['classroom', 'lab'], default: 'classroom' },
}, { timestamps: true });

roomSchema.index({ building: 1, roomNo: 1 }, { unique: true });

roomSchema.virtual('displayName').get(function getDisplayName() {
  return this.name || `${this.building}-${this.roomNo}`;
});

roomSchema.set('toJSON', { virtuals: true });
roomSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Room', roomSchema);