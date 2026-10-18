require('dotenv').config();
const mongoose = require('mongoose');
const TimetableEntry = require('../src/models/TimetableEntry');
const User = require('../src/models/User');
const Faculty = require('../src/models/Faculty');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  const apply = process.argv.includes('--apply');
  const entries = await TimetableEntry.find().select('_id faculty').lean();
  let unchanged = 0;
  let migrated = 0;
  let unresolved = 0;

  for (const entry of entries) {
    const user = await User.findOne({ _id: entry.faculty, role: 'faculty' }).select('_id').lean();
    if (user) {
      unchanged += 1;
      continue;
    }

    const profile = await Faculty.findById(entry.faculty).select('userId').lean();
    if (!profile?.userId) {
      unresolved += 1;
      console.warn(`Could not resolve timetable entry ${entry._id}: faculty ${entry.faculty}`);
      continue;
    }

    migrated += 1;
    if (apply) await TimetableEntry.updateOne({ _id: entry._id }, { $set: { faculty: profile.userId } });
  }

  console.log(JSON.stringify({ apply, total: entries.length, unchanged, migrated, unresolved }, null, 2));
  if (!apply && migrated) console.log('No data changed. Re-run with --apply to migrate resolvable entries.');
}

migrate()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
