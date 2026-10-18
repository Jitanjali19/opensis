jest.mock('../src/models/Student', () => ({ findOne: jest.fn() }));
jest.mock('../src/models/Section', () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock('../src/models/TimetableEntry', () => ({ distinct: jest.fn(), find: jest.fn() }));
jest.mock('../src/models/Faculty', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../src/models/Subject', () => ({ find: jest.fn() }));
jest.mock('../src/models/Lab', () => ({ find: jest.fn() }));

const Student = require('../src/models/Student');
const Section = require('../src/models/Section');
const TimetableEntry = require('../src/models/TimetableEntry');
const Faculty = require('../src/models/Faculty');
const User = require('../src/models/User');
const Subject = require('../src/models/Subject');
const Lab = require('../src/models/Lab');
const { getStudentTimetable, getFacultyTimetable } = require('../src/services/timetableData');

const selectLean = value => ({ select: () => ({ lean: async () => value }) });
const timetableQuery = entries => {
  const query = {
    sort: () => query,
    populate: () => query,
    lean: async () => entries,
  };
  return query;
};

beforeEach(() => {
  jest.clearAllMocks();
  TimetableEntry.distinct.mockImplementation(async (field) => (field === 'academicYear' ? ['2027-2028'] : [7]));
  TimetableEntry.find.mockReturnValue(timetableQuery([]));
  Faculty.find.mockReturnValue(selectLean([]));
  Faculty.findOne.mockReturnValue(selectLean({ firstName: 'Faculty', lastName: 'One' }));
  User.findById.mockReturnValue(selectLean({ email: 'faculty@example.com' }));
  Subject.find.mockReturnValue(selectLean([]));
  Lab.find.mockReturnValue(selectLean([]));
});

test('students from two sections query every batch in their matching section', async () => {
  const sectionX = { _id: 'section-x', department: 'IT', year: 4, sectionName: 'A', batches: ['A1', 'A2'] };
  const sectionY = { _id: 'section-y', department: 'CSE', year: 3, sectionName: 'B', batches: ['A1', 'A2'] };
  Section.find
    .mockReturnValueOnce(selectLean([sectionX]))
    .mockReturnValueOnce(selectLean([sectionY]));
  Student.findOne
    .mockReturnValueOnce(selectLean({ firstName: 'X', branch: 'IT', year: 4, section: 'A', batch: 'A1', currentSemester: 7 }))
    .mockReturnValueOnce(selectLean({ firstName: 'Y', branch: 'CSE', year: 3, section: 'B', batch: 'A2', currentSemester: 5 }));

  await getStudentTimetable('student-x', { academicYear: '2027-2028', semester: '7' });
  await getStudentTimetable('student-y', { academicYear: '2027-2028', semester: '5' });

  expect(TimetableEntry.find).toHaveBeenNthCalledWith(1, expect.objectContaining({
    section: { $in: ['section-x'] },
    academicYear: '2027-2028',
    semester: 7,
  }));
  expect(TimetableEntry.find).toHaveBeenNthCalledWith(2, expect.objectContaining({
    section: { $in: ['section-y'] },
    academicYear: '2027-2028',
    semester: 5,
  }));
});

test('faculty timetable is scoped only by the authenticated faculty id', async () => {
  await getFacultyTimetable('faculty-a', { academicYear: '2027-2028' });
  await getFacultyTimetable('faculty-b', { academicYear: '2027-2028' });

  expect(TimetableEntry.find).toHaveBeenNthCalledWith(1, {
    faculty: 'faculty-a',
    academicYear: '2027-2028',
  });
  expect(TimetableEntry.find).toHaveBeenNthCalledWith(2, {
    faculty: 'faculty-b',
    academicYear: '2027-2028',
  });
});
