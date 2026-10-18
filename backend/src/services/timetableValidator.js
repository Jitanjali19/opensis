const mongoose = require('mongoose');
const TimetableEntry = require('../models/TimetableEntry');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const Faculty = require('../models/Faculty');
const Section = require('../models/Section');
const Room = require('../models/Room');
const slotConfig = require('../../../shared/timetableSlots.json');
const academicConfig = require('../../../shared/academicConfig.json');
const roomConfig = require('../../../shared/roomConfig.json');

const getId = value => (value?._id || value)?.toString();

const withoutExcludedEntry = (excludeId) => {
  if (!excludeId) return {};
  return { _id: { $ne: new mongoose.Types.ObjectId(excludeId) } };
};

const describeSection = entry => {
  const section = entry.section || {};
  if (!section.sectionName) return `section ${getId(section) || 'unknown'}`;
  const department = academicConfig.DEPARTMENT_LABELS[section.department] || section.department || 'Unknown department';
  const year = Number(section.year);
  const yearLabel = year === 1 ? '1st' : year === 2 ? '2nd' : year === 3 ? '3rd' : year === 4 ? '4th' : `${year}th`;
  return `${department}, ${yearLabel} Year, Sem ${entry.semester || '—'}, Section ${section.sectionName}${entry.batch ? `, Batch ${entry.batch}` : ''}`;
};

const describeSubject = entry => {
  const subject = entry.subject || {};
  return subject.code || subject.name || `subject ${getId(subject) || 'unknown'}`;
};

const dayLabel = day => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][Number(day) - 1] || `Day ${day}`;
const formatTime = value => {
  const [rawHour, rawMinute] = String(value).split(':').map(Number);
  const suffix = rawHour >= 12 ? 'PM' : 'AM';
  const hour = rawHour % 12 || 12;
  return `${hour}:${String(rawMinute).padStart(2, '0')} ${suffix}`;
};
const timeRange = entry => {
  const start = Number(entry.startSlot || entry.slots?.[0]);
  const end = start + Number(entry.slotCount || entry.slots?.length || 1) - 1;
  return `${formatTime(slotConfig.slots[String(start)]?.start)}-${formatTime(slotConfig.slots[String(end)]?.end)}`;
};
const roomName = room => room?.name || (room?.building && room?.roomNo ? `${room.building}-${room.roomNo}` : 'Selected room');
const facultyName = faculty => faculty?.name || faculty?.email || `Faculty ${getId(faculty) || 'unknown'}`;

const conflictQuery = (data, slots, resource) => ({
  [resource]: data[resource],
  day: data.day,
  academicYear: data.academicYear,
  slots: { $in: slots },
  ...withoutExcludedEntry(data.excludeId),
});

