const mongoose = require('mongoose');
const slotConfig = require('../../../shared/timetableSlots.json');
const User = require('./User');
const Subject = require('./Subject');
const Section = require('./Section');
const Room = require('./Room');
const Lab = require('./Lab');

const timetableEntrySchema = new mongoose.Schema({
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  batch: { type: String, trim: true, default: null },
  day: { type: Number, required: true, enum: slotConfig.validDays },
  startSlot: { type: Number, required: true, enum: slotConfig.validSlotNumbers },
  slotCount: { type: Number, required: true, enum: [1, 2] },
  slots: { type: [Number], required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, refPath: 'subjectType', required: true },
  subjectType: { type: String, enum: ['Subject', 'Lab'], default: 'Subject' },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  academicYear: { type: String, required: true, trim: true },
  semester: { type: Number, required: true, min: 1, max: 8 },
}, { timestamps: true });

timetableEntrySchema.index({ academicYear: 1, faculty: 1, day: 1, slots: 1 }, { unique: true });
timetableEntrySchema.index({ academicYear: 1, room: 1, day: 1, slots: 1 }, { unique: true });
timetableEntrySchema.index({ section: 1, day: 1 });

timetableEntrySchema.pre('validate', async function calculateAndValidateSlots() {
  const SubjectModel = this.subjectType === 'Lab' ? Lab : Subject;
  const subject = await SubjectModel.findById(this.subject).select('type').lean();
  if (!subject) {
    this.invalidate('subject', 'Subject does not exist');
  }

  const faculty = await User.findOne({ _id: this.faculty, role: 'faculty', isActive: true }).select('_id').lean();
  if (!faculty) this.invalidate('faculty', 'Faculty must reference an active faculty User');

  const section = await Section.findById(this.section).select('batches').lean();
  if (!section) {
    this.invalidate('section', 'Section does not exist');
  }

  const room = await Room.findById(this.room).select('type').lean();
  if (!room) {
    this.invalidate('room', 'Room does not exist');
  }

  if (this.batch === '') this.batch = null;
  if (section && this.batch !== null && this.batch !== undefined && !(section.batches || []).includes(this.batch)) {
    this.invalidate('batch', 'Batch does not belong to the selected section');
  }

  const subjectKind = this.subjectType === 'Lab' ? 'lab' : subject?.type;
  if (subjectKind === 'theory' && this.slotCount !== 1) {
    this.invalidate('slotCount', 'Theory subjects must occupy exactly one slot');
  }
  if (subjectKind === 'lab' && this.slotCount !== 2) {
    this.invalidate('slotCount', 'Lab subjects must occupy exactly two consecutive slots');
  }
  if (subjectKind === 'lab' && (this.batch === null || this.batch === undefined)) {
    this.invalidate('batch', 'Lab entries must target a section batch');
  }
  if (this.slotCount === 2 && this.startSlot === 3) {
    this.invalidate('startSlot', 'A lab cannot cross the lunch break');
  }
  if (Number.isInteger(this.startSlot) && Number.isInteger(this.slotCount) && this.startSlot + this.slotCount - 1 > 7) {
    this.invalidate('startSlot', 'The entry must fit within the college timetable');
  }
  if (subjectKind === 'theory' && this.batch !== null && this.batch !== undefined) {
    this.invalidate('batch', 'Theory entries must apply to the whole section');
  }
  if (room && subject && room.type !== (subjectKind === 'lab' ? 'lab' : 'classroom')) {
    this.invalidate('room', `${subjectKind} subjects require a matching room type`);
  }

  if (subject) {
    this.slotCount = subjectKind === 'lab' ? 2 : 1;
  }
  if (Number.isInteger(this.startSlot) && [1, 2].includes(this.slotCount)) {
    this.slots = Array.from({ length: this.slotCount }, (_, index) => this.startSlot + index);
  }
});

module.exports = mongoose.model('TimetableEntry', timetableEntrySchema);