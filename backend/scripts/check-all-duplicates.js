/**
 * check-all-duplicates.js
 * Finds any duplicate subject/lab records (same code+branch+semester+session).
 * Run: node backend/scripts/check-all-duplicates.js [--delete]
 */
'use strict';
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Subject = require('../src/models/Subject');
const Lab = require('../src/models/Lab');
const FacultyTeachingAssignment = require('../src/models/FacultyTeachingAssignment');

const DRY_RUN = !process.argv.includes('--delete');

async function findDuplicates(Model, label) {
  const all = await Model.find({ branch: 'IT' }).sort({ createdAt: 1 }).lean();
  const seen = new Map();
  const toDelete = [];

  for (const item of all) {
    const key = `${item.session}|${item.branch}|${item.semester}|${item.code}`;
    if (seen.has(key)) {
      // Keep the first (oldest), delete subsequent
      toDelete.push(item._id);
      console.log(`  DUP ${label}: [${item.session}] Sem${item.semester} ${item.code}: ${item.name} (id: ${item._id})`);
    } else {
      seen.set(key, item._id);
    }
  }
  return toDelete;
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/college-erp';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');

  console.log('=== Checking IT Subject duplicates ===');
  const dupSubjectIds = await findDuplicates(Subject, 'Subject');
  console.log(`Total duplicate subjects: ${dupSubjectIds.length}`);

  console.log('\n=== Checking IT Lab duplicates ===');
  const dupLabIds = await findDuplicates(Lab, 'Lab');
  console.log(`Total duplicate labs: ${dupLabIds.length}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes made. Run with --delete to remove.');
    await mongoose.disconnect();
    return;
  }

  if (dupSubjectIds.length) {
    await FacultyTeachingAssignment.deleteMany({ itemType: 'class', subjectId: { $in: dupSubjectIds } });
    const r = await Subject.deleteMany({ _id: { $in: dupSubjectIds } });
    console.log(`\nDeleted ${r.deletedCount} duplicate subjects.`);
  }
  if (dupLabIds.length) {
    await FacultyTeachingAssignment.deleteMany({ itemType: 'lab', labId: { $in: dupLabIds } });
    const r = await Lab.deleteMany({ _id: { $in: dupLabIds } });
    console.log(`Deleted ${r.deletedCount} duplicate labs.`);
  }

  console.log('\nDone!');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
