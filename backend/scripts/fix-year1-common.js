/**
 * fix-year1-common.js
 *
 * Year-1 (Sem 1 & 2) subjects/labs are common to every department. They were
 * previously copied into all branches, which made the scheme view show the same
 * subject 7 times. This script:
 *   1. Keeps one canonical copy per common subject/lab (the IT copy).
 *   2. Deletes the duplicate copies from the other branches (only if unused).
 *   3. Re-assigns Year-1 faculty to the subject's own department
 *      (Maths, Physics, Chemistry, Electrical, Computer Science, Civil,
 *       Mechanical, ECE, Humanities).
 *   4. Creates a placeholder faculty member for departments that have none.
 *
 * Run: node backend/scripts/fix-year1-common.js
 */
'use strict';
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');
const Faculty = require('../src/models/Faculty');
const Subject = require('../src/models/Subject');
const Lab = require('../src/models/Lab');
const FTA = require('../src/models/FacultyTeachingAssignment');
const TimetableEntry = require('../src/models/TimetableEntry');
const Attendance = require('../src/models/Attendance');
const Assignment = require('../src/models/Assignment');
const ExamSchedule = require('../src/models/ExamSchedule');
const Feedback = require('../src/models/Feedback');
const SubjectMarks = require('../src/models/SubjectMarks');
const RevaluationRequest = require('../src/models/RevaluationRequest');
const Result = require('../src/models/Result');
const ResultUploadBatch = require('../src/models/ResultUploadBatch');
const LabBatch = require('../src/models/LabBatch');

const SESSION = '2026-2027';
const CANONICAL_BRANCH = 'IT';

const DEPT_BY_PREFIX = {
  MA: 'Mathematics',
  PH: 'Physics',
  CH: 'Chemistry',
  EE: 'Electrical Engineering',
  CO: 'Computer Science',
  CE: 'Civil Engineering',
  ME: 'Mechanical Engineering',
  IP: 'Mechanical Engineering',
  EC: 'Electronics & Communication',
  HU: 'Humanities',
  IT: 'IT',
};

const PLACEHOLDERS = {
  'Civil Engineering': { firstName: 'Civil', lastName: 'Faculty', employeeId: 'FAC-CIV-01', email: 'civil.faculty@college.edu' },
  'Mechanical Engineering': { firstName: 'Mechanical', lastName: 'Faculty', employeeId: 'FAC-MECH-01', email: 'mechanical.faculty@college.edu' },
  'Electronics & Communication': { firstName: 'ECE', lastName: 'Faculty', employeeId: 'FAC-ECE-01', email: 'ece.faculty@college.edu' },
  Humanities: { firstName: 'Humanities', lastName: 'Faculty', employeeId: 'FAC-HUM-01', email: 'humanities.faculty@college.edu' },
};

const departmentFor = (code) => DEPT_BY_PREFIX[String(code || '').slice(0, 2).toUpperCase()] || null;

async function ensurePlaceholderFaculty(department) {
  const existing = await Faculty.findOne({ department }).select('_id firstName lastName').lean();
  if (existing) return existing;

  const info = PLACEHOLDERS[department];
  if (!info) return null;

  let user = await User.findOne({ email: info.email });
  if (!user) {
    const passwordHash = await bcrypt.hash('Welcome@123', 12);
    user = await User.create({ email: info.email, passwordHash, role: 'faculty' });
  }
  const faculty = await Faculty.create({
    userId: user._id,
    employeeId: info.employeeId,
    firstName: info.firstName,
    lastName: info.lastName,
    department,
    designation: 'Assistant Professor',
  });
  console.log(`  + placeholder faculty created: ${info.firstName} ${info.lastName} (${department})`);
  return faculty;
}

