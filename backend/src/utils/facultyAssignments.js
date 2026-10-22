const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');
const { termForSemester } = require('./scheme');

const uniqueIds = (values) => [...new Set((values || []).filter(Boolean).map(String))];

const activeAssignmentFilter = ({ session, term } = {}) => {
  const filter = {};
  if (session) filter.session = session;
  if (term) filter.$or = [{ term }, { term: { $exists: false } }, { term: null }];
  return filter;
};

/**
 * Resolve the classes/labs a faculty actually teaches.
 * This is the source of truth used by the faculty dashboard (`/faculty/subjects`),
 * so admin screens must use the same data instead of the legacy `subjectsTaught` field.
 *
 * @returns {Promise<Map<string, Array<{itemId: string, itemType: 'class'|'lab', code: string, name: string}>>>}
 */
const getAssignedItemsByFaculty = async (facultyIds, { session, term } = {}) => {
  const ids = uniqueIds(facultyIds);
  const byFaculty = new Map();
  if (ids.length === 0) return byFaculty;

  const rows = await FacultyTeachingAssignment.find({
    facultyId: { $in: ids },
    ...activeAssignmentFilter({ session, term }),
  })
    .populate('subjectId', 'code name branch semester credits type')
    .populate('labId', 'code name branch semester credits')
    .lean();

  rows.forEach((row) => {
    const item = row.itemType === 'lab' ? row.labId : row.subjectId;
    if (!item) return;
    const facultyId = String(row.facultyId && row.facultyId._id ? row.facultyId._id : row.facultyId);
    const itemId = String(item._id);
    const list = byFaculty.get(facultyId) || [];
    if (list.some((entry) => entry.itemId === itemId)) return;
    list.push({
      itemId,
      itemType: row.itemType === 'lab' ? 'lab' : 'class',
      code: item.code,
      name: item.name,
      branch: item.branch,
      semester: row.semester ?? item.semester,
      credits: item.credits,
      session: row.session,
      term: row.term,
      section: row.section || '',
    });
    byFaculty.set(facultyId, list);
  });

  return byFaculty;
};

/**
 * Rebuild `Faculty.subjectsTaught` so the legacy field can never drift from the
 * real teaching assignments again. The union of:
 *   - subjects referenced by this faculty's teaching assignments, and
 *   - subjects whose primary `facultyId` points at this faculty
 * keeps older records (created before teaching assignments existed) readable.
 */
const syncFacultySubjectsTaught = async (facultyIds) => {
  const ids = uniqueIds(facultyIds);
  if (ids.length === 0) return;

  const [assignments, primarySubjects] = await Promise.all([
    FacultyTeachingAssignment.find({
      facultyId: { $in: ids },
      itemType: 'class',
      subjectId: { $ne: null },
    }).select('facultyId subjectId').lean(),
    Subject.find({ facultyId: { $in: ids } }).select('_id facultyId').lean(),
  ]);

  const byFaculty = new Map(ids.map((id) => [id, new Set()]));

  assignments.forEach((assignment) => {
    const facultyId = String(assignment.facultyId);
    if (!assignment.subjectId || !byFaculty.has(facultyId)) return;
    byFaculty.get(facultyId).add(String(assignment.subjectId));
  });

  primarySubjects.forEach((subject) => {
    const facultyId = String(subject.facultyId);
    if (byFaculty.has(facultyId)) byFaculty.get(facultyId).add(String(subject._id));
  });

  await Faculty.bulkWrite(
    ids.map((id) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { subjectsTaught: [...(byFaculty.get(id) || [])] } },
      },
    })),
    { ordered: false },
  );
};

const syncAllFacultySubjectsTaught = async () => {
  const faculties = await Faculty.find({}).select('_id').lean();
  await syncFacultySubjectsTaught(faculties.map((faculty) => faculty._id));
};

/**
 * Create missing teaching assignments for the given class/lab documents.
 * Existing rows are left untouched (safe to run repeatedly).
 */
