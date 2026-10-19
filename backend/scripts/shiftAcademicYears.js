require('dotenv').config();
const mongoose = require('mongoose');
const TimetableEntry = require('../src/models/TimetableEntry');

const MIGRATION_ID = 'shiftAcademicYears-2026';
const SHIFTS = [
  { from: '2026-2027', to: '2025-2026' },
  { from: '2027-2028', to: '2026-2027' },
];
const UNIQUE_KEY_FIELDS = ['academicYear', 'room', 'day', 'slots'];
const FACULTY_KEY_FIELDS = ['academicYear', 'faculty', 'day', 'slots'];

const keyFor = (entry, fields) => fields.map(field => {
  const value = entry[field];
  return Array.isArray(value) ? value.join(',') : String(value);
}).join('|');

async function counts() {
  const rows = await TimetableEntry.aggregate([
    { $group: { _id: '$academicYear', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return Object.fromEntries(rows.map(row => [row._id, row.count]));
}

function printCounts(label, result) {
  console.log(`${label}:`);
  const years = Object.keys(result).sort();
  if (!years.length) console.log('  (no timetable entries)');
  years.forEach(year => console.log(`  ${year}: ${result[year]}`));
}

async function assertNoCollisions(entries) {
  const byIndex = [
    ['room/day/slots', UNIQUE_KEY_FIELDS],
    ['faculty/day/slots', FACULTY_KEY_FIELDS],
  ];
  for (const [label, fields] of byIndex) {
    const seen = new Map();
    entries.forEach(entry => {
      const key = keyFor(entry, fields);
      const previous = seen.get(key);
      if (previous) {
        throw new Error(`Unique index collision for ${label}: ${previous._id} and ${entry._id} (${key})`);
      }
      seen.set(key, entry);
    });
  }
}

async function ensureSafeState() {
  const marker = await mongoose.connection.db.collection('migrations').findOne({ _id: MIGRATION_ID });
  if (marker) {
    throw new Error(`Migration ${MIGRATION_ID} has already been recorded on ${marker.completedAt || marker.createdAt || 'an earlier run'}. No changes made.`);
  }

  const current = await counts();
  const sourceCount = SHIFTS.reduce((sum, shift) => sum + (current[shift.from] || 0), 0);
  const targetCount = SHIFTS.reduce((sum, shift) => sum + (current[shift.to] || 0), 0);
  if (!sourceCount && targetCount) {
    throw new Error('Source academic years are empty while target years already contain entries. Data may already be shifted. No changes made.');
  }

  const entries = await TimetableEntry.find({
    academicYear: { $in: SHIFTS.map(shift => shift.from) },
  }).select('_id academicYear room faculty day slots').lean();
  const existing = await TimetableEntry.find({
    academicYear: { $in: SHIFTS.map(shift => shift.to) },
  }).select('_id academicYear room faculty day slots').lean();
  const projected = [
    ...existing,
    ...entries.map(entry => ({
      ...entry,
      academicYear: SHIFTS.find(shift => shift.from === entry.academicYear).to,
    })),
  ];
  await assertNoCollisions(projected);
  return { current, entries };
}

async function updateWithRollback(entries) {
  const original = entries.map(entry => ({ _id: entry._id, academicYear: entry.academicYear }));
  const session = await mongoose.startSession();
  try {
    try {
      session.startTransaction();
      for (const shift of SHIFTS) {
        await TimetableEntry.updateMany(
          { academicYear: shift.from },
          { $set: { academicYear: shift.to } },
          { session },
        );
      }
      await mongoose.connection.db.collection('migrations').insertOne({
        _id: MIGRATION_ID,
        type: 'TimetableEntry academic year shift',
        shifts: SHIFTS,
        completedAt: new Date(),
        updatedEntries: entries.length,
      }, { session });
      await session.commitTransaction();
      return 'transaction';
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      if (!/transaction|replica set|mongos|session/i.test(error.message)) throw error;
      console.warn(`MongoDB transaction unavailable (${error.message}). Retrying with rollback protection.`);
    }
  } finally {
    await session.endSession();
  }

  try {
    for (const shift of SHIFTS) {
      await TimetableEntry.updateMany({ academicYear: shift.from }, { $set: { academicYear: shift.to } });
    }
    await mongoose.connection.db.collection('migrations').insertOne({
      _id: MIGRATION_ID,
      type: 'TimetableEntry academic year shift',
      shifts: SHIFTS,
      completedAt: new Date(),
      updatedEntries: entries.length,
      rollbackProtected: true,
    });
    return 'rollback-protected';
  } catch (error) {
    await TimetableEntry.bulkWrite(original.map(entry => ({
      updateOne: { filter: { _id: entry._id }, update: { $set: { academicYear: entry.academicYear } } },
    })));
    throw new Error(`Migration failed and attempted rollback of ${original.length} entries: ${error.message}`);
  }
}

async function auditAcademicYearCollections() {
  const collections = await mongoose.connection.db.listCollections().toArray();
  const results = [];
  for (const collection of collections) {
    const name = collection.name;
    if (name === 'timetableentries') continue;
    const sample = await mongoose.connection.db.collection(name).findOne({ academicYear: { $exists: true } }, { projection: { _id: 1 } });
    if (sample) results.push(name);
  }
  return results;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const { current, entries } = await ensureSafeState();
  printCounts('Current TimetableEntry counts', current);
  SHIFTS.forEach(shift => console.log(`  Convert ${shift.from} -> ${shift.to}: ${current[shift.from] || 0}`));
  console.log(`  Total documents to update: ${entries.length}`);
  const otherCollections = await auditAcademicYearCollections();
  console.log(`Other collections containing academicYear: ${otherCollections.length ? otherCollections.join(', ') : '(none found)'}`);

  const confirmed = process.argv.includes('--confirm');
  if (!confirmed) {
    console.log('DRY RUN ONLY: no data changed. Re-run with --confirm to apply this migration.');
    return;
  }

  const mode = await updateWithRollback(entries);
  printCounts('New TimetableEntry counts', await counts());
  console.log(`Migration applied using ${mode}. Only TimetableEntry.academicYear was changed.`);
}

main()
  .catch(error => {
    console.error(`Migration stopped: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
