/**
 * One-off repair for faculty assignment drift.
 *
 * Guarantees after running:
 *   1. Every Subject/Lab `facultyId` primary pointer has a matching teaching
 *      assignment row (when the subject/lab has a session).
 *   2. Every teaching assignment without a primary teacher gets one.
 *   3. `Faculty.subjectsTaught` mirrors the real teaching assignments (plus any
 *      legacy primary pointers), so admin screens stop showing 0 subjects.
 *
 * Usage:
 *   node scripts/reconcile-faculty-data.js           # apply
 *   node scripts/reconcile-faculty-data.js --dry-run # report only
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not found. Set it in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB${DRY_RUN ? ' (dry run)' : ''}`);

  const Faculty = require('../src/models/Faculty');
  const Subject = require('../src/models/Subject');
  const Lab = require('../src/models/Lab');
  const FacultyTeachingAssignment = require('../src/models/FacultyTeachingAssignment');
  const {
    syncAllFacultySubjectsTaught,
    ensureTeachingAssignments,
    reconcilePrimaryFacultyPointers,
  } = require('../src/utils/facultyAssignments');

  const faculties = await Faculty.find({}).select('_id employeeId firstName lastName subjectsTaught').lean();
  const subjects = await Subject.find({ facultyId: { $ne: null } })
    .select('_id code name branch semester session facultyId').lean();
  const labs = await Lab.find({ facultyId: { $ne: null } })
    .select('_id code name branch semester session facultyId').lean();

  console.log(`\nFaculty: ${faculties.length}`);
  console.log(`Subjects with primary faculty: ${subjects.length}`);
  console.log(`Labs with primary faculty: ${labs.length}`);

  const before = new Map();
  for (const faculty of faculties) {
    const assignments = await FacultyTeachingAssignment.countDocuments({ facultyId: faculty._id });
    before.set(String(faculty._id), {
      assignments,
      subjectsTaught: (faculty.subjectsTaught || []).length,
    });
  }

  const subjectsByFaculty = new Map();
  const labsByFaculty = new Map();
  for (const subject of subjects) {
    if (!subject.session || !subject.semester) continue;
    const key = String(subject.facultyId);
    if (!subjectsByFaculty.has(key)) subjectsByFaculty.set(key, []);
    subjectsByFaculty.get(key).push(subject);
  }
  for (const lab of labs) {
    if (!lab.session || !lab.semester) continue;
    const key = String(lab.facultyId);
    if (!labsByFaculty.has(key)) labsByFaculty.set(key, []);
    labsByFaculty.get(key).push(lab);
  }

  if (DRY_RUN) {
    for (const faculty of faculties) {
      const id = String(faculty._id);
      const stats = before.get(id);
      const primarySubjects = subjectsByFaculty.get(id) || [];
      const primaryLabs = labsByFaculty.get(id) || [];
      let missing = 0;
      for (const subject of primarySubjects) {
        const exists = await FacultyTeachingAssignment.exists({
          facultyId: faculty._id, itemType: 'class', subjectId: subject._id,
        });
        if (!exists) missing += 1;
      }
      for (const lab of primaryLabs) {
        const exists = await FacultyTeachingAssignment.exists({
          facultyId: faculty._id, itemType: 'lab', labId: lab._id,
        });
        if (!exists) missing += 1;
      }
      console.log(
        `${String(faculty.employeeId).padEnd(10)} ${(faculty.firstName + ' ' + faculty.lastName).padEnd(22)}: ` +
        `assignments ${stats.assignments}, missing for primary pointers ${missing}, ` +
        `subjectsTaught ${stats.subjectsTaught}`,
      );
    }
    await mongoose.disconnect();
    return;
  }

  for (const faculty of faculties) {
    const id = String(faculty._id);
    await ensureTeachingAssignments(faculty._id, {
      subjects: subjectsByFaculty.get(id) || [],
      labs: labsByFaculty.get(id) || [],
    });
  }
  console.log('\nEnsured teaching assignments for every primary faculty pointer.');

  for (const faculty of faculties) {
    await reconcilePrimaryFacultyPointers(faculty._id);
  }
  console.log('Repaired primary faculty pointers for items with assignments.');

  await syncAllFacultySubjectsTaught();
  console.log('Rebuilt Faculty.subjectsTaught from teaching assignments.');

  console.log('\nFaculty                          | assignments     | subjectsTaught');
  console.log('---------------------------------|-----------------|---------------');
  for (const faculty of faculties.sort((a, b) => String(a.employeeId).localeCompare(String(b.employeeId)))) {
    const id = String(faculty._id);
    const assignments = await FacultyTeachingAssignment.countDocuments({ facultyId: faculty._id });
    const updated = await Faculty.findById(faculty._id).select('subjectsTaught').lean();
    const stats = before.get(id);
    console.log(
      `${(faculty.employeeId + ' ' + faculty.firstName + ' ' + faculty.lastName).padEnd(32)} | ` +
      `${String(stats.assignments).padStart(3)} -> ${String(assignments).padStart(3)}      | ` +
      `${stats.subjectsTaught} -> ${(updated.subjectsTaught || []).length}`,
    );
  }

  await mongoose.disconnect();
  console.log('\nDone.');
})().catch(async (error) => {
  console.error('Reconcile failed:', error);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