const loadConflicts = query => TimetableEntry.find(query)
  .populate('section', 'department year sectionName')
  .populate('subject', 'code name')
  .populate('room', 'building roomNo name')
  .populate('faculty', 'email name')
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
  const badRequestErrors = [];
  const addError = (message, badRequest = false) => {
    errors.push(message);
    if (badRequest) badRequestErrors.push(message);
  };
  const entry = { ...data, excludeId };
  const startSlot = Number(data.startSlot);
  const requestedSlotCount = data.slotCount === undefined ? null : Number(data.slotCount);
  let slotCount = Number(data.slotCount);
  let slots = [];

  if (!Number.isInteger(startSlot) || !slotConfig.validSlotNumbers.includes(startSlot)) {
    addError('Slot range error: startSlot must be between 1 and 7.');
  }
  if (!slotConfig.validDays.includes(Number(data.day))) {
    addError('Day error: day must be between Monday (1) and Friday (5).');
  }

  let subject = null;
  let section = null;
  let room = null;
  try {
    [subject, section, room] = await Promise.all([
      (data.subjectType === 'Lab' ? Lab : Subject).findById(data.subject).select('type code name facultyId').lean(),
      Section.findById(data.section).select('department year sectionName batches').lean(),
      Room.findById(data.room).select('building roomNo name type').lean(),
    ]);
  } catch (error) {
    addError(error.message || 'Subject, section, or room could not be loaded.');
  }

  if (!subject) addError('Subject error: the selected subject does not exist.');
  if (subject && data.faculty && !data.showAllFaculty) {
    const facultyProfile = await Faculty.findOne({ userId: data.faculty }).select('_id').lean();
    if (!facultyProfile || !subject.facultyId || String(subject.facultyId) !== String(facultyProfile._id)) {
      addError('Faculty error: the selected faculty is not assigned to this subject.', true);
    }
  }
  const subjectKind = data.subjectType === 'Lab' ? 'lab' : subject?.type;
  if (subject) {
    slotCount = subjectKind === 'lab' ? 2 : 1;
    slots = Number.isInteger(startSlot)
      ? Array.from({ length: slotCount }, (_, index) => startSlot + index)
      : [];
  }
  if (slots.length && slots[slots.length - 1] > 7) {
    addError('Slot range error: the timetable entry cannot extend beyond 4:00 PM - 5:00 PM.');
  }
  if (!section) addError('Section error: the selected section does not exist.');
  if (!room) addError('Room error: the selected room does not exist.', true);
  if (room && (!roomConfig.BUILDINGS.includes(room.building) || !roomConfig.ROOMS_BY_BUILDING[room.building]?.includes(room.roomNo))) {
    addError('Room error: the selected building and room number are not configured.', true);
  }
  if (section && !academicConfig.DEPARTMENTS.includes(section.department)) {
    addError('Academic validation error: department is not allowed.', true);
  }
  if (section && !academicConfig.YEARS.includes(Number(section.year))) {
    addError('Academic validation error: year is not allowed.', true);
  }
  if (section && !academicConfig.SECTIONS_BY_YEAR[String(section.year)]?.includes(section.sectionName)) {
    addError('Academic validation error: section is not allowed for the selected year.', true);
  }
  if (section && !academicConfig.SEMESTERS_BY_YEAR[String(section.year)]?.includes(Number(data.semester))) {
    addError('Academic validation error: semester is not allowed for the selected year.', true);
  }

  if (subjectKind === 'lab') {
    if (requestedSlotCount !== null && requestedSlotCount !== 2) addError('Lab rule: a lab must occupy exactly 2 slots.');
    if (startSlot === 3) addError('Lab rule: a lab cannot start at slot 3 because it would cross lunch.');
    if (data.batch === null || data.batch === undefined || data.batch === '') {
      addError('Lab rule: a lab entry must specify a batch.');
    }
  }
  if (subjectKind === 'theory') {
    if (requestedSlotCount !== null && requestedSlotCount !== 1) addError('Theory rule: a theory subject must occupy exactly 1 slot.');
    if (data.batch !== null && data.batch !== undefined && data.batch !== '') {
      addError('Theory rule: a theory entry must have batch set to null.');
    }
  }
  if (section && data.batch !== null && data.batch !== undefined && data.batch !== '' && !(section.batches || []).includes(data.batch)) {
    addError(`Batch error: batch ${data.batch} is not part of section ${section.sectionName}.`);
  }

  if (errors.length || !slots.length) {
    const result = { valid: false, errors, badRequestErrors };
    Object.defineProperties(result, {
      slotCount: { value: slotCount },
      slots: { value: slots },
    });
    return result;
  }

  try {
    const [facultyConflicts, roomConflicts, sectionConflicts] = await Promise.all([
      loadConflicts(conflictQuery(entry, slots, 'faculty')),
      loadConflicts(conflictQuery(entry, slots, 'room')),
      subjectKind === 'theory'
        ? loadConflicts({ section: data.section, academicYear: data.academicYear, day: data.day, slots: { $in: slots }, ...withoutExcludedEntry(excludeId) })
        : loadConflicts({
          section: data.section,
          academicYear: data.academicYear,
          day: data.day,
          slots: { $in: slots },
          $or: [{ batch: data.batch }, { batch: null }, { batch: { $exists: false } }],
          ...withoutExcludedEntry(excludeId),
        }),
    ]);

    facultyConflicts.forEach(conflict => errors.push(
      `${facultyName(conflict.faculty)} is already assigned on ${dayLabel(conflict.day)} ${timeRange(conflict)} to ${describeSection(conflict)} (Subject: ${describeSubject(conflict)}).`,
    ));
    roomConflicts.forEach(conflict => errors.push(
      `${roomName(conflict.room)} is already allocated on ${dayLabel(conflict.day)} ${timeRange(conflict)} to ${describeSection(conflict)} (Subject: ${describeSubject(conflict)}).`,
    ));
    sectionConflicts.forEach(conflict => {
      if (subjectKind === 'theory') {
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

  const result = { valid: errors.length === 0, errors };
  Object.defineProperties(result, {
    slotCount: { value: slotCount },
    slots: { value: slots },
  });
  if (badRequestErrors.length) result.badRequestErrors = badRequestErrors;
  return result;
}

module.exports = { validateEntry, duplicateKeyMessage };