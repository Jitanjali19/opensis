/**
 * check-it-duplicates.js
 * Finds IT dept subjects/labs that exist in 2026-2027 AND in another session
 * (same code+branch+semester), then removes the ones NOT in 2026-2027.
 * Run: node backend/scripts/check-it-duplicates.js [--delete]
 */
'use strict';
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Subject = require('../src/models/Subject');
const Lab = require('../src/models/Lab');
const FacultyTeachingAssignment = require('../src/models/FacultyTeachingAssignment');

const DRY_RUN = !process.argv.includes('--delete');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/college-erp';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  const TARGET_SESSION = '2026-2027';

  // ── SUBJECTS ──────────────────────────────────────────────────────────────
  const itSubjects2026 = await Subject.find({ branch: 'IT', session: TARGET_SESSION }).lean();
  console.log(`IT subjects in ${TARGET_SESSION}:`, itSubjects2026.length);

  const subjectCodes = [...new Set(itSubjects2026.map(s => s.code))];
  // Find same codes in other sessions (duplicates to remove)
  const dupSubjects = await Subject.find({
    branch: 'IT',
    session: { $ne: TARGET_SESSION },
    code: { $in: subjectCodes },
  }).lean();

  console.log(`\nDuplicate IT subjects in OTHER sessions (to remove): ${dupSubjects.length}`);
  dupSubjects.forEach(s => console.log(`  - [${s.session}] Sem${s.semester} ${s.code}: ${s.name}`));

  // ── LABS ──────────────────────────────────────────────────────────────────
  const itLabs2026 = await Lab.find({ branch: 'IT', session: TARGET_SESSION }).lean();
  console.log(`\nIT labs in ${TARGET_SESSION}:`, itLabs2026.length);

  const labCodes = [...new Set(itLabs2026.map(l => l.code))];
  const dupLabs = await Lab.find({
    branch: 'IT',
    session: { $ne: TARGET_SESSION },
    code: { $in: labCodes },
  }).lean();

  console.log(`\nDuplicate IT labs in OTHER sessions (to remove): ${dupLabs.length}`);
  dupLabs.forEach(l => console.log(`  - [${l.session}] Sem${l.semester} ${l.code}: ${l.name}`));

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made. Run with --delete to actually remove duplicates.');
    await mongoose.disconnect();
    return;
  }

  // Delete duplicate subjects
  if (dupSubjects.length) {
    const ids = dupSubjects.map(s => s._id);
    await FacultyTeachingAssignment.deleteMany({ itemType: 'class', subjectId: { $in: ids } });
    const result = await Subject.deleteMany({ _id: { $in: ids } });
    console.log(`\nDeleted ${result.deletedCount} duplicate subjects.`);
  }

  // Delete duplicate labs
  if (dupLabs.length) {
    const ids = dupLabs.map(l => l._id);
    await FacultyTeachingAssignment.deleteMany({ itemType: 'lab', labId: { $in: ids } });
    const result = await Lab.deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${result.deletedCount} duplicate labs.`);
  }

  console.log('\nDone!');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
