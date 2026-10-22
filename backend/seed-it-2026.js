/**
 * Direct DB seeder — IT Department, Session 2026-2027
 * Adds subjects, labs, assigns faculty, then creates teaching assignments.
 * Run: node seed-it-2026.js
 *
 * Faculty:
 *  Shalini Dwivedi      (Associate Prof)   → id: 6a2a97018e830cf6933715d2
 *  Rajesh Sharma        (Associate Prof)   → id: 69e7cf099508057e1e800b36
 *  Abhinav Mehrotra     (Professor)        → id: 6a2a97098e830cf6933715f5
 *  Prachi Srivastava    (Assistant Prof)   → id: 6a2a970b8e830cf6933715fc
 *  Ishita Kapoor        (Assistant Prof)   → id: 6a2a970e8e830cf69337160a
 *  Saurabh Bansal       (Assistant Prof)   → id: 6a2a97068e830cf6933715e7
 *  Manish Saxena        (Assistant Prof)   → id: 6a2a97038e830cf6933715d9
 *  Vivek Rastogi        (Associate Prof)   → id: 6a2a970c8e830cf693371603
 *  Niharika Tandon      (Professor)        → id: 6a2a97048e830cf6933715e0
 *  Garima Awasthi       (Associate Prof)   → id: 6a2a97078e830cf6933715ee
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('❌ MONGODB_URI not found. Set it in backend/.env');
  process.exit(1);
}

const SESSION  = '2026-2027';
const BRANCH   = 'IT';

// Faculty ID aliases for readability
const F = {
  shalini:   '6a2a97018e830cf6933715d2',
  rajesh:    '69e7cf099508057e1e800b36',
  abhinav:   '6a2a97098e830cf6933715f5',
  prachi:    '6a2a970b8e830cf6933715fc',
  ishita:    '6a2a970e8e830cf69337160a',
  saurabh:   '6a2a97068e830cf6933715e7',
  manish:    '6a2a97038e830cf6933715d9',
  vivek:     '6a2a970c8e830cf693371603',
  niharika:  '6a2a97048e830cf6933715e0',
  garima:    '6a2a97078e830cf6933715ee',
};

/**
 * SCHEME DATA — based on SGITS&S IT dept scheme
 * Theory subjects: theoryEndMax=70, cwMax=30, practicalEndMax=0, swMax=0
 * Lab subjects:    theoryEndMax=0,  cwMax=0,  practicalEndMax=60, swMax=40
 *
 * NOTE: 'linkedTheoryCodes' — lab auto-inherits theory's faculty PLUS its own.
 */

// ─── SEMESTER 1 ───────────────────────────────────────────────────────────────
const SEM1_SUBJECTS = [
  { code: 'MA10001', name: 'Mathematics – I',                          category: 'BSC',  l:3, t:1, p:0, credits:4, faculty:[F.niharika],  theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'PH10017', name: 'Physics',                                  category: 'BSC',  l:3, t:1, p:0, credits:3, faculty:[F.abhinav],   theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'CE10013', name: 'Fundamentals of Civil Engineering & AM',   category: 'ESC',  l:2, t:1, p:0, credits:3, faculty:[F.manish],    theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'ME10149', name: 'Engineering Graphics',                     category: 'ESC',  l:2, t:0, p:0, credits:2, faculty:[F.saurabh],   theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'EE10015', name: 'Fundamentals of Electrical Engineering',   category: 'ESC',  l:2, t:1, p:0, credits:3, faculty:[F.rajesh],    theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'HU10191', name: 'Extra Curricular Activity',                category: 'MC',   l:0, t:0, p:2, credits:1, faculty:[F.garima],    theoryEndMax:0,  cwMax:0,  practicalEndMax:50, swMax:0  },
  { code: 'HU10001', name: 'Induction Program in Universal Human Value', category: 'MC', l:0, t:0, p:2, credits:0, faculty:[F.garima],   theoryEndMax:0,  cwMax:0,  practicalEndMax:0,  swMax:0  },
];

const SEM1_LABS = [
  { code: 'PH10151', name: 'Applied Physics Lab',       category: 'BSC',       l:0, t:0, p:2, credits:1, faculty:[F.abhinav],  theoryEndMax:0, cwMax:0, practicalEndMax:30, swMax:20,
    linkedTheoryCodes: ['PH10017'] },
  { code: 'ME10153', name: 'Engineering Graphics Lab',  category: 'ESC',       l:0, t:0, p:4, credits:2, faculty:[F.saurabh],  theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40,
    linkedTheoryCodes: ['ME10149'] },
  { code: 'EE10152', name: 'Fundamentals of EE Lab',    category: 'ESC',       l:0, t:0, p:2, credits:1, faculty:[F.rajesh],   theoryEndMax:0, cwMax:0, practicalEndMax:30, swMax:20,
    linkedTheoryCodes: ['EE10015'] },
];

