const STUDENT_ID = '507f191e810c19729de860ea';
const SUBJECT_ID = '507f1f77bcf86cd7994390aa';
const LAB_ID = '507f1f77bcf86cd799439011';
const SESSION = '2025-2026';

jest.mock('../src/models/Student', () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock('../src/models/Attendance', () => ({ find: jest.fn(), findOne: jest.fn(), updateMany: jest.fn() }));
jest.mock('../src/models/Assignment', () => ({}));
jest.mock('../src/models/Notice', () => ({ find: jest.fn(), updateMany: jest.fn() }));
jest.mock('../src/models/ExamTimetable', () => ({}));
jest.mock('../src/models/Result', () => ({}));
jest.mock('../src/models/Subject', () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock('../src/models/Lab', () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock('../src/models/FacultyTeachingAssignment', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../src/models/Fee', () => ({}));
jest.mock('../src/models/LibraryIssue', () => ({}));
jest.mock('../src/models/LibraryBook', () => ({}));
jest.mock('../src/models/Feedback', () => ({}));
jest.mock('../src/models/FeedbackConfig', () => ({ findOne: jest.fn() }));
jest.mock('../src/models/Faculty', () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock('../src/models/RevaluationRequest', () => ({}));
jest.mock('../src/models/Section', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../src/models/TimetableEntry', () => ({ find: jest.fn() }));
jest.mock('../src/models/AdmitCard', () => ({ find: jest.fn(), findOne: jest.fn() }));

const Student = require('../src/models/Student');
const Attendance = require('../src/models/Attendance');
const studentController = require('../src/controllers/studentController');

const makeQuery = (value) => {
  const query = {
    sort: jest.fn(() => query),
    select: jest.fn(() => query),
    populate: jest.fn(() => query),
    distinct: jest.fn(async () => value),
    lean: jest.fn(async () => value),
  };
  return query;
};

const createRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });
  return res;
};

const student = { _id: STUDENT_ID, session: SESSION, currentSemester: 5, branch: 'CSE', section: 'A' };

const classSheet = {
  _id: 'sheet-class',
  itemType: 'class',
  subjectId: { _id: SUBJECT_ID, code: 'CS301', name: 'DBMS' },
  labId: null,
  batch: '',
  date: new Date(2025, 8, 1),
  records: [{ studentId: STUDENT_ID, status: 'present' }],
};

const labSheet = {
  _id: 'sheet-lab',
  itemType: 'lab',
  subjectId: null,
  labId: { _id: LAB_ID, code: 'CSL301', name: 'DBMS Lab' },
  batch: 'A1',
  date: new Date(2025, 8, 1),
  records: [{ studentId: STUDENT_ID, status: 'absent' }],
};

const legacyLabSheet = {
  _id: 'sheet-lab-legacy',
  itemType: 'lab',
  subjectId: null,
  labId: { _id: LAB_ID, code: 'CSL301', name: 'DBMS Lab' },
  batch: '',
  date: new Date(2025, 8, 1),
  records: [{ studentId: STUDENT_ID, status: 'present' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  Student.findOne.mockResolvedValue(student);
});

describe('student attendance view', () => {
  test('separates theory and practical attendance', async () => {
    Attendance.find.mockReturnValue(makeQuery([classSheet, labSheet]));

    const res = createRes();
    await studentController.getAttendance({
      user: { _id: 'student-user' },
      academicSession: SESSION,
      academicTerm: 'july-december',
      academicHistory: null,
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.summary.class).toMatchObject({ total: 1, present: 1, absent: 0, percentage: 100 });
    expect(res.body.data.summary.lab).toMatchObject({ total: 1, present: 0, absent: 1, percentage: 0 });
    expect(res.body.data.summary.overall).toMatchObject({ total: 2, present: 1, percentage: 50 });
  });

  test('labels the lab entry with its batch', async () => {
    Attendance.find.mockReturnValue(makeQuery([labSheet]));

    const res = createRes();
    await studentController.getAttendance({
      user: { _id: 'student-user' },
      academicSession: SESSION,
      academicTerm: 'july-december',
      academicHistory: null,
    }, res);

    const labEntry = res.body.data.attendance.find(a => a.itemType === 'lab');
    expect(labEntry.batch).toBe('A1');
    expect(labEntry.batches).toEqual(['A1']);
  });

  test('counts a legacy and a batched lab sheet of the same date only once', async () => {
    Attendance.find.mockReturnValue(makeQuery([legacyLabSheet, labSheet]));

    const res = createRes();
    await studentController.getAttendance({
      user: { _id: 'student-user' },
      academicSession: SESSION,
      academicTerm: 'july-december',
      academicHistory: null,
    }, res);

    expect(res.body.data.summary.lab.total).toBe(1);
    const labEntry = res.body.data.attendance.find(a => a.itemType === 'lab');
    expect(labEntry.batch).toBe('A1');
    expect(labEntry.dates).toHaveLength(1);
  });

  test('returns empty summaries when no attendance exists', async () => {
    Attendance.find.mockReturnValue(makeQuery([]));

    const res = createRes();
    await studentController.getAttendance({
      user: { _id: 'student-user' },
      academicSession: SESSION,
      academicTerm: 'july-december',
      academicHistory: null,
    }, res);

    expect(res.body.data.attendance).toEqual([]);
    expect(res.body.data.summary.class).toMatchObject({ total: 0, percentage: 0 });
    expect(res.body.data.summary.lab).toMatchObject({ total: 0, percentage: 0 });
  });
});