async function isUnused({ subjectIds, labIds }) {
  const checks = [];
  if (subjectIds.length) {
    checks.push(
      TimetableEntry.countDocuments({ subject: { $in: subjectIds } }),
      Attendance.countDocuments({ subjectId: { $in: subjectIds } }),
      Assignment.countDocuments({ subjectId: { $in: subjectIds } }),
      ExamSchedule.countDocuments({ 'entries.subjectId': { $in: subjectIds } }),
      Feedback.countDocuments({ subjectId: { $in: subjectIds } }),
      SubjectMarks.countDocuments({ subjectId: { $in: subjectIds } }),
      RevaluationRequest.countDocuments({ subjectId: { $in: subjectIds } }),
      ResultUploadBatch.countDocuments({ subjectId: { $in: subjectIds } }),
      Result.countDocuments({ 'subjectMarks.subjectId': { $in: subjectIds } }),
    );
  }
  if (labIds.length) {
    checks.push(
      TimetableEntry.countDocuments({ subject: { $in: labIds } }),
      Attendance.countDocuments({ labId: { $in: labIds } }),
      Assignment.countDocuments({ labId: { $in: labIds } }),
      Result.countDocuments({ 'subjectMarks.labId': { $in: labIds } }),
      LabBatch.countDocuments({ labId: { $in: labIds } }),
    );
  }
  const counts = await Promise.all(checks);
  return counts.every((n) => n === 0);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/college-erp');
  console.log(`Connected — session ${SESSION}\n`);

  // ── 1. Remove duplicate Year-1 copies from non-canonical branches ──────────
  const dupSubjects = await Subject.find({
    session: SESSION,
    semester: { $in: [1, 2] },
    branch: { $ne: CANONICAL_BRANCH },
  }).select('_id code name branch semester isCommon').lean();
  const dupLabs = await Lab.find({
    session: SESSION,
    semester: { $in: [1, 2] },
    branch: { $ne: CANONICAL_BRANCH },
  }).select('_id code name branch semester isCommon').lean();

  const nonCommon = [...dupSubjects, ...dupLabs].filter((item) => !item.isCommon);
  if (nonCommon.length) {
    console.log(`⚠ ${nonCommon.length} Year-1 entry(ies) are not marked isCommon; keeping them for safety:`);
    nonCommon.forEach((item) => console.log(`   - ${item.code} ${item.name} (${item.branch} sem${item.semester})`));
  }

  const removableSubjects = dupSubjects.filter((item) => item.isCommon);
  const removableLabs = dupLabs.filter((item) => item.isCommon);
  const subjectIds = removableSubjects.map((item) => item._id);
  const labIds = removableLabs.map((item) => item._id);

  if (subjectIds.length || labIds.length) {
    const unused = await isUnused({ subjectIds, labIds });
    if (!unused) {
      console.log('⚠ Duplicate copies are referenced by timetable/results/etc. — nothing deleted.');
    } else {
      await FTA.deleteMany({ $or: [{ subjectId: { $in: subjectIds } }, { labId: { $in: labIds } }] });
      await Subject.deleteMany({ _id: { $in: subjectIds } });
      await Lab.deleteMany({ _id: { $in: labIds } });
      console.log(`Removed ${subjectIds.length} duplicate subject(s) and ${labIds.length} duplicate lab(s) from other branches.`);
    }
  } else {
    console.log('No duplicate Year-1 copies found.');
  }

  // ── 2. Ensure the canonical IT copies are marked common ───────────────────
  await Subject.updateMany(
    { session: SESSION, branch: CANONICAL_BRANCH, semester: { $in: [1, 2] } },
    { $set: { isCommon: true } },
  );
  await Lab.updateMany(
    { session: SESSION, branch: CANONICAL_BRANCH, semester: { $in: [1, 2] } },
    { $set: { isCommon: true } },
  );

  // ── 3. Faculty for the correct department ─────────────────────────────────
  const departments = [...new Set(Object.values(DEPT_BY_PREFIX))];
  const facultyByDept = {};
  for (const department of departments) {
    let list = await Faculty.find({ department }).select('_id firstName lastName department').lean();
    if (!list.length) {
      const created = await ensurePlaceholderFaculty(department);
      if (created) list = [{ _id: created._id, firstName: created.firstName, lastName: created.lastName, department }];
    }
    facultyByDept[department] = list;
  }

  const canonicalSubjects = await Subject.find({
    session: SESSION,
    branch: CANONICAL_BRANCH,
    semester: { $in: [1, 2] },
  }).sort({ semester: 1, code: 1 }).lean();
  const canonicalLabs = await Lab.find({
    session: SESSION,
    branch: CANONICAL_BRANCH,
    semester: { $in: [1, 2] },
  }).sort({ semester: 1, code: 1 }).lean();

  const counters = {};
  const nextFacultyFor = (department) => {
    const list = facultyByDept[department] || [];
    if (!list.length) return null;
    const index = counters[department] || 0;
    counters[department] = index + 1;
    return list[index % list.length];
  };

  const fixItem = async (item, itemType) => {
    const department = departmentFor(item.code);
    if (!department) {
      console.log(`  ! No department mapping for ${item.code} ${item.name}`);
      return;
    }
    const faculty = nextFacultyFor(department);
    if (!faculty) {
      console.log(`  ! No faculty available for ${department}`);
      return;
    }

    const itemFilter = itemType === 'lab' ? { labId: item._id } : { subjectId: item._id };
    const oldAssignments = await FTA.find({ ...itemFilter, itemType, session: SESSION }).lean();
    await FTA.deleteMany({ ...itemFilter, itemType, session: SESSION });
    await FTA.create({
      facultyId: faculty._id,
      itemType,
      ...itemFilter,
      session: SESSION,
      term: item.semester % 2 === 0 ? 'january-june' : 'july-december',
      semester: item.semester,
      branch: CANONICAL_BRANCH,
      section: '',
    });

    const Model = itemType === 'lab' ? Lab : Subject;
    await Model.updateOne({ _id: item._id }, { $set: { facultyId: faculty._id } });
    await Faculty.updateMany(
      { _id: { $in: oldAssignments.map((a) => a.facultyId) } },
      { $pull: { subjectsTaught: item._id } },
    );
    await Faculty.updateOne({ _id: faculty._id }, { $addToSet: { subjectsTaught: item._id } });

    console.log(`  ${item.code} ${item.name} (sem${item.semester}) → ${faculty.firstName} ${faculty.lastName} (${department})`);
  };

  console.log('\nAssigning Year-1 faculty:');
  for (const subject of canonicalSubjects) await fixItem(subject, 'class');
  for (const lab of canonicalLabs) await fixItem(lab, 'lab');

  // ── 4. Summary ────────────────────────────────────────────────────────────
  const remaining = await Subject.aggregate([
    { $match: { session: SESSION, semester: { $in: [1, 2] } } },
    { $group: { _id: { code: '$code', semester: '$semester' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  console.log(`\nRemaining duplicate Year-1 subject codes: ${remaining.length}`);
  remaining.forEach((r) => console.log(`  ${r._id.code} sem${r._id.semester} ×${r.n}`));

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