const ensureTeachingAssignments = async (facultyId, { subjects = [], labs = [], fallbackSession } = {}) => {
  const operations = [];

  (subjects || []).forEach((subject) => {
    const session = subject.session || fallbackSession;
    if (!subject?._id || !session || !subject.semester) return;
    operations.push({
      updateOne: {
        filter: {
          facultyId,
          itemType: 'class',
          subjectId: subject._id,
          session,
          term: termForSemester(subject.semester),
          section: '',
        },
        update: { $set: { semester: Number(subject.semester), branch: subject.branch } },
        upsert: true,
      },
    });
  });

  (labs || []).forEach((lab) => {
    const session = lab.session || fallbackSession;
    if (!lab?._id || !session || !lab.semester) return;
    operations.push({
      updateOne: {
        filter: {
          facultyId,
          itemType: 'lab',
          labId: lab._id,
          session,
          term: termForSemester(lab.semester),
          section: '',
        },
        update: { $set: { semester: Number(lab.semester), branch: lab.branch } },
        upsert: true,
      },
    });
  });

  if (operations.length) {
    await FacultyTeachingAssignment.bulkWrite(operations, { ordered: false });
  }
};

const removeTeachingAssignments = async (facultyId, { subjectIds = [], labIds = [] } = {}) => {
  const operations = [];
  if (subjectIds.length) {
    operations.push(FacultyTeachingAssignment.deleteMany({
      facultyId,
      itemType: 'class',
      subjectId: { $in: subjectIds },
    }));
  }
  if (labIds.length) {
    operations.push(FacultyTeachingAssignment.deleteMany({
      facultyId,
      itemType: 'lab',
      labId: { $in: labIds },
    }));
  }
  if (operations.length) await Promise.all(operations);
};

/**
 * Keep the single `facultyId` pointer on Subject/Lab in step with the real
 * assignment rows: never leave it dangling when a teacher is removed, and fill
 * it in when an assigned item has no primary teacher yet.
 */
const reconcilePrimaryFacultyPointers = async (facultyId) => {
  const [classAssignments, labAssignments, primarySubjects, primaryLabs] = await Promise.all([
    FacultyTeachingAssignment.find({ facultyId, itemType: 'class', subjectId: { $ne: null } })
      .select('subjectId').lean(),
    FacultyTeachingAssignment.find({ facultyId, itemType: 'lab', labId: { $ne: null } })
      .select('labId').lean(),
    Subject.find({ facultyId }).select('_id').lean(),
    Lab.find({ facultyId }).select('_id').lean(),
  ]);

  const keepSubjectIds = uniqueIds([
    ...classAssignments.map((assignment) => assignment.subjectId),
    ...primarySubjects.map((subject) => subject._id),
  ]);
  const keepLabIds = uniqueIds([
    ...labAssignments.map((assignment) => assignment.labId),
    ...primaryLabs.map((lab) => lab._id),
  ]);

  const [removedSubjects, removedLabs, unassignedSubjects, unassignedLabs] = await Promise.all([
    Subject.find({ facultyId, _id: { $nin: keepSubjectIds } }).select('_id').lean(),
    Lab.find({ facultyId, _id: { $nin: keepLabIds } }).select('_id').lean(),
    Subject.find({
      _id: { $in: keepSubjectIds },
      $or: [{ facultyId: null }, { facultyId: { $exists: false } }],
    }).select('_id').lean(),
    Lab.find({
      _id: { $in: keepLabIds },
      $or: [{ facultyId: null }, { facultyId: { $exists: false } }],
    }).select('_id').lean(),
  ]);

  for (const subject of removedSubjects) {
    const replacement = await FacultyTeachingAssignment.findOne({
      itemType: 'class',
      subjectId: subject._id,
      facultyId: { $ne: facultyId },
    }).sort({ createdAt: 1 }).select('facultyId').lean();
    await Subject.updateOne(
      { _id: subject._id, facultyId },
      { $set: { facultyId: replacement?.facultyId || null } },
    );
  }

  for (const lab of removedLabs) {
    const replacement = await FacultyTeachingAssignment.findOne({
      itemType: 'lab',
      labId: lab._id,
      facultyId: { $ne: facultyId },
    }).sort({ createdAt: 1 }).select('facultyId').lean();
    await Lab.updateOne(
      { _id: lab._id, facultyId },
      { $set: { facultyId: replacement?.facultyId || null } },
    );
  }

  if (unassignedSubjects.length) {
    await Subject.updateMany(
      { _id: { $in: unassignedSubjects.map((subject) => subject._id) } },
      { $set: { facultyId } },
    );
  }
  if (unassignedLabs.length) {
    await Lab.updateMany(
      { _id: { $in: unassignedLabs.map((lab) => lab._id) } },
      { $set: { facultyId } },
    );
  }
};

module.exports = {
  getAssignedItemsByFaculty,
  syncFacultySubjectsTaught,
  syncAllFacultySubjectsTaught,
  ensureTeachingAssignments,
  removeTeachingAssignments,
  reconcilePrimaryFacultyPointers,
};
