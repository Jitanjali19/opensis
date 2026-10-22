const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const academicConfig = require('../../../shared/academicConfig.json');

const DEPARTMENT_LABELS = academicConfig.DEPARTMENT_LABELS || {};
const ROMAN_SEMESTERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const YEAR_CLASS = { 1: 'FY', 2: 'SY', 3: 'TY', 4: 'Final Year' };

const COLLEGE = {
  name: 'SHRI G. S. INSTITUTE OF TECHNOLOGY AND SCIENCE, INDORE',
  address: '23, PARK ROAD, INDORE',
};

const INSTRUCTIONS = [
  'In case the student is detained to appear in any semester, this admit card & the exam appeared in Theory and Practical will stand automatically cancelled.',
  'Students should carry this admit card and any Photo ID during all Theory and Practical examinations.',
  'Mobile Phones/Pagers/Smart Watches/Electronic Gadgets except Scientific Calculator are strictly prohibited. If found, it will be treated as UFM (Unfair Means).',
  'Students should occupy their allotted seats 15 minutes prior to commencement of Exam.',
  'Student will not be allowed to move out of exam during 1st hour and Last half hour of the exam duration.',
  'Result of the candidate may be withheld till all the dues are paid by the student.',
];

const paperCodeFor = (code, suffix) => {
  const value = String(code || '').trim().toUpperCase();
  if (!value) return '';
  return /[TP]$/.test(value) ? value : `${value}${suffix}`;
};

const examMonthLabel = (session, term) => {
  const match = String(session || '').match(/^(\d{4})-(\d{4})$/);
  const startYear = match ? Number(match[1]) : new Date().getFullYear();
  const endYear = match ? Number(match[2]) : startYear + 1;
  return term === 'january-june' ? `May ${endYear}` : `Nov ${startYear}`;
};

const getPapers = async ({ session, semester, branch }) => {
  const filter = { session, branch, semester: Number(semester) };
  const fields = 'code name type credits';
  const [subjects, labs] = await Promise.all([
    Subject.find(filter).select(fields).sort({ code: 1 }).lean(),
    Lab.find(filter).select(fields).sort({ code: 1 }).lean(),
  ]);

  if (Number(semester) <= 2) {
    const subjectCodes = new Set(subjects.map(item => item.code));
    const labCodes = new Set(labs.map(item => item.code));
    const [commonSubjects, commonLabs] = await Promise.all([
      Subject.find({
        session,
        semester: Number(semester),
        isCommon: true,
        code: { $nin: [...subjectCodes] },
      }).select(fields).lean(),
      Lab.find({
        session,
        semester: Number(semester),
        isCommon: true,
        code: { $nin: [...labCodes] },
      }).select(fields).lean(),
    ]);
    subjects.push(...commonSubjects);
    labs.push(...commonLabs);
  }

  return [
    ...subjects.map(subject => ({
      code: subject.code,
      paperCode: paperCodeFor(subject.code, 'T'),
      subjectName: subject.name,
      subjectType: 'theory',
    })),
    ...labs.map(lab => ({
      code: lab.code,
      paperCode: paperCodeFor(lab.code, 'P'),
      subjectName: lab.name,
      subjectType: 'practical',
    })),
  ]
    .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''))
      || a.subjectType.localeCompare(b.subjectType))
    .map((entry, index) => ({
      srNo: index + 1,
      paperCode: entry.paperCode,
      subjectName: entry.subjectName,
      subjectType: entry.subjectType,
    }));
};

const buildAdmitCardPayload = async ({ student, session, term, semester, branch, year, sectionName }) => {
  const papers = await getPapers({ session, semester, branch });
  if (papers.length === 0) {
    throw new Error('No subjects or labs found for this semester');
  }

  const numericSemester = Number(semester);
  const numericYear = Number(year) || Math.ceil(numericSemester / 2);
  const yearClass = YEAR_CLASS[numericYear] || `Year ${numericYear}`;
  const branchLabel = (DEPARTMENT_LABELS[branch] || branch || '').toUpperCase();
  const monthLabel = examMonthLabel(session, term);

  return {
    studentId: student._id,
    session,
    term,
    examType: 'end-sem',
    branch,
    semester: numericSemester,
    section: sectionName || '',
    year: numericYear,
    examMonthLabel: monthLabel,
    papers,
    studentSnapshot: {
      name: `${student.firstName} ${student.lastName}`,
      enrollmentNo: student.enrollmentNo,
      classLabel: `${yearClass} B.Tech ${branch}`,
      sectionName: sectionName || '',
      semester: numericSemester,
      semesterLabel: ROMAN_SEMESTERS[numericSemester - 1] || String(numericSemester),
      gender: student.gender
        ? `${student.gender.charAt(0).toUpperCase()}${student.gender.slice(1)}`
        : '',
      programName: `B.Tech - ${branchLabel}`,
      branch,
      session,
      fatherName: student.fatherName,
      profilePhotoUrl: student.profilePhotoUrl,
      signatureUrl: student.signatureUrl,
    },
  };
};

const serializeAdmitCard = (card) => ({
  _id: card._id,
  studentId: card.studentId,
  session: card.session,
  term: card.term,
  examType: card.examType,
  college: COLLEGE,
  title: `EXAMINATION ADMIT CARD - Regular - ${card.examMonthLabel}`,
  student: card.studentSnapshot,
  exam: {
    examType: 'END',
    examCategory: 'end',
    title: 'End Semester Examination',
    session: card.session,
    term: card.term,
    timeNote: 'As per Time Table',
    entries: card.papers || [],
  },
  instructions: INSTRUCTIONS,
  issuedOn: card.generatedAt || card.createdAt,
});

module.exports = {
  buildAdmitCardPayload,
  serializeAdmitCard,
};
