jest.mock('../src/models/TimetableEntry', () => ({
  find: jest.fn(),
}));
jest.mock('../src/models/Subject', () => ({
  findById: jest.fn(),
}));
jest.mock('../src/models/Section', () => ({
  findById: jest.fn(),
}));
jest.mock('../src/models/Room', () => ({
  findById: jest.fn(),
}));

const TimetableEntry = require('../src/models/TimetableEntry');
const Subject = require('../src/models/Subject');
const Section = require('../src/models/Section');
const Room = require('../src/models/Room');
const mongoose = require('mongoose');
const { validateEntry, duplicateKeyMessage } = require('../src/services/timetableValidator');

const queryWithResult = result => ({
  select: () => ({ lean: async () => result }),
});

const conflictQueryWithResult = result => {
  const query = {
    populate: () => query,
    lean: async () => result,
  };
  return query;
};

const baseEntry = overrides => ({
  section: 'section-1',
  batch: null,
  day: 1,
  startSlot: 1,
  slotCount: 1,
  subject: 'subject-1',
  faculty: 'faculty-1',
  room: 'room-1',
  academicYear: '2026-2027',
  semester: 5,
  ...overrides,
});

function arrange({ subjectType = 'theory', batches = ['A1', 'A2'], conflicts = [[], [], []] } = {}) {
  Subject.findById.mockReturnValue(queryWithResult({ type: subjectType, code: 'CS101', name: 'Algorithms' }));
  Section.findById.mockReturnValue(queryWithResult({ department: 'IT', year: 3, sectionName: 'A', batches }));
  Room.findById.mockReturnValue(queryWithResult({ building: 'ATC', roomNo: '101', name: 'ATC-101', type: 'classroom' }));
  conflicts.forEach(conflict => TimetableEntry.find.mockReturnValueOnce(conflictQueryWithResult(conflict)));
}

afterEach(() => jest.resetAllMocks());

test('rejects a lab that crosses lunch from slot 3 to slot 4', async () => {
  arrange({ subjectType: 'lab' });
  const result = await validateEntry(baseEntry({ batch: 'A1', startSlot: 3, slotCount: 2 }));
  expect(result.valid).toBe(false);
  expect(result.errors).toContain('Lab rule: a lab cannot start at slot 3 because it would cross lunch.');
  expect(TimetableEntry.find).not.toHaveBeenCalled();
});

test('reports a faculty double booking with section and subject', async () => {
  arrange({ conflicts: [[{
    day: 1,
    startSlot: 1,
    slotCount: 1,
    semester: 5,
    faculty: { email: 'Prof MK' },
    section: { department: 'CSE', year: 2, sectionName: 'B' },
    subject: { code: 'DB201' },
  }], [], []] });
  const result = await validateEntry(baseEntry());
  expect(result.errors).toContain('Prof MK is already assigned on Monday 9:00 AM-10:00 AM to Computer Science, 2nd Year, Sem 5, Section B (Subject: DB201).');
});

test('reports a room clash', async () => {
  arrange({ conflicts: [[], [{
    day: 1,
    startSlot: 1,
    slotCount: 1,
    semester: 5,
    room: { name: 'ATC-101' },
    section: { department: 'IT', year: 3, sectionName: 'C' },
    subject: { name: 'Networks' },
  }], []] });
  const result = await validateEntry(baseEntry());
  expect(result.errors).toContain('ATC-101 is already allocated on Monday 9:00 AM-10:00 AM to Information Technology, 3rd Year, Sem 5, Section C (Subject: Networks).');
});

test('reports a theory entry against any existing batch in the section', async () => {
  arrange({ conflicts: [[], [], [{
    batch: 'A1',
    section: { department: 'IT', year: 3, sectionName: 'A' },
    subject: { code: 'OS301' },
  }]] });
  const result = await validateEntry(baseEntry());
  expect(result.errors).toContain('Section conflict: Information Technology, 3rd Year, Sem —, Section A, Batch A1 already has OS301 in an overlapping slot.');
});

test('allows A1 and A2 labs at the same time in different rooms', async () => {
  arrange({ subjectType: 'lab' });
  const result = await validateEntry(baseEntry({ batch: 'A1', startSlot: 5, slotCount: 2 }));
  expect(result).toEqual({ valid: true, errors: [] });
});

test('ignores the entry being edited', async () => {
  arrange();
  const result = await validateEntry(baseEntry(), '507f1f77bcf86cd799439011');
  expect(result.valid).toBe(true);
  expect(TimetableEntry.find).toHaveBeenCalledWith(expect.objectContaining({
    _id: { $ne: expect.any(mongoose.Types.ObjectId) },
  }));
});

test('rejects a batch that is not part of the section', async () => {
  arrange({ subjectType: 'lab' });
  const result = await validateEntry(baseEntry({ batch: 'B9', slotCount: 2 }));
  expect(result.errors).toContain('Batch error: batch B9 is not part of section A.');
  expect(TimetableEntry.find).not.toHaveBeenCalled();
});

test('rejects an entry extending beyond the final slot', async () => {
  arrange({ subjectType: 'lab' });
  const result = await validateEntry(baseEntry({ batch: 'A1', startSlot: 7, slotCount: 2 }));
  expect(result.errors).toContain('Slot range error: the timetable entry cannot extend beyond 4:00 PM - 5:00 PM.');
});

test('rejects a theory entry with a batch', async () => {
  arrange();
  const result = await validateEntry(baseEntry({ batch: 'A1' }));
  expect(result.errors).toContain('Theory rule: a theory entry must have batch set to null.');
  expect(TimetableEntry.find).not.toHaveBeenCalled();
});

test('rejects a semester that does not belong to the section year', async () => {
  arrange();
  const result = await validateEntry(baseEntry({ semester: 3 }));
  expect(result.errors).toContain('Academic validation error: semester is not allowed for the selected year.');
  expect(TimetableEntry.find).not.toHaveBeenCalled();
});

test('rejects a section name that is not allowed for its year', async () => {
  arrange();
  Section.findById.mockReturnValue(queryWithResult({ department: 'IT', year: 3, sectionName: 'N', batches: ['A1'] }));
  const result = await validateEntry(baseEntry({ batch: null }));
  expect(result.errors).toContain('Academic validation error: section is not allowed for the selected year.');
  expect(TimetableEntry.find).not.toHaveBeenCalled();
});

test('converts duplicate faculty and room keys into conflict messages', () => {
  expect(duplicateKeyMessage({ code: 11000, keyPattern: { faculty: 1, day: 1, slots: 1 } }))
    .toBe('Faculty conflict: this faculty is already booked for an overlapping slot.');
  expect(duplicateKeyMessage({ code: 11000, keyPattern: { room: 1, day: 1, slots: 1 } }))
    .toBe('Room conflict: this room is already booked for an overlapping slot.');
});
