/**
 * mark-year1-common.js — mark all Sem 1 & 2 subjects and labs for the
 * 2026-2027 session as isCommon=true (Year 1 universal scheme).
 * Run: node backend/scripts/mark-year1-common.js
 */
'use strict';
const mongoose = require('mongoose');
const path     = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Subject = require('../src/models/Subject');
const Lab     = require('../src/models/Lab');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/college-erp');
  console.log('Connected\n');

  const sessions = ['2026-2027'];

  for (const session of sessions) {
    const [rs, rl] = await Promise.all([
      Subject.updateMany({ session, semester: { $in: [1, 2] } }, { $set: { isCommon: true } }),
      Lab.updateMany(    { session, semester: { $in: [1, 2] } }, { $set: { isCommon: true } }),
    ]);
    console.log(`[${session}] Subjects marked: ${rs.modifiedCount} | Labs marked: ${rl.modifiedCount}`);
  }

  console.log('\nDone — all Year 1 (Sem 1 & 2) entries are now marked isCommon=true.');
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
