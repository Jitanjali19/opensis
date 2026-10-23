const LAB_ID = '507f1f77bcf86cd799439011';
const LAB_ID_OTHER = '507f1f77bcf86cd799439099';
const STUDENT_A = '507f191e810c19729de860ea';
const STUDENT_B = '507f191e810c19729de860eb';
const STUDENT_C = '507f191e810c19729de860ec';
const SESSION = '2025-2026';
const TERM = 'july-december';
const FACULTY_ID = '507f1f77bcf86cd799439001';

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: { ...actual.promises, mkdir: jest.fn(async () => undefined) },
  };
});

jest.mock('exceljs', () => {
  class FakeWorksheet {
    constructor() {
      this.rows = [];
    }

    getRow() {
      return this;
    }

    addRow(row) {
      this.rows.push(row);
      return {
        eachCell: jest.fn(),
        getCell: jest.fn(() => ({})),
      };
    }
  }

  class FakeWorkbook {
    constructor() {
      this.worksheets = [];
      this.xlsx = {
        write: jest.fn(async () => undefined),
        writeFile: jest.fn(async () => undefined),
      };
    }

    addWorksheet(name) {
      const ws = new FakeWorksheet();
      ws.name = name;
      this.worksheets.push(ws);
      return ws;
    }
  }

  return { Workbook: FakeWorkbook };
});

