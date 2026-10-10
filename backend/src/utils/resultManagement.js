const fs = require('fs');
const xlsx = require('xlsx');

const MARK_LIMITS = {
  cw: 30,
  sw: 40,
  theory: 70,
  midTerm: 30,
  endSem: 50,
  assignment: 10,
  quiz: 10,
  attendance: 10,
  practical: 60,
  total: 100,
};

const normalizeComponentMarks = (row = {}) => {
  const cw = Number(row.cw ?? row.CW ?? row.internalMarks ?? 0);
  const sw = Number(row.sw ?? row.SW ?? 0);
  const theory = Number(row.theory ?? row.Theory ?? row.externalMarks ?? row.endSem ?? 0);
  return { cw, sw, theory };
};

const validateComponentMarks = ({ cw, sw, theory }) => {
  if (![cw, sw, theory].every(Number.isFinite)) return 'CW, SW and Theory must be valid numbers';
  if (cw < 0 || cw > 30) return 'CW must be between 0 and 30';
  if (sw < 0 || sw > 40) return 'SW must be between 0 and 40';
  if (theory < 0 || theory > 70) return 'Theory must be between 0 and 70';
  return null;
};

const computeComponentTotal = ({ cw, sw, theory }) => cw + sw + theory;

const calculateAssessment = ({ itemType = 'class', cw = 0, sw = 0, theory = 0, practical = 0 }) => {
  const [normalizedCw, normalizedSw, normalizedTheory, normalizedPractical] = [cw, sw, theory, practical].map(Number);
  const values = [normalizedCw, normalizedSw, normalizedTheory, normalizedPractical];
  if (values.some(value => !Number.isFinite(value))) return { error: 'Marks must be valid numbers' };
  if (itemType === 'lab') {
    if (normalizedSw < 0 || normalizedSw > 40) return { error: 'SW must be between 0 and 40' };
    if (normalizedPractical < 0 || normalizedPractical > 60) return { error: 'Practical must be between 0 and 60' };
    return { sw: normalizedSw, practical: normalizedPractical, totalMarks: normalizedSw + normalizedPractical, maxMarks: 100 };
  }
  if (normalizedCw < 0 || normalizedCw > 30) return { error: 'CW must be between 0 and 30' };
  if (normalizedTheory < 0 || normalizedTheory > 70) return { error: 'Theory must be between 0 and 70' };
  return { cw: normalizedCw, theory: normalizedTheory, totalMarks: normalizedCw + normalizedTheory, maxMarks: 100 };
};

const calculateGrade = (marks) => {
  const band = findBand(marks);
  return { grade: band.grade, gradePoints: band.point };
};

const calculateSemesterSummary = (subjectMarks = []) => {
  const totalCredits = subjectMarks.reduce((sum, mark) => sum + Number(mark.credits || 0), 0);
  const totalCreditPoints = subjectMarks.reduce((sum, mark) => sum + Number(mark.creditPoints || 0), 0);
  const totalMarks = subjectMarks.reduce((sum, mark) => sum + Number(mark.totalMarks || 0), 0);
  const totalMaxMarks = subjectMarks.length * 100;
  const earnedCredits = subjectMarks.reduce((sum, mark) => (
    sum + (Number(mark.gradePoints || 0) > 0 ? Number(mark.credits || 0) : 0)
  ), 0);
  return {
    totalCredits,
    earnedCredits,
    sgpa: totalCredits ? Number((totalCreditPoints / totalCredits).toFixed(2)) : 0,
    percentage: totalMaxMarks ? Number(((totalMarks / totalMaxMarks) * 100).toFixed(2)) : 0,
    status: subjectMarks.every(mark => Number(mark.gradePoints || 0) > 0) ? 'pass' : 'fail',
  };
};

const DEFAULT_GRADE_BANDS = [
  { min: 80, max: 100, grade: 'A', point: 10 },
  { min: 70, max: 79.99, grade: 'B', point: 9 },
  { min: 60, max: 69.99, grade: 'C', point: 8 },
  { min: 50, max: 59.99, grade: 'D', point: 7 },
  { min: 40, max: 49.99, grade: 'E', point: 6 },
  { min: 0, max: 39.99, grade: 'F (FAIL)', point: 0 },
];

const normalizeRow = (row = {}) => ({
  enrollmentNo: String(row.EnrollmentNo || row.enrollmentNo || row['Enrollment No'] || '').trim(),
  studentName: String(row.StudentName || row.studentName || row['Student Name'] || '').trim(),
  midTerm: Number(row.MidTermMarks || row.midTerm || row.midTermMarks || 0),
  endSem: Number(row.EndSemMarks || row.endSem || row.endSemMarks || 0),
  assignment: Number(row.AssignmentMarks || row.assignment || row.assignmentMarks || 0),
  quiz: Number(row.QuizMarks || row.quiz || row.quizMarks || 0),
  attendance: Number(row.AttendanceMarks || row.attendance || row.attendanceMarks || 0),
  practical: Number(row.PracticalMarks || row.practical || row.practicalMarks || 0),
  totalMarks: Number(row.TotalMarks || row.total || row.totalMarks || 0),
});

const computeTotal = (row) => (
  (Number(row.midTerm) || 0)
  + (Number(row.endSem) || 0)
  + (Number(row.assignment) || 0)
  + (Number(row.quiz) || 0)
  + (Number(row.attendance) || 0)
  + (Number(row.practical) || 0)
);

const hasEmptyMarkRow = (row) => {
  const values = [row.midTerm, row.endSem, row.assignment, row.quiz, row.attendance, row.practical]
    .map(v => Number(v) || 0);
  return values.every(v => v === 0);
};

const validateMarkValue = (name, value, max) => {
  if (!Number.isFinite(value)) return `${name} is not a valid number`;
  if (value < 0) return `${name} cannot be negative`;
  if (value > max) return `${name} cannot be greater than ${max}`;
  return null;
};

const parseSheetRows = (filePath) => {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet, { defval: '' });
};

const cleanupUploadedFile = (filePath) => {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    // Intentionally ignore cleanup failures.
  }
};

const findBand = (marks, bands = DEFAULT_GRADE_BANDS) => {
  const value = Number(marks) || 0;
  const matched = bands.find(b => value >= b.min && value <= b.max);
  return matched || { grade: 'F (FAIL)', point: 0 };
};

module.exports = {
  MARK_LIMITS,
  normalizeComponentMarks,
  validateComponentMarks,
  computeComponentTotal,
  calculateAssessment,
  calculateGrade,
  calculateSemesterSummary,
  DEFAULT_GRADE_BANDS,
  normalizeRow,
  computeTotal,
  hasEmptyMarkRow,
  validateMarkValue,
  parseSheetRows,
  cleanupUploadedFile,
  findBand,
};
