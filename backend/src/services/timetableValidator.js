const mongoose = require('mongoose');
const TimetableEntry = require('../models/TimetableEntry');
const Subject = require('../models/Subject');
const Section = require('../models/Section');
const slotConfig = require('../../../shared/timetableSlots.json');
const academicConfig = require('../../../shared/academicConfig.json');

const getId = value => (value?._id || value)?.toString();

const withoutExcludedEntry = (excludeId) => {
  if (!excludeId) return {};
  return { _id: { $ne: new mongoose.Types.ObjectId(excludeId) } };
};

const describeSection = entry => {
  const section = entry.section || {};
  return section.sectionName
    ? `${section.department || ''} Year ${section.year || ''} Section ${section.sectionName}`.replace(/  +/g, ' ').trim()
    : `section ${getId(section) || 'unknown'}`;
};

const describeSubject = entry => {
  const subject = entry.subject || {};
  return subject.code || subject.name || `subject ${getId(subject) || 'unknown'}`;
};

const conflictQuery = (data, slots, resource) => ({
  [resource]: data[resource],
  day: data.day,
  slots: { $in: slots },
  ...withoutExcludedEntry(data.excludeId),
});

const loadConflicts = query => TimetableEntry.find(query)
  .populate('section', 'department year sectionName')
  .populate('subject', 'code name')
  .lean();

const duplicateKeyMessage = error => {
  if (error?.code !== 11000) return null;
  const key = Object.keys(error.keyPattern || error.keyValue || {}).join(', ');
  if (key.includes('faculty')) return 'Faculty conflict: this faculty is already booked for an overlapping slot.';
  if (key.includes('room')) return 'Room conflict: this room is already booked for an overlapping slot.';
  return 'Timetable conflict: another entry already occupies this slot.';
};

async function validateEntry(data, excludeId = null) {
  const errors = [];
  const entry = { ...data, excludeId };
  const slotCount = Number(data.slotCount);
  const startSlot = Number(data.startSlot);
  const slots = Number.isInteger(startSlot) && [1, 2].includes(slotCount)
    ? Array.from({ length: slotCount }, (_, index) => startSlot + index)
    : [];

  if (!Number.isInteger(startSlot) || !slotConfig.validSlotNumbers.includes(startSlot)) {
    errors.push('Slot range error: startSlot must be between 1 and 7.');
  }
  if (![1, 2].includes(slotCount)) {
    errors.push('Slot range error: slotCount must be 1 or 2.');
  }
  if (slots.length && slots[slots.length - 1] > 7) {
    errors.push('Slot range error: the timetable entry cannot extend beyond 4:00 PM - 5:00 PM.');
  }
  if (!slotConfig.validDays.includes(Number(data.day))) {
    errors.push('Day error: day must be between Monday (1) and Friday (5).');
  }

  let subject = null;
  let section = null;
  try {
    [subject, section] = await Promise.all([
      Subject.findById(data.subject).select('type code name').lean(),
      Section.findById(data.section).select('department year sectionName batches').lean(),
    ]);
  } catch (error) {
    errors.push(error.message || 'Subject or section could not be loaded.');
  }

  if (!subject) errors.push('Subject error: the selected subject does not exist.');
  if (!section) errors.push('Section error: the selected section does not exist.');
  if (section && !academicConfig.DEPARTMENTS.includes(section.department)) {
    errors.push('Academic validation error: department is not allowed.');
  }
  if (section && !academicConfig.YEARS.includes(Number(section.year))) {
    errors.push('Academic validation error: year is not allowed.');
  }
  if (section && !academicConfig.SECTIONS_BY_YEAR[String(section.year)]?.includes(section.sectionName)) {
    errors.push('Academic validation error: section is not allowed for the selected year.');
  }
  if (section && !academicConfig.SEMESTERS_BY_YEAR[String(section.year)]?.includes(Number(data.semester))) {
    errors.push('Academic validation error: semester is not allowed for the selected year.');
  }

  if (subject?.type === 'lab') {
    if (slotCount !== 2) errors.push('Lab rule: a lab must occupy exactly 2 slots.');
    if (startSlot === 3) errors.push('Lab rule: a lab cannot start at slot 3 because it would cross lunch.');
    if (data.batch === null || data.batch === undefined || data.batch === '') {
      errors.push('Lab rule: a lab entry must specify a batch.');
    }
  }
  if (subject?.type === 'theory') {
    if (slotCount !== 1) errors.push('Theory rule: a theory subject must occupy exactly 1 slot.');
    if (data.batch !== null && data.batch !== undefined && data.batch !== '') {
      errors.push('Theory rule: a theory entry must have batch set to null.');
    }
  }
  if (section && data.batch !== null && data.batch !== undefined && data.batch !== '' && !(section.batches || []).includes(data.batch)) {
    errors.push(`Batch error: batch ${data.batch} is not part of section ${section.sectionName}.`);
  }

  if (errors.length || !slots.length) return { valid: false, errors };

  try {
    const [facultyConflicts, roomConflicts, sectionConflicts] = await Promise.all([
      loadConflicts(conflictQuery(entry, slots, 'faculty')),
      loadConflicts(conflictQuery(entry, slots, 'room')),
      subject.type === 'theory'
        ? loadConflicts({ section: data.section, day: data.day, slots: { $in: slots }, ...withoutExcludedEntry(excludeId) })
        : loadConflicts({
          section: data.section,
          day: data.day,
          slots: { $in: slots },
          $or: [{ batch: data.batch }, { batch: null }, { batch: { $exists: false } }],
          ...withoutExcludedEntry(excludeId),
        }),
    ]);

    facultyConflicts.forEach(conflict => errors.push(
      `Faculty conflict: faculty is busy in ${describeSection(conflict)} for ${describeSubject(conflict)}.`,
    ));
    roomConflicts.forEach(conflict => errors.push(
      `Room conflict: room is already booked by ${describeSection(conflict)} for ${describeSubject(conflict)}.`,
    ));
    sectionConflicts.forEach(conflict => {
      if (subject.type === 'theory') {
        errors.push(`Section conflict: ${describeSection(conflict)} already has ${describeSubject(conflict)} in an overlapping slot.`);
      } else if (conflict.batch === null || conflict.batch === undefined) {
        errors.push(`Section conflict: ${describeSection(conflict)} has theory ${describeSubject(conflict)} in an overlapping slot.`);
      } else {
        errors.push(`Batch conflict: batch ${data.batch} is already scheduled for ${describeSubject(conflict)} in an overlapping slot.`);
      }
    });
  } catch (error) {
    const message = duplicateKeyMessage(error);
    errors.push(message || error.message || 'Unable to check timetable conflicts.');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateEntry, duplicateKeyMessage };