jest.mock('../src/models/Faculty', () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock('../src/models/Subject', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../src/models/Lab', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../src/models/Attendance', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
  updateMany: jest.fn(),
}));
jest.mock('../src/models/Notice', () => ({ create: jest.fn(), find: jest.fn(), updateMany: jest.fn() }));
jest.mock('../src/models/Student', () => ({ find: jest.fn(), findOne: jest.fn(), findById: jest.fn() }));
jest.mock('../src/models/LabBatch', () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock('../src/models/FacultyTeachingAssignment', () => ({ exists: jest.fn(), findOne: jest.fn() }));
jest.mock('../src/models/StudentAcademicHistory', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../src/models/Section', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../src/models/User', () => ({ findOne: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../src/models/Assignment', () => ({}));
jest.mock('../src/models/Result', () => ({}));
jest.mock('../src/models/Feedback', () => ({}));
jest.mock('../src/models/TimetableEntry', () => ({}));

const Faculty = require('../src/models/Faculty');
const Subject = require('../src/models/Subject');
const Lab = require('../src/models/Lab');
const Attendance = require('../src/models/Attendance');
const Notice = require('../src/models/Notice');
const Student = require('../src/models/Student');
const LabBatch = require('../src/models/LabBatch');
const FacultyTeachingAssignment = require('../src/models/FacultyTeachingAssignment');
const StudentAcademicHistory = require('../src/models/StudentAcademicHistory');
const facultyController = require('../src/controllers/facultyController');

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
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });
  res.setHeader = jest.fn((key, value) => {
    res.headers[key] = value;
  });
  res.end = jest.fn(() => res);
  return res;
};

const faculty = { _id: FACULTY_ID, firstName: 'Fac', lastName: 'ulty' };
const lab = { _id: LAB_ID, code: 'CSL301', name: 'DBMS Lab', branch: 'CSE', semester: 5 };
const subject = { _id: '507f1f77bcf86cd7994390aa', code: 'CS301', name: 'DBMS', branch: 'CSE', semester: 5 };

const students = [
  { _id: STUDENT_A, firstName: 'A', lastName: 'One', enrollmentNo: '2300101', branch: 'CSE', currentSemester: 5 },
  { _id: STUDENT_B, firstName: 'B', lastName: 'Two', enrollmentNo: '2300102', branch: 'CSE', currentSemester: 5 },
  { _id: STUDENT_C, firstName: 'C', lastName: 'Three', enrollmentNo: '2300103', branch: 'CSE', currentSemester: 5 },
];

const batchDoc = {
  labId: LAB_ID,
  session: SESSION,
  batches: [
    { batchName: 'A1', studentIds: [STUDENT_A, STUDENT_B] },
    { batchName: 'A2', studentIds: [STUDENT_C] },
  ],
};

const req = (overrides = {}) => ({
  user: { _id: 'faculty-user-id' },
  academicSession: SESSION,
  academicTerm: TERM,
  params: {},
  query: {},
  body: {},
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();

  Faculty.findOne.mockReturnValue(makeQuery(faculty));
  Lab.findById.mockImplementation((id) => makeQuery(String(id) === LAB_ID ? lab : null));
  Subject.findById.mockImplementation(() => makeQuery(subject));
  LabBatch.findOne.mockImplementation(() => makeQuery(batchDoc));
  FacultyTeachingAssignment.exists.mockResolvedValue(true);
  StudentAcademicHistory.find.mockImplementation(() => makeQuery([]));

  Student.find.mockImplementation((filter = {}) => {
    let result = students;
    if (filter._id && filter._id.$in) {
      const ids = filter._id.$in.map(String);
      result = result.filter(s => ids.includes(String(s._id)));
    }
    if (filter.branch) result = result.filter(s => s.branch === filter.branch);
    if (filter.currentSemester !== undefined) {
      result = result.filter(s => s.currentSemester === filter.currentSemester);
    }
    return makeQuery(result);
  });

  Attendance.find.mockReturnValue(makeQuery([]));
  Attendance.findOne.mockResolvedValue(null);
  Attendance.create.mockImplementation(async (payload) => payload);
});

describe('faculty lab batch attendance', () => {
  test('rejects lab attendance when no batch is selected', async () => {
    const res = createRes();
    await facultyController.markAttendance(req({
      body: { labId: LAB_ID, itemType: 'lab', date: '2025-09-01', records: [{ studentId: STUDENT_A, status: 'present' }] },
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/select a batch/i);
    expect(Attendance.create).not.toHaveBeenCalled();
  });

  test('rejects a batch that is not configured for the lab', async () => {
    const res = createRes();
    await facultyController.markAttendance(req({
      body: { labId: LAB_ID, itemType: 'lab', batch: 'B9', date: '2025-09-01', records: [{ studentId: STUDENT_A, status: 'present' }] },
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/not configured for this lab/i);
    expect(Attendance.create).not.toHaveBeenCalled();
  });

  test('rejects a lab id that is not a valid ObjectId', async () => {
    const res = createRes();
    await facultyController.markAttendance(req({
      body: { labId: 'not-an-id', itemType: 'lab', batch: 'A1', date: '2025-09-01', records: [] },
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/invalid lab id/i);
  });

  test('rejects students that are not part of the selected batch', async () => {
    const res = createRes();
    await facultyController.markAttendance(req({
      body: {
        labId: LAB_ID,
        itemType: 'lab',
        batch: 'A1',
        date: '2025-09-01',
        records: [
          { studentId: STUDENT_A, status: 'present' },
          { studentId: STUDENT_C, status: 'present' },
        ],
      },
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/not assigned to batch "A1"/i);
    expect(Attendance.create).not.toHaveBeenCalled();
  });

  test('stores lab attendance per batch so batches never overwrite each other', async () => {
    const res = createRes();
    await facultyController.markAttendance(req({
      body: {
        labId: LAB_ID,
        itemType: 'lab',
        batch: 'A1',
        date: '2025-09-01',
        records: [
          { studentId: STUDENT_A, status: 'present' },
          { studentId: STUDENT_B, status: 'absent' },
        ],
      },
    }), res);

    expect(res.statusCode).toBe(201);
    expect(Attendance.findOne).toHaveBeenCalledWith(expect.objectContaining({
      labId: LAB_ID,
      itemType: 'lab',
      batch: 'A1',
      session: SESSION,
      date: expect.any(Date),
    }));
    const lookupFilter = Attendance.findOne.mock.calls[0][0];
    expect(lookupFilter.date.getFullYear()).toBe(2025);
    expect(lookupFilter.date.getMonth()).toBe(8);
    expect(lookupFilter.date.getDate()).toBe(1);
    expect(Attendance.create).toHaveBeenCalledWith(expect.objectContaining({
      labId: LAB_ID,
      itemType: 'lab',
      batch: 'A1',
      session: SESSION,
      records: [
        { studentId: STUDENT_A, status: 'present' },
        { studentId: STUDENT_B, status: 'absent' },
      ],
    }));
  });

  test('keeps theory class attendance free of any batch field', async () => {
    const res = createRes();
    await facultyController.markAttendance(req({
      body: {
        subjectId: subject._id,
        itemType: 'class',
        date: '2025-09-01',
        records: [{ studentId: STUDENT_A, status: 'present' }],
      },
    }), res);

    expect(res.statusCode).toBe(201);
    const payload = Attendance.create.mock.calls[0][0];
    expect(payload).not.toHaveProperty('batch');
    expect(payload.subjectId).toBe(subject._id);
    expect(Attendance.findOne).toHaveBeenCalledWith(expect.not.objectContaining({ batch: expect.anything() }));
  });

  test('returns only the students of the selected lab batch', async () => {
    const res = createRes();
    await facultyController.getClassStudents(req({
      query: { labId: LAB_ID, batch: 'A1' },
    }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.batch).toBe('A1');
    expect(res.body.data.itemType).toBe('lab');
    expect(res.body.data.students.map(s => s._id)).toEqual([STUDENT_A, STUDENT_B]);
  });

  test('refuses the lab roster when the batch does not exist', async () => {
    const res = createRes();
    await facultyController.getClassStudents(req({
      query: { labId: LAB_ID, batch: 'Z9' },
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('scopes the monthly lab summary to the lab and the batch', async () => {
    const res = createRes();
    await facultyController.getMonthlyAttendanceSummary(req({
      query: { labId: LAB_ID, itemType: 'lab', batch: 'A1', month: '2025-09' },
    }), res);

    expect(res.statusCode).toBe(200);
    expect(Attendance.find).toHaveBeenCalledWith(expect.objectContaining({
      labId: LAB_ID,
      batch: 'A1',
      session: SESSION,
    }));
    expect(res.body.data.batch).toBe('A1');
    expect(res.body.data.itemType).toBe('lab');
  });

  test('scopes the monthly class summary to the subject only', async () => {
    const res = createRes();
    await facultyController.getMonthlyAttendanceSummary(req({
      query: { subjectId: subject._id, itemType: 'class', month: '2025-09' },
    }), res);

    expect(res.statusCode).toBe(200);
    const filter = Attendance.find.mock.calls[0][0];
    expect(filter.subjectId).toBe(subject._id);
    expect(filter).not.toHaveProperty('batch');
    expect(filter).not.toHaveProperty('labId');
  });

  test('publishes a lab notice for the batch students only, with session and term', async () => {
    Notice.create.mockImplementation(async (payload) => payload);

    const res = createRes();
    await facultyController.publishMonthlyAttendanceNotice(req({
      body: { labId: LAB_ID, itemType: 'lab', batch: 'A1', month: '2025-09', type: 'attendance' },
    }), res);

    expect(res.statusCode).toBe(201);
    const notice = Notice.create.mock.calls[0][0];
    expect(notice.session).toBe(SESSION);
    expect(notice.term).toBe(TERM);
    expect(notice.targetStudentIds.map(String).sort()).toEqual([STUDENT_A, STUDENT_B].sort());
    expect(notice.title).toMatch(/Batch A1/);
  });

  test('keeps class notices public to all students', async () => {
    Notice.create.mockImplementation(async (payload) => payload);

    const res = createRes();
    await facultyController.publishMonthlyAttendanceNotice(req({
      body: { subjectId: subject._id, itemType: 'class', month: '2025-09', type: 'attendance' },
    }), res);

    expect(res.statusCode).toBe(201);
    const notice = Notice.create.mock.calls[0][0];
    expect(notice.targetStudentIds).toEqual([]);
    expect(notice.session).toBe(SESSION);
  });

  test('rejects a bulk upload for a lab when no batch is given', async () => {
    const res = createRes();
    await facultyController.bulkUploadAttendance(req({
      file: { path: 'sheet.xlsx' },
      body: { labId: LAB_ID, itemType: 'lab', date: '2025-09-01' },
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/select a batch/i);
  });

  test('rejects a bulk upload for an unknown lab', async () => {
    const res = createRes();
    await facultyController.markAttendance(req({
      body: { labId: LAB_ID_OTHER, itemType: 'lab', batch: 'A1', date: '2025-09-01', records: [] },
    }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });
});
