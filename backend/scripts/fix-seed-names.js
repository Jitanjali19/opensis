/**
 * fix-seed-names.js — rename ambiguously-named IT Sem 5 subjects/labs
 * so they don't look like duplicates of the Sem 4 ones.
 * Run: node backend/scripts/fix-seed-names.js
 */
'use strict';
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Subject = require('../src/models/Subject');
const Lab     = require('../src/models/Lab');

const RENAMES = [
  // [collection, oldCode, newName]
  // Sem 5 lab was named identically to Sem 4's lab
  { model: Lab,     code: 'IT38051', name: 'Advanced Networks Lab' },
  // Sem 6 mini project lab — make it more descriptive
  { model: Lab,     code: 'IT48053', name: 'Mini Project Lab' },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/college-erp');
  console.log('Connected\n');

  for (const { model, code, name } of RENAMES) {
    const item = await model.findOne({ code, branch: 'IT' });
    if (!item) { console.log(`  [SKIP] ${code} not found`); continue; }
    const old = item.name;
    item.name = name;
    await item.save();
    console.log(`  [RENAMED] ${code}: "${old}" → "${name}"`);
  }

  console.log('\nDone');
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