// ─── SEMESTER 2 ───────────────────────────────────────────────────────────────
const SEM2_SUBJECTS = [
  { code: 'MA10501', name: 'Mathematics – II',                         category: 'BSC',  l:3, t:1, p:0, credits:4, faculty:[F.niharika],  theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'CH10516', name: 'Chemistry',                                category: 'BSC',  l:3, t:0, p:0, credits:3, faculty:[F.abhinav],   theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'HU10551', name: 'Technical English',                        category: 'HSMC', l:2, t:0, p:0, credits:2, faculty:[F.garima],    theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'CO10507', name: 'Programming for Problem Solving',          category: 'ESC',  l:2, t:1, p:0, credits:3, faculty:[F.shalini, F.prachi], theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'EC10508', name: 'Basic Electronics Engineering',            category: 'ESC',  l:2, t:0, p:0, credits:2, faculty:[F.vivek],     theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'HU10691', name: 'Extra Curricular Activity',               category: 'MC',   l:0, t:0, p:2, credits:1, faculty:[F.garima],    theoryEndMax:0,  cwMax:0,  practicalEndMax:50, swMax:0  },
];

const SEM2_LABS = [
  { code: 'CH10656', name: 'Chemistry Lab',                 category: 'BSC',  l:0, t:0, p:2, credits:1, faculty:[F.abhinav],          theoryEndMax:0, cwMax:0, practicalEndMax:70, swMax:30, linkedTheoryCodes:['CH10516'] },
  { code: 'HU10651', name: 'Language Lab',                  category: 'HSMC', l:0, t:0, p:2, credits:1, faculty:[F.garima],            theoryEndMax:0, cwMax:0, practicalEndMax:70, swMax:30, linkedTheoryCodes:['HU10551'] },
  { code: 'CO10654', name: 'Computer Programming Lab',       category: 'ESC',  l:0, t:0, p:2, credits:1, faculty:[F.shalini, F.prachi], theoryEndMax:0, cwMax:0, practicalEndMax:70, swMax:30, linkedTheoryCodes:['CO10507'] },
  { code: 'IP10655', name: 'Manufacturing Practices',        category: 'ESC',  l:0, t:0, p:4, credits:2, faculty:[F.manish],            theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:[] },
];

