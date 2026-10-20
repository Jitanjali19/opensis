const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');

const SCHEME_INDEX_NAME = 'scheme_session_branch_semester_code';
const SCHEME_INDEX_KEYS = { session: 1, branch: 1, semester: 1, code: 1 };
const ASSIGNMENT_INDEX_NAME = 'teaching_assignment_unique';
const ASSIGNMENT_INDEX_KEYS = {
  facultyId: 1, itemType: 1, subjectId: 1, labId: 1, session: 1, term: 1, section: 1,
};

// listIndexes throws NamespaceNotFound (26) when the collection does not exist yet.
const safeIndexes = async (collection) => {
  try {
    return await collection.indexes();
  } catch (err) {
    if (err.code === 26 || err.codeName === 'NamespaceNotFound') return [];
    throw err;
  }
};

const indexNames = async (collection) => (await safeIndexes(collection)).map((index) => index.name);

const dropLegacyCodeIndex = async (collection, label) => {
  const names = await indexNames(collection);
  if (names.includes('code_1')) {
    await collection.dropIndex('code_1');
    console.log(`[migration] Dropped legacy unique index code_1 on ${label}`);
  }
};

const ensureSchemeUniqueIndex = async (Model, label) => {
  const collection = Model.collection;
  await dropLegacyCodeIndex(collection, label);

  const names = await indexNames(collection);
  if (names.includes(SCHEME_INDEX_NAME)) return;

  const duplicates = await Model.aggregate([
    {
      $group: {
        _id: { session: '$session', branch: '$branch', semester: '$semester', code: '$code' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 },
  ]);

  if (duplicates.length) {
    console.warn(
      `[migration] Skipped unique scheme index on ${label}: ${duplicates.length} duplicate key group(s) found. `
      + 'Resolve duplicates and restart the server.',
    );
    return;
  }

  await collection.createIndex(SCHEME_INDEX_KEYS, { unique: true, name: SCHEME_INDEX_NAME });
  console.log(`[migration] Created unique scheme index on ${label}`);
};

const ensureAssignmentIndex = async () => {
  const collection = FacultyTeachingAssignment.collection;

  // Backfill itemType for rows created before labs were assignable.
  const backfill = await FacultyTeachingAssignment.updateMany(
    { itemType: { $exists: false } },
    { $set: { itemType: 'class' } },
  );
  if (backfill.modifiedCount) {
    console.log(`[migration] Backfilled itemType on ${backfill.modifiedCount} teaching assignment(s)`);
  }

  // Drop the old subject-only unique index if present.
  const names = await indexNames(collection);
  const legacy = names.filter((name) => name.startsWith('facultyId_1_subjectId_1_'));
  for (const name of legacy) {
    await collection.dropIndex(name);
    console.log(`[migration] Dropped legacy teaching assignment index ${name}`);
  }

  const current = await indexNames(collection);
  if (current.includes(ASSIGNMENT_INDEX_NAME)) return;

  const duplicates = await FacultyTeachingAssignment.aggregate([
    {
      $group: {
        _id: {
          facultyId: '$facultyId',
          itemType: '$itemType',
          subjectId: '$subjectId',
          labId: '$labId',
          session: '$session',
          term: '$term',
          section: '$section',
        },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 },
  ]);

  if (duplicates.length) {
    console.warn(
      `[migration] Skipped unique teaching assignment index: ${duplicates.length} duplicate group(s) found. `
      + 'Resolve duplicates and restart the server.',
    );
    return;
  }

  await collection.createIndex(ASSIGNMENT_INDEX_KEYS, { unique: true, name: ASSIGNMENT_INDEX_NAME });
  console.log('[migration] Created unique teaching assignment index');
};

// Idempotent, non-destructive. Safe to run on every startup.
const migrateAcademicScheme = async () => {
  try {
    await ensureSchemeUniqueIndex(Subject, 'Subject');
    await ensureSchemeUniqueIndex(Lab, 'Lab');
    await ensureAssignmentIndex();
  } catch (err) {
    console.error('[migration] Academic scheme migration error:', err.message);
  }
};

module.exports = { migrateAcademicScheme };
