jest.mock('../src/models/Subject', () => ({ find: jest.fn(), insertMany: jest.fn() }));
jest.mock('../src/models/Lab', () => ({ find: jest.fn(), insertMany: jest.fn() }));
jest.mock('../src/models/FacultyTeachingAssignment', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  exists: jest.fn(),
  deleteMany: jest.fn(),
  bulkWrite: jest.fn(),
  updateMany: jest.fn(),
}));

const Subject = require('../src/models/Subject');
const Lab = require('../src/models/Lab');
const ctrl = require('../src/controllers/adminController');

const chain = (result) => ({
  select: () => chain(result),
  populate: () => chain(result),
  lean: async () => result,
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  Subject.find.mockReset();
  Subject.insertMany.mockReset();
  Lab.find.mockReset();
  Lab.insertMany.mockReset();
  Subject.insertMany.mockImplementation(async (docs) => docs);
  Lab.insertMany.mockImplementation(async (docs) => docs);
});

test('copyScheme rejects missing or identical sessions', async () => {
  const res = makeRes();
  await ctrl.copyScheme({ body: {} }, res);
  expect(res.status).toHaveBeenCalledWith(400);

  res.status.mockClear();
  await ctrl.copyScheme({ body: { fromSession: '2024-2025', toSession: '2024-2025' } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('copyScheme clones scheme without faculty and skips existing target codes', async () => {
  Subject.find
    // source subjects
    .mockImplementationOnce(() => chain([
      { code: 'IT501', name: 'DS', branch: 'IT', semester: 5, category: 'PCC', l: 3, t: 1, p: 0, credits: 4, syllabusText: 's', syllabusFile: '/uploads/a.pdf', electiveOptions: ['e1'], facultyId: 'fac1' },
      { code: 'IT502', name: 'CN', branch: 'IT', semester: 5, category: 'PCC', l: 3, t: 0, p: 0, credits: 3, facultyId: 'fac1' },
    ]))
    // existing subjects in the target session
    .mockImplementationOnce(() => chain([{ code: 'IT502' }]));
  Lab.find
    .mockImplementationOnce(() => chain([{ code: 'ITL501', name: 'DS Lab', branch: 'IT', semester: 5, category: 'PCC', l: 0, t: 0, p: 2, credits: 1, facultyId: 'fac2' }]))
    .mockImplementationOnce(() => chain([]));

  const res = makeRes();
  await ctrl.copyScheme({ body: { fromSession: '2024-2025', toSession: '2025-2026' } }, res);

  expect(res.json).toHaveBeenCalled();
  const payload = res.json.mock.calls[0][0];
  expect(payload.success).toBe(true);
  expect(payload.data.created).toEqual({ subjects: 1, labs: 1 });
  expect(payload.data.skipped).toBe(1);

  const copiedSubjects = Subject.insertMany.mock.calls[0][0];
  expect(copiedSubjects).toHaveLength(1);
  expect(copiedSubjects[0].code).toBe('IT501');
  expect(copiedSubjects[0].session).toBe('2025-2026');
  expect(copiedSubjects[0].facultyId).toBeUndefined();
  expect(copiedSubjects[0].electiveOptions).toEqual(['e1']);

  const copiedLabs = Lab.insertMany.mock.calls[0][0];
  expect(copiedLabs[0].session).toBe('2025-2026');
  expect(copiedLabs[0].facultyId).toBeUndefined();
});

test('copyScheme is idempotent when the target session already has the codes', async () => {
  Subject.find
    .mockImplementationOnce(() => chain([{ code: 'IT501', name: 'DS', branch: 'IT', semester: 5, credits: 4 }]))
    .mockImplementationOnce(() => chain([{ code: 'IT501' }]));
  Lab.find
    .mockImplementationOnce(() => chain([{ code: 'ITL501', name: 'DS Lab', branch: 'IT', semester: 5, credits: 1 }]))
    .mockImplementationOnce(() => chain([{ code: 'ITL501' }]));

  const res = makeRes();
  await ctrl.copyScheme({ body: { fromSession: '2024-2025', toSession: '2025-2026' } }, res);

  const payload = res.json.mock.calls[0][0];
  expect(payload.data.created).toEqual({ subjects: 0, labs: 0 });
  expect(payload.data.skipped).toBe(2);
  expect(Subject.insertMany).not.toHaveBeenCalled();
  expect(Lab.insertMany).not.toHaveBeenCalled();
});