// ─── SEMESTER 3 ───────────────────────────────────────────────────────────────
const SEM3_SUBJECTS = [
  { code: 'MA20001', name: 'Mathematics – III',                        category: 'BSC',  l:3, t:1, p:0, credits:4, faculty:[F.niharika],  theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT30101', name: 'Data Structures',                          category: 'PCC',  l:3, t:1, p:0, credits:4, faculty:[F.shalini, F.prachi], theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT30102', name: 'Digital Electronics',                      category: 'PCC',  l:3, t:0, p:0, credits:3, faculty:[F.vivek],     theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT30103', name: 'Object Oriented Programming',              category: 'PCC',  l:3, t:1, p:0, credits:4, faculty:[F.rajesh, F.ishita], theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT30104', name: 'Computer Organization & Architecture',     category: 'PCC',  l:3, t:0, p:0, credits:3, faculty:[F.abhinav],   theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'HU30191', name: 'Soft Skills',                              category: 'HSMC', l:2, t:0, p:0, credits:2, faculty:[F.garima],    theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
];

const SEM3_LABS = [
  { code: 'IT30151', name: 'Data Structures Lab',                category: 'PCC',  l:0, t:0, p:2, credits:1, faculty:[F.shalini, F.prachi], theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT30101'] },
  { code: 'IT30152', name: 'Digital Electronics Lab',             category: 'PCC',  l:0, t:0, p:2, credits:1, faculty:[F.vivek, F.manish],   theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT30102'] },
  { code: 'IT30153', name: 'OOP Lab (Java/C++)',                  category: 'PCC',  l:0, t:0, p:2, credits:1, faculty:[F.rajesh, F.ishita],   theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT30103'] },
];

// ─── SEMESTER 4 ───────────────────────────────────────────────────────────────
const SEM4_SUBJECTS = [
  { code: 'MA20501', name: 'Mathematics – IV (Probability & Stats)',   category: 'BSC',  l:3, t:1, p:0, credits:4, faculty:[F.niharika],  theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT40201', name: 'Operating Systems',                        category: 'PCC',  l:3, t:0, p:0, credits:3, faculty:[F.saurabh],   theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT40202', name: 'Computer Networks',                        category: 'PCC',  l:3, t:1, p:0, credits:4, faculty:[F.rajesh, F.vivek], theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT40203', name: 'Database Management Systems',              category: 'PCC',  l:3, t:1, p:0, credits:4, faculty:[F.shalini, F.ishita], theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT40204', name: 'Software Engineering',                     category: 'PCC',  l:3, t:0, p:0, credits:3, faculty:[F.abhinav],   theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
];

const SEM4_LABS = [
  { code: 'IT40251', name: 'Operating Systems Lab',    category: 'PCC',  l:0, t:0, p:2, credits:1, faculty:[F.saurabh, F.manish],  theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT40201'] },
  { code: 'IT40252', name: 'Computer Networks Lab',    category: 'PCC',  l:0, t:0, p:2, credits:1, faculty:[F.rajesh, F.vivek],    theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT40202'] },
  { code: 'IT40253', name: 'DBMS Lab',                 category: 'PCC',  l:0, t:0, p:2, credits:1, faculty:[F.shalini, F.ishita],  theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT40203'] },
];

// ─── SEMESTER 5 ───────────────────────────────────────────────────────────────
const SEM5_SUBJECTS = [
  { code: 'IT38001', name: 'Computer Networks (Advanced)',             category: 'PCC',  l:3, t:0, p:0, credits:3, faculty:[F.rajesh],    theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT38002', name: 'Database Management Systems (Advanced)',   category: 'PCC',  l:3, t:1, p:0, credits:4, faculty:[F.shalini],   theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT38003', name: 'Operating Systems',                        category: 'PCC',  l:3, t:0, p:0, credits:3, faculty:[F.saurabh],   theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT38004', name: 'Open Elective – I',                       category: 'OEC',  l:3, t:1, p:0, credits:4, faculty:[F.abhinav],   theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0, electiveOptions:['Artificial Intelligence','Machine Learning','Data Science','IoT'] },
  { code: 'IT38005', name: 'Theory of Computation',                   category: 'PCC',  l:3, t:1, p:0, credits:4, faculty:[F.niharika],  theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
];

const SEM5_LABS = [
  { code: 'IT38051', name: 'Computer Networks Lab',         category: 'PCC', l:0, t:0, p:2, credits:1, faculty:[F.rajesh, F.vivek],   theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT38001'] },
  { code: 'IT38052', name: 'DBMS Lab',                      category: 'PCC', l:0, t:0, p:2, credits:1, faculty:[F.shalini, F.ishita],  theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT38002'] },
  { code: 'IT38053', name: 'Operating Systems Lab',         category: 'PCC', l:0, t:0, p:2, credits:1, faculty:[F.saurabh, F.manish],  theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT38003'] },
  { code: 'IT38054', name: 'Skill Lab – II (Mobile App)',   category: 'PCC', l:0, t:0, p:2, credits:1, faculty:[F.prachi, F.garima],   theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:[] },
];

// ─── SEMESTER 6 ───────────────────────────────────────────────────────────────
const SEM6_SUBJECTS = [
  { code: 'IT48001', name: 'Compiler Design',                          category: 'PCC',  l:3, t:1, p:0, credits:4, faculty:[F.vivek],     theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT48002', name: 'Artificial Intelligence',                  category: 'PCC',  l:3, t:1, p:0, credits:4, faculty:[F.abhinav, F.garima], theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT48003', name: 'Professional Elective – I',                category: 'PEC',  l:3, t:0, p:0, credits:3, faculty:[F.niharika],  theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0, electiveOptions:['Cloud Computing','Big Data Analytics','Cyber Security'] },
  { code: 'IT48004', name: 'Open Elective – II',                       category: 'OEC',  l:3, t:0, p:0, credits:3, faculty:[F.manish],    theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0, electiveOptions:['Entrepreneurship','Environmental Science','Indian Knowledge System'] },
  { code: 'HU48001', name: 'Constitution of India',                    category: 'MC',   l:2, t:0, p:0, credits:0, faculty:[F.garima],    theoryEndMax:50, cwMax:0,  practicalEndMax:0, swMax:0 },
];

const SEM6_LABS = [
  { code: 'IT48051', name: 'Compiler Design Lab',      category: 'PCC', l:0, t:0, p:2, credits:1, faculty:[F.vivek, F.saurabh],   theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT48001'] },
  { code: 'IT48052', name: 'AI Lab',                   category: 'PCC', l:0, t:0, p:2, credits:1, faculty:[F.abhinav, F.garima],  theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT48002'] },
  { code: 'IT48053', name: 'Mini Project',             category: 'PRO', l:0, t:0, p:4, credits:2, faculty:[F.shalini, F.rajesh],  theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:[] },
];

// ─── SEMESTER 7 ───────────────────────────────────────────────────────────────
const SEM7_SUBJECTS = [
  { code: 'IT48101', name: 'Information Security',                     category: 'PCC',  l:3, t:0, p:0, credits:3, faculty:[F.rajesh],    theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0 },
  { code: 'IT48102', name: 'Professional Elective – II',               category: 'PEC',  l:3, t:0, p:0, credits:3, faculty:[F.abhinav],   theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0, electiveOptions:['Computer Graphics','Game Theory (NPTEL)','Human Computer Interaction'] },
  { code: 'IT48103', name: 'Industrial Training',                      category: 'INT',  l:0, t:0, p:0, credits:4, faculty:[F.niharika],  theoryEndMax:0,  cwMax:0,  practicalEndMax:100, swMax:0 },
  { code: 'IT48104', name: 'Major Project',                            category: 'PRO',  l:0, t:0, p:8, credits:4, faculty:[F.shalini, F.vivek, F.abhinav], theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40 },
];

const SEM7_LABS = [
  { code: 'IT48151', name: 'Information Security Lab',  category: 'PCC', l:0, t:0, p:2, credits:1, faculty:[F.rajesh, F.manish],  theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:['IT48101'] },
  { code: 'IT48152', name: 'Data Visualisation Lab',    category: 'PCC', l:0, t:0, p:2, credits:1, faculty:[F.garima, F.ishita],  theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:[] },
];

// ─── SEMESTER 8 ───────────────────────────────────────────────────────────────
const SEM8_SUBJECTS = [
  { code: 'IT58001', name: 'Professional Elective – III',             category: 'PEC',  l:3, t:0, p:0, credits:3, faculty:[F.vivek],     theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0, electiveOptions:['Soft Computing','Natural Language Processing','Blockchain'] },
  { code: 'IT58002', name: 'Open Elective – III',                     category: 'OEC',  l:3, t:0, p:0, credits:3, faculty:[F.prachi],    theoryEndMax:70, cwMax:30, practicalEndMax:0, swMax:0, electiveOptions:['Management Information System','IPR & Patents','Design Thinking'] },
];

const SEM8_LABS = [
  { code: 'IT58051', name: 'Major Project (Continued)',  category: 'PRO', l:0, t:0, p:8, credits:4, faculty:[F.shalini, F.vivek, F.abhinav], theoryEndMax:0, cwMax:0, practicalEndMax:60, swMax:40, linkedTheoryCodes:[] },
  { code: 'IT58052', name: 'Seminar',                    category: 'PCC', l:0, t:0, p:2, credits:1, faculty:[F.niharika, F.garima],           theoryEndMax:0, cwMax:0, practicalEndMax:50, swMax:50, linkedTheoryCodes:[] },
];

// ─── All semester data ────────────────────────────────────────────────────────
const SCHEME = {
  1: { subjects: SEM1_SUBJECTS, labs: SEM1_LABS },
  2: { subjects: SEM2_SUBJECTS, labs: SEM2_LABS },
  3: { subjects: SEM3_SUBJECTS, labs: SEM3_LABS },
  4: { subjects: SEM4_SUBJECTS, labs: SEM4_LABS },
  5: { subjects: SEM5_SUBJECTS, labs: SEM5_LABS },
  6: { subjects: SEM6_SUBJECTS, labs: SEM6_LABS },
  7: { subjects: SEM7_SUBJECTS, labs: SEM7_LABS },
  8: { subjects: SEM8_SUBJECTS, labs: SEM8_LABS },
};

// ─── Run seeder ───────────────────────────────────────────────────────────────
async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const Subject = require('./src/models/Subject');
  const Lab     = require('./src/models/Lab');
  const FacultyTeachingAssignment = require('./src/models/FacultyTeachingAssignment');

  let subjectCount = 0, labCount = 0, assignmentCount = 0, skipped = 0;

  for (const [semStr, data] of Object.entries(SCHEME)) {
    const semester = Number(semStr);
    const term = semester % 2 === 0 ? 'january-june' : 'july-december';

    // ── Subjects ──
    for (const s of data.subjects) {
      const existing = await Subject.findOne({ code: s.code, session: SESSION, branch: BRANCH, semester }).lean();
      if (existing) { console.log(`  ⏭ Subject exists: ${s.code}`); skipped++; continue; }

      const subjectDoc = await Subject.create({
        code: s.code, name: s.name, type: 'theory',
        branch: BRANCH, semester, session: SESSION,
        category: s.category,
        l: s.l, t: s.t, p: s.p, credits: s.credits,
        theoryEndMax: s.theoryEndMax, cwMax: s.cwMax,
        practicalEndMax: s.practicalEndMax, swMax: s.swMax,
        electiveOptions: s.electiveOptions || [],
        syllabusText: '',
        facultyId: s.faculty[0] || null,
      });
      subjectCount++;
      console.log(`  ✅ Subject: ${s.code} — ${s.name} (Sem ${semester})`);

      // Create teaching assignments for all faculty
      for (const fId of (s.faculty || [])) {
        const dup = await FacultyTeachingAssignment.findOne({
          facultyId: fId, subjectId: subjectDoc._id, session: SESSION, term,
        }).lean();
        if (!dup) {
          await FacultyTeachingAssignment.create({
            facultyId: fId, subjectId: subjectDoc._id, itemType: 'class',
            session: SESSION, term, semester, branch: BRANCH,
          });
          assignmentCount++;
        }
      }
    }

    // ── Labs ──
    for (const l of data.labs) {
      const existing = await Lab.findOne({ code: l.code, session: SESSION, branch: BRANCH, semester }).lean();
      if (existing) { console.log(`  ⏭ Lab exists: ${l.code}`); skipped++; continue; }

      // Merge theory faculty for linked subjects
      let allFacultyIds = [...(l.faculty || [])];
      for (const tCode of (l.linkedTheoryCodes || [])) {
        const theorySubject = await Subject.findOne({ code: tCode, session: SESSION, branch: BRANCH, semester }).lean();
        if (theorySubject && theorySubject.facultyId) {
          const fid = String(theorySubject.facultyId);
          if (!allFacultyIds.includes(fid)) allFacultyIds.push(fid);
        }
        // Also check teaching assignments for that theory subject
        const theoryDoc = await Subject.findOne({ code: tCode, session: SESSION, branch: BRANCH, semester }).lean();
        if (theoryDoc) {
          const theoryAssignments = await FacultyTeachingAssignment.find({
            subjectId: theoryDoc._id, session: SESSION,
          }).select('facultyId').lean();
          for (const ta of theoryAssignments) {
            const fid = String(ta.facultyId);
            if (!allFacultyIds.includes(fid)) allFacultyIds.push(fid);
          }
        }
      }
      // Deduplicate
      allFacultyIds = [...new Set(allFacultyIds.filter(Boolean))];

      const labDoc = await Lab.create({
        code: l.code, name: l.name,
        branch: BRANCH, semester, session: SESSION,
        category: l.category,
        l: l.l, t: l.t, p: l.p, credits: l.credits,
        theoryEndMax: l.theoryEndMax, cwMax: l.cwMax,
        practicalEndMax: l.practicalEndMax, swMax: l.swMax,
        syllabusText: '',
        facultyId: allFacultyIds[0] || null,
      });
      labCount++;
      console.log(`  ✅ Lab: ${l.code} — ${l.name} (Sem ${semester}) — Faculty: ${allFacultyIds.length}`);

      // Teaching assignments for lab faculty (labs MUST use labId)
      for (const fId of allFacultyIds) {
        const dup = await FacultyTeachingAssignment.findOne({
          facultyId: fId, labId: labDoc._id, session: SESSION, term,
        }).lean();
        if (!dup) {
          await FacultyTeachingAssignment.create({
            facultyId: fId, labId: labDoc._id, itemType: 'lab',
            session: SESSION, term, semester, branch: BRANCH,
          });
          assignmentCount++;
        }
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  // Keep the legacy Faculty.subjectsTaught mirror in sync with the assignment
  // rows we just created, so admin screens and the faculty dashboard agree.
  const { syncAllFacultySubjectsTaught } = require('./src/utils/facultyAssignments');
  await syncAllFacultySubjectsTaught();
  console.log('✅ Synced Faculty.subjectsTaught with teaching assignments');
  console.log(`✅ Done!`);
  console.log(`   Subjects created:    ${subjectCount}`);
  console.log(`   Labs created:        ${labCount}`);
  console.log(`   Assignments created: ${assignmentCount}`);
  console.log(`   Skipped (existing):  ${skipped}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await mongoose.disconnect();
}

run().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
