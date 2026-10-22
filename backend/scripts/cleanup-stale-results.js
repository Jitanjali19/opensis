/**
 * Repairs stale result data that blocks gradesheet generation.
 *
 * What it cleans:
 *   1. `subjectMarks` entries whose Subject/Lab document no longer exists
 *      (deleted subjects/labs leave orphaned marks behind).
 *   2. `subjectMarks` entries that belong to a different semester/branch than
 *      the result document itself.
 *   3. Result documents whose student no longer exists (orphaned results).
 *   4. Duplicate result documents for the same student + semester + session
 *      (marks are merged into the oldest document).
 *
 * After running, every remaining mark points to a live subject/lab of the same
 * semester, which lets admin approval + gradesheet generation work normally.
 *
 * Usage:
 *   node scripts/cleanup-stale-results.js           # apply
 *   node scripts/cleanup-stale-results.js --dry-run # report only
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

  const Result = require('../src/models/Result');
  const Subject = require('../src/models/Subject');
  const Lab = require('../src/models/Lab');
  const Student = require('../src/models/Student');

  const [results, subjects, labs, students] = await Promise.all([
    Result.find({}).lean(),
    Subject.find({}).select('_id code name semester branch').lean(),
    Lab.find({}).select('_id code name semester branch').lean(),
    Student.find({}).select('_id').lean(),
  ]);

  const itemMap = new Map();
  [...subjects, ...labs].forEach(item => itemMap.set(String(item._id), item));
  const studentIds = new Set(students.map(s => String(s._id)));

  console.log(`\nResults: ${results.length} | Subjects: ${subjects.length} | Labs: ${labs.length} | Students: ${students.length}`);

  const droppedMarks = [];
  const deletedResults = [];
  const updatedResults = [];
  const seenKeys = new Map();

  for (const result of results) {
    const key = `${result.studentId}:${result.semester}:${result.session}`;

    // Orphaned result (student deleted)
    if (!studentIds.has(String(result.studentId))) {
      deletedResults.push({
        _id: result._id,
        semester: result.semester,
        session: result.session,
        studentId: String(result.studentId),
        reason: 'student no longer exists',
      });
      if (!DRY_RUN) await Result.deleteOne({ _id: result._id });
      continue;
    }

    // Duplicate result for the same student/semester/session
    if (seenKeys.has(key)) {
      const primaryId = seenKeys.get(key);
      deletedResults.push({
        _id: result._id,
        semester: result.semester,
        session: result.session,
        studentId: String(result.studentId),
        reason: `duplicate of ${primaryId}`,
      });
      if (!DRY_RUN) {
        const primary = await Result.findById(primaryId);
        if (primary) {
          for (const mark of result.subjectMarks || []) {
            const itemId = String(mark.subjectId || mark.labId || '');
            const exists = (primary.subjectMarks || []).some(existing => String(existing.subjectId || existing.labId || '') === itemId);
            if (!exists) primary.subjectMarks.push(mark);
          }
          primary.markModified('subjectMarks');
          await primary.save();
        }
        await Result.deleteOne({ _id: result._id });
      }
      continue;
    }
    seenKeys.set(key, result._id);

    const validMarks = [];
    for (const mark of result.subjectMarks || []) {
      const itemId = String(mark.subjectId || mark.labId || '');
      const item = itemId ? itemMap.get(itemId) : null;
      let reason = '';
      if (!itemId) reason = 'missing subjectId/labId';
      else if (!item) reason = 'subject/lab no longer exists';
      else if (Number(item.semester) !== Number(result.semester)) {
        reason = `belongs to semester ${item.semester}, result is semester ${result.semester}`;
      } else if (result.branch && item.branch && item.branch !== result.branch) {
        reason = `belongs to branch ${item.branch}, result is branch ${result.branch}`;
      }

      if (reason) {
        droppedMarks.push({
          resultId: result._id,
          studentId: String(result.studentId),
          itemCode: mark.itemCode || itemId || '(empty)',
          itemName: mark.itemName || '',
          submissionStatus: mark.submissionStatus || '(none)',
          reason,
        });
      } else {
        validMarks.push(mark);
      }
    }

    if (validMarks.length !== (result.subjectMarks || []).length) {
      if (validMarks.length === 0) {
        deletedResults.push({
          _id: result._id,
          semester: result.semester,
          session: result.session,
          studentId: String(result.studentId),
          reason: 'no valid marks left',
        });
        if (!DRY_RUN) await Result.deleteOne({ _id: result._id });
      } else {
        updatedResults.push({ _id: result._id, removed: (result.subjectMarks || []).length - validMarks.length });
        if (!DRY_RUN) await Result.updateOne({ _id: result._id }, { $set: { subjectMarks: validMarks } });
      }
    }
  }

  const groupBy = (rows, pick) => rows.reduce((acc, row) => {
    const key = pick(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(`\nDropped marks: ${droppedMarks.length}`);
  console.log(groupBy(droppedMarks, row => `${row.itemCode} (${row.submissionStatus}) — ${row.reason}`));
  console.log(`\nDeleted results: ${deletedResults.length}`);
  console.log(groupBy(deletedResults, row => `sem ${row.semester} / ${row.session} — ${row.reason}`));
  console.log(`\nUpdated results: ${updatedResults.length}`);

  if (DRY_RUN) {
    console.log('\nDry run only. Re-run without --dry-run to apply.');
  } else {
    console.log('\nCleanup applied.');
  }

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
