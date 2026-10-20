const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const Notice = require('../models/Notice');
const ExamSchedule = require('../models/ExamSchedule');
const Fee = require('../models/Fee');
const Result = require('../models/Result');
const Admin = require('../models/Admin');
const RevaluationRequest = require('../models/RevaluationRequest');
const { createStudentWorkbook, createFacultyWorkbook } = require('../utils/excelExport');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const {
  normalizeComponentMarks,
  validateComponentMarks,
  computeComponentTotal,
  calculateAssessment,
  calculateGrade,
  calculateSemesterSummary,
} = require('../utils/resultManagement');
const { isValidPhone, PHONE_ERROR_MESSAGE } = require('../utils/phoneValidation');
const Feedback = require('../models/Feedback');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');
const FeedbackConfig = require('../models/FeedbackConfig');
const StudentAcademicHistory = require('../models/StudentAcademicHistory');
const academicConfig = require('../../../shared/academicConfig.json');
const {
  termForSemester,
  normalizeFacultyIds,
  normalizeElectiveOptions,
  planAssignmentReconciliation,
} = require('../utils/scheme');

const normalizePhone = (value) => String(value ?? '').trim();

const getPhoneFromRow = (row) => normalizePhone(
  row.phone
  ?? row.Phone
  ?? row.phoneNumber
  ?? row.PhoneNumber
  ?? row.mobile
  ?? row.Mobile
);

const isValidPhoneAdmin = (phone) => !phone
  || (/^[0-9\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10);

const normalizeSessionValue = (value) => {
  const session = String(value || '').trim();
  const canonicalMatch = session.match(/^(\d{4})-(\d{4})$/);
  if (canonicalMatch) return session;

  const legacyMatch = session.match(/^(\d{4})-(\d{2})$/);
  if (legacyMatch) {
    const startYear = legacyMatch[1];
    return `${startYear}-${Number(startYear) + 1}`;
  }

  return session;
};

const buildSessionFilterValues = (value) => {
  const session = String(value || '').trim();
  if (!session) return [];

  const normalized = normalizeSessionValue(session);
  const values = [normalized];

  const canonicalMatch = normalized.match(/^(\d{4})-(\d{4})$/);
  if (canonicalMatch) {
    const startYear = canonicalMatch[1];
    values.push(`${startYear}-${String(Number(startYear) + 1).slice(-2)}`);
  }

  return [...new Set(values.filter(Boolean))];
};

const buildSessionRegex = (value) => {
  const session = String(value || '').trim();
  if (!session) return null;

  const normalized = normalizeSessionValue(session);
  const match = normalized.match(/^(\d{4})-(\d{4})$/);
  if (!match) return new RegExp(`^\\s*${session.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');

  const startYear = match[1];
  const fullEndYear = match[2];
  const shortEndYear = fullEndYear.slice(-2);
  return new RegExp(`^\\s*${startYear}-(?:${fullEndYear}|${shortEndYear})\\s*$`, 'i');
};

const YEAR_SEMESTER_MAP = {
  '1': [1, 2],
  '2': [3, 4],
  '3': [5, 6],
  '4': [7, 8],
};

const SEMESTER_SESSION_MAP = {
  'july-december': [1, 3, 5, 7],
  'january-june': [2, 4, 6, 8],
};

const normalizeStudentYear = (value, currentSemester) => {
  const directYear = Number(value);
  if (Number.isInteger(directYear) && directYear >= 1 && directYear <= 4) {
    return directYear;
  }

  const semesterNumber = Number(currentSemester);
  if (Number.isInteger(semesterNumber) && semesterNumber >= 1 && semesterNumber <= 8) {
    return Math.ceil(semesterNumber / 2);
  }

  return undefined;
};

const buildYearFilter = (value) => {
  const year = Number(value);
  const allowedSemesters = YEAR_SEMESTER_MAP[String(year)];
  if (!Number.isInteger(year) || !allowedSemesters) return null;

  return {
    $or: [
      { year },
      { currentSemester: { $in: allowedSemesters } },
    ],
  };
};

const formatYearLabel = (value) => {
  const year = Number(value);
  if (year === 1) return '1st Year';
  if (year === 2) return '2nd Year';
  if (year === 3) return '3rd Year';
  if (year === 4) return '4th Year';
  return '';
};

const normalizeStudentPayloadSession = (payload) => ({
  ...payload,
  session: normalizeSessionValue(payload.session),
});

// Students
exports.enrollStudent = async (req, res) => {
  try {
    const { email, password, enrollmentNo, firstName, lastName, branch, currentSemester, section, year, admissionYear, session, dob, gender, phone, address, fatherName, motherName } = req.body;
    const normalizedEnrollmentNo = String(enrollmentNo ?? '').trim();
    const normalizedSession = normalizeSessionValue(session);
    const normalizedYear = normalizeStudentYear(year ?? admissionYear, currentSemester);
    if (!isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: PHONE_ERROR_MESSAGE });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    if (!normalizedEnrollmentNo) {
      return res.status(400).json({ success: false, message: 'Enrollment number is required' });
    }

    const existingStudent = await Student.findOne({ enrollmentNo: normalizedEnrollmentNo });
    if (existingStudent) {
      return res.status(400).json({ success: false, message: 'Enrollment number already exists' });
    }

    const passwordHash = await bcrypt.hash(password || 'College@123', 12);
    const user = await User.create({ email, passwordHash, role: 'student' });

    const student = await Student.create({
      userId: user._id, enrollmentNo: normalizedEnrollmentNo, firstName, lastName, branch, currentSemester, section, year: normalizedYear, session: normalizedSession, dob, gender, phone, address, fatherName, motherName,
    });
    await StudentAcademicHistory.create({
      studentId: student._id,
      session: normalizedSession,
      semester: Number(currentSemester),
      year: normalizedYear,
      branch,
      section,
      term: Number(currentSemester) % 2 === 0 ? 'january-june' : 'july-december',
    });

    res.status(201).json({ success: true, data: { student } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const filter = {};
    const hasSessionFilter = Boolean(req.query.session);
    if (req.query.branch && !hasSessionFilter) filter.branch = req.query.branch;
    if (req.query.semesterSession && SEMESTER_SESSION_MAP[req.query.semesterSession] && !hasSessionFilter) {
      filter.currentSemester = { $in: SEMESTER_SESSION_MAP[req.query.semesterSession] };
    }
    if (req.query.semester && !hasSessionFilter) filter.currentSemester = Number(req.query.semester);
    let historyByStudent = new Map();
    if (req.query.session) {
      const historyFilter = { session: normalizeSessionValue(req.query.session) };
      if (req.query.branch) historyFilter.branch = req.query.branch;
      if (req.query.section) historyFilter.section = req.query.section;
      if (req.query.semesterSession && SEMESTER_SESSION_MAP[req.query.semesterSession]) {
        historyFilter.term = req.query.semesterSession;
      }
      if (req.query.semester) historyFilter.semester = Number(req.query.semester);
      if (req.query.year || req.query.admissionYear) {
        historyFilter.year = Number(req.query.year ?? req.query.admissionYear);
      }
      const history = await StudentAcademicHistory.find(historyFilter).lean();
      filter._id = { $in: history.map(item => item.studentId) };
      historyByStudent = new Map(history.map(item => [String(item.studentId), item]));
    }
    const yearFilter = buildYearFilter(req.query.year ?? req.query.admissionYear);
    if (yearFilter && !hasSessionFilter) Object.assign(filter, yearFilter);
    if (req.query.section && !hasSessionFilter) filter.section = req.query.section;
    if (req.query.gender) filter.gender = req.query.gender;
    if (req.query.search?.trim()) {
      const search = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchingUsers = await User.find(
        { email: new RegExp(search, 'i') },
        { _id: 1 }
      ).lean();
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { enrollmentNo: new RegExp(search, 'i') },
        { userId: { $in: matchingUsers.map(user => user._id) } },
      ];
    }
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [raw, total] = await Promise.all([
      Student.find(filter).populate('userId', 'email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Student.countDocuments(filter),
    ]);
    const students = raw.map(s => {
      const history = historyByStudent.get(String(s._id));
      return {
        ...s,
        ...(history ? {
          session: history.session,
          currentSemester: history.semester,
          year: history.year,
          branch: history.branch,
          section: history.section,
          term: history.term,
        } : {}),
        email: s.userId?.email,
      };
    });
    res.json({ success: true, data: { students, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudent = async (req, res) => {
  try {
    const raw = await Student.findById(req.params.id).populate('userId', 'email').lean();
    if (!raw) return res.status(404).json({ success: false, message: 'Student not found' });
    const student = { ...raw, email: raw.userId?.email };
    const academicHistory = await StudentAcademicHistory.find({ studentId: raw._id }).sort({ session: -1 }).lean();
    res.json({ success: true, data: { student, academicHistory } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.backfillAcademicHistory = async (req, res) => {
  try {
    try {
      await StudentAcademicHistory.collection.dropIndex('studentId_1_session_1');
    } catch (err) {
      if (err.codeName !== 'IndexNotFound') throw err;
    }
    await StudentAcademicHistory.collection.createIndex(
      { studentId: 1, session: 1, term: 1 },
      { unique: true }
    );
    const students = await Student.find({}).select('_id session currentSemester year branch section').lean();
    let created = 0;
    for (const student of students) {
      if (!student.session || !student.currentSemester) continue;
      const currentSession = normalizeSessionValue(student.session);
      const currentStart = Number(currentSession.slice(0, 4));
      const currentSemester = Number(student.currentSemester);
      for (let semester = currentSemester; semester >= 1; semester -= 1) {
        const semestersBack = currentSemester - semester;
        const sessionStart = currentStart - Math.ceil(semestersBack / 2);
        const session = `${sessionStart}-${sessionStart + 1}`;
        const term = semester % 2 === 0 ? 'january-june' : 'july-december';
        const result = await StudentAcademicHistory.updateOne(
          { studentId: student._id, session, term },
          {
            $set: {
              semester,
              year: Math.ceil(semester / 2),
              branch: student.branch,
              section: student.section,
              term,
            },
            $setOnInsert: {
              studentId: student._id,
              session,
            },
          },
          { upsert: true }
        );
        if (result.upsertedCount) created += 1;
      }
    }
    res.json({ success: true, data: { studentsScanned: students.length, recordsCreated: created } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAcademicHistory = async (req, res) => {
  try {
    const { session, semester, year, branch, section, status } = req.body;
    const record = await StudentAcademicHistory.findOneAndUpdate(
      { _id: req.params.historyId, studentId: req.params.id },
      {
        session: normalizeSessionValue(session),
        semester: Number(semester),
        year: Number(year),
        term: Number(semester) % 2 === 0 ? 'january-june' : 'july-december',
        branch,
        section,
        status,
      },
      { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Academic history record not found' });
    res.json({ success: true, data: { academicHistory: record } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const allowed = ['enrollmentNo', 'firstName', 'lastName', 'dob', 'gender', 'phone', 'address', 'fatherName', 'motherName', 'branch', 'currentSemester', 'section', 'year', 'admissionYear', 'session', 'profilePhotoUrl'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (update.phone !== undefined && !isValidPhone(update.phone)) {
      return res.status(400).json({ success: false, message: PHONE_ERROR_MESSAGE });
    }
    if (update.enrollmentNo !== undefined) update.enrollmentNo = String(update.enrollmentNo).trim();
    if (update.session !== undefined) update.session = normalizeSessionValue(update.session);
    if (update.year === undefined && update.admissionYear !== undefined) {
      update.year = normalizeStudentYear(update.admissionYear, update.currentSemester);
    }
    if (update.year === undefined && update.currentSemester !== undefined) {
      update.year = normalizeStudentYear(undefined, update.currentSemester);
    }

    if (update.enrollmentNo) {
      const duplicate = await Student.findOne({ enrollmentNo: update.enrollmentNo, _id: { $ne: req.params.id } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Enrollment number already exists' });
      }
    }

    const student = await Student.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: { student } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    await User.findByIdAndDelete(student.userId);
    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Faculty
exports.enrollFaculty = async (req, res) => {
  try {
    const { email, password, employeeId, firstName, lastName, department, designation, qualification, joiningDate, phone, address, subjectIds, personalEmail, gender, experience } = req.body;
    if (!isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: PHONE_ERROR_MESSAGE });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password || 'Faculty@123', 12);
    const user = await User.create({ email, passwordHash, role: 'faculty' });

    const assignedSubjects = Array.isArray(subjectIds) ? subjectIds.filter(Boolean) : [];
    const faculty = await Faculty.create({ userId: user._id, employeeId, firstName, lastName, department, designation, qualification, joiningDate, phone, address, personalEmail, gender, experience, subjectsTaught: assignedSubjects });

    if (assignedSubjects.length > 0) {
      await Subject.updateMany({ _id: { $in: assignedSubjects } }, { facultyId: faculty._id });
    }

    res.status(201).json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFaculty = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.search?.trim()) {
      const search = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchingUsers = await User.find(
        { email: new RegExp(search, 'i') },
        { _id: 1 }
      ).lean();
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { employeeId: new RegExp(search, 'i') },
        { department: new RegExp(search, 'i') },
        { designation: new RegExp(search, 'i') },
        { userId: { $in: matchingUsers.map(user => user._id) } },
      ];
    }
    const raw = await Faculty.find(filter).sort({ createdAt: -1 }).populate('userId', 'email').populate('subjectsTaught', 'code name').lean();
    const faculty = raw.map(f => ({ ...f, email: f.userId?.email }));
    res.json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFacultyById = async (req, res) => {
  try {
    const raw = await Faculty.findById(req.params.id).populate('userId', 'email').populate('subjectsTaught').lean();
    if (!raw) return res.status(404).json({ success: false, message: 'Faculty not found' });
    const labsTaught = await Lab.find({ facultyId: raw._id }).sort({ code: 1 }).lean();
    const faculty = { ...raw, email: raw.userId?.email, labsTaught };
    res.json({ success: true, data: { faculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTeachingAssignments = async (req, res) => {
  try {
    const assignments = await FacultyTeachingAssignment.find({ facultyId: req.params.id })
      .populate('subjectId', 'code name branch semester credits')
      .sort({ session: -1, semester: 1, section: 1 })
      .lean();
    res.json({ success: true, data: { assignments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.replaceTeachingAssignments = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });
    const items = Array.isArray(req.body.assignments) ? req.body.assignments : [];
    const normalized = [];
    for (const item of items) {
      const subject = await Subject.findById(item.subjectId).lean();
      if (!subject) return res.status(400).json({ success: false, message: 'Subject not found' });
      if (!subject.isCommon && String(subject.branch).toUpperCase() !== String(faculty.department).toUpperCase()) {
        return res.status(400).json({ success: false, message: 'Subject branch must match faculty department' });
      }
      const semester = Number(item.semester || subject.semester);
      const session = normalizeSessionValue(item.session);
      const term = item.term || (semester % 2 === 0 ? 'january-june' : 'july-december');
      if (!session || !['july-december', 'january-june'].includes(term)) {
        return res.status(400).json({ success: false, message: 'Valid session and term are required' });
      }
      normalized.push({
        facultyId: faculty._id,
        subjectId: subject._id,
        session,
        term,
        semester,
        branch: subject.branch,
        section: String(item.section || '').trim(),
      });
    }
    await FacultyTeachingAssignment.deleteMany({ facultyId: faculty._id });
    if (normalized.length) await FacultyTeachingAssignment.insertMany(normalized, { ordered: true });
    const assignments = await FacultyTeachingAssignment.find({ facultyId: faculty._id })
      .populate('subjectId', 'code name branch semester credits')
      .sort({ session: -1, semester: 1 })
      .lean();
    res.json({ success: true, data: { assignments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateFaculty = async (req, res) => {
  try {
    const allowed = ['firstName', 'lastName', 'personalEmail', 'phone', 'address', 'gender', 'department', 'designation', 'qualification', 'experience', 'joiningDate', 'profilePhotoUrl', 'signatureUrl'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    if (update.phone !== undefined && !isValidPhone(update.phone)) {
      return res.status(400).json({ success: false, message: PHONE_ERROR_MESSAGE });
    }

    // new: false → get the OLD doc so we can diff subjectsTaught
    const faculty = await Faculty.findByIdAndUpdate(req.params.id, update, { new: false, runValidators: true });
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });
    const effectiveDepartment = update.department || faculty.department;

    if (Array.isArray(req.body.subjectIds)) {
      const newIds = req.body.subjectIds.filter(Boolean).map(String);
      const oldIds = faculty.subjectsTaught.map(String);
      const validSubjects = await Subject.countDocuments({ _id: { $in: newIds }, branch: effectiveDepartment });
      if (validSubjects !== newIds.length) {
        return res.status(400).json({ success: false, message: 'All assigned subjects must belong to the faculty department' });
      }

      const toRemove = oldIds.filter(id => !newIds.includes(id));
      const toAdd = newIds.filter(id => !oldIds.includes(id));

      if (toRemove.length > 0) {
        await Subject.updateMany(
          { _id: { $in: toRemove }, facultyId: faculty._id },
          { $unset: { facultyId: 1 } }
        );
      }

      if (toAdd.length > 0) {
        const prevAssigned = await Subject.find({ _id: { $in: toAdd }, facultyId: { $exists: true, $ne: null } }).select('_id facultyId').lean();
        for (const s of prevAssigned) {
          if (String(s.facultyId) !== String(faculty._id)) {
            await Faculty.findByIdAndUpdate(s.facultyId, { $pull: { subjectsTaught: s._id } });
          }
        }
        await Subject.updateMany({ _id: { $in: toAdd } }, { facultyId: faculty._id });
      }

      await Faculty.findByIdAndUpdate(faculty._id, { subjectsTaught: newIds });
    }

    if (Array.isArray(req.body.labIds)) {
      const newLabIds = req.body.labIds.filter(Boolean).map(String);
      const validLabs = await Lab.countDocuments({ _id: { $in: newLabIds }, branch: effectiveDepartment });
      if (validLabs !== newLabIds.length) {
        return res.status(400).json({ success: false, message: 'All assigned labs must belong to the faculty department' });
      }

      await Lab.updateMany(
        { facultyId: faculty._id, _id: { $nin: newLabIds } },
        { $unset: { facultyId: 1 } }
      );
      if (newLabIds.length > 0) {
        await Lab.updateMany({ _id: { $in: newLabIds } }, { $set: { facultyId: faculty._id } });
      }
    }

    const updated = await Faculty.findById(faculty._id).populate('userId', 'email').populate('subjectsTaught', 'code name').lean();
    const labsTaught = await Lab.find({ facultyId: faculty._id }).sort({ code: 1 }).lean();
    res.json({ success: true, data: { faculty: { ...updated, email: updated.userId?.email, labsTaught } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteFaculty = async (req, res) => {
  try {
    const faculty = await Faculty.findByIdAndDelete(req.params.id);
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });
    await User.findByIdAndDelete(faculty.userId);
    res.json({ success: true, message: 'Faculty deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk upload students via Excel
exports.bulkUploadStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const file = req.file;
    const session = normalizeSessionValue(req.body.session);
    const year = String(req.body.year || '').trim();
    const branch = String(req.body.branch || '').trim().toUpperCase();
    const semester = String(req.body.semester || '').trim();
    const section = String(req.body.section || '').trim().toUpperCase();

    // Validate required parameters
    if (!session || !year || !branch || !semester || !section) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: session, year, branch, semester, section'
      });
    }

    const allowedBranches = ['CSE', 'IT', 'ECE', 'IP', 'BM', 'CIVIL', 'MC'];
    if (!allowedBranches.includes(branch)) {
      return res.status(400).json({ success: false, message: `Invalid branch ${branch}` });
    }

    // Validate semester based on year (Year to Semester mapping)
    const yearSemesterMap = {
      '1': [1, 2],    // 1st Year
      '2': [3, 4],    // 2nd Year
      '3': [5, 6],    // 3rd Year
      '4': [7, 8],    // 4th Year
    };

    const allowedSemesters = yearSemesterMap[String(year)];
    if (!allowedSemesters) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year value'
      });
    }

    const semesterNum = Number(semester);
    if (!allowedSemesters.includes(semesterNum)) {
      return res.status(400).json({
        success: false,
        message: `Invalid semester ${semesterNum} for year ${year}. Allowed semesters: ${allowedSemesters.join(', ')}`
      });
    }

    const workbook = xlsx.readFile(file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const results = { success: [], failed: [] };

    for (const [idx, row] of rows.entries()) {
      try {
        const rollNo = String(row.rollNo || row.RollNo || row.Roll || row.Roll_No || '').trim();
        const fullName = String(row.fullName || row.FullName || row.name || row.Name || '').trim();
        const email = String(row.email || row.Email || '').trim().toLowerCase();
        const phone = String(row.phone || row.Phone || row.phoneNumber || row.PhoneNumber || row.mobile || row.Mobile || '').trim();

        if (!rollNo || !fullName || !email) {
          results.failed.push({ row: idx + 2, reason: 'Missing required field(s): rollNo, fullName, or email', data: row });
          continue;
        }
        if (!isValidPhone(phone)) {
          results.failed.push({ row: idx + 2, reason: PHONE_ERROR_MESSAGE, data: { phone } });
          continue;
        }

        const rowBranch = String(row.branch || row.Branch || '').trim().toUpperCase();
        if (rowBranch && rowBranch !== branch) {
          results.failed.push({ row: idx + 2, reason: `Branch mismatch. Selected branch is ${branch}`, data: { branch: rowBranch } });
          continue;
        }

        // Email format validation - must be @college.edu domain
        const emailRegex = /^[^@]+@college\.edu$/i;
        if (!emailRegex.test(email)) {
          results.failed.push({ row: idx + 2, reason: 'Invalid email format. Use format like: student@college.edu', data: { email } });
          continue;
        }

        // duplicate checks
        const dupEmail = await User.findOne({ email });
        const dupRoll = await Student.findOne({ enrollmentNo: rollNo });
        if (dupEmail) {
          results.failed.push({ row: idx + 2, reason: 'Duplicate email', data: { email } });
          continue;
        }
        if (dupRoll) {
          results.failed.push({ row: idx + 2, reason: 'Duplicate rollNo', data: { rollNo } });
          continue;
        }

        // split full name
        const parts = fullName.split(/\s+/);
        const firstName = parts.shift();
        const lastName = parts.join(' ') || '';

        // generate username (ensure unique)
        const base = (email.split('@')[0] || `${firstName}.${lastName}`.replace(/\s+/g, '.')).toLowerCase().replace(/[^a-z0-9\.]/g, '');
        let username = base;
        let i = 0;
        while (await User.findOne({ username })) {
          i += 1;
          username = `${base}${i}`;
        }

        const defaultPassword = 'Welcome@123';
        const passwordHash = await bcrypt.hash(defaultPassword, 12);

        const user = await User.create({ email, passwordHash, role: 'student', username });

        const student = await Student.create({
          userId: user._id,
          enrollmentNo: rollNo,
          firstName,
          lastName,
          branch,
          currentSemester: semesterNum,
          section,
          year: Number(year),
          session,
          phone,
          phone,
        });
        await StudentAcademicHistory.create({
          studentId: student._id,
          session,
          semester: semesterNum,
          year: Number(year),
          branch,
          section,
          term: semesterNum % 2 === 0 ? 'january-june' : 'july-december',
        });

        results.success.push({ row: idx + 2, userId: user._id, studentId: student._id, email, rollNo });
      } catch (errRow) {
        results.failed.push({ row: idx + 2, reason: errRow.message || 'Failed to process row', data: row });
      }
    }

    // remove uploaded file
    try { fs.unlinkSync(file.path); } catch (e) { }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk upload faculty via Excel
exports.bulkUploadFaculty = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    const selectedDepartment = String(req.body.department || '').trim();

    const results = { success: [], failed: [] };

    if (!selectedDepartment) {
      return res.status(400).json({ success: false, message: 'Department is required' });
    }

    for (const [idx, row] of rows.entries()) {
      try {
        const employeeId = String(row.employeeId || row.EmployeeId || row.employee || '').trim();
        const fullName = String(row.fullName || row.FullName || row.name || row.Name || '').trim();
        const email = String(row.email || row.Email || '').trim().toLowerCase();
        const department = String(row.department || row.Department || selectedDepartment).trim();
        const designation = String(row.designation || row.Designation || '').trim();
        const phone = String(row.phone || row.Phone || row.phoneNumber || row.PhoneNumber || row.mobile || row.Mobile || '').trim();

        if (!employeeId || !fullName || !email || !designation) {
          results.failed.push({ row: idx + 2, reason: 'Missing required field(s)', data: row });
          continue;
        }
        if (!isValidPhone(phone)) {
          results.failed.push({ row: idx + 2, reason: PHONE_ERROR_MESSAGE, data: { phone } });
          continue;
        }

        if (department && department !== selectedDepartment) {
          results.failed.push({ row: idx + 2, reason: `Department mismatch. Selected department is ${selectedDepartment}`, data: { department } });
          continue;
        }

        // Email format validation - must be @college.edu domain
        const emailRegex = /^[^@]+@college\.edu$/i;
        if (!emailRegex.test(email)) {
          results.failed.push({ row: idx + 2, reason: 'Invalid email format. Use format like: faculty@college.edu', data: { email } });
          continue;
        }

        const dupEmail = await User.findOne({ email });
        const dupEmp = await Faculty.findOne({ employeeId });
        if (dupEmail) {
          results.failed.push({ row: idx + 2, reason: 'Duplicate email', data: { email } });
          continue;
        }
        if (dupEmp) {
          results.failed.push({ row: idx + 2, reason: 'Duplicate employeeId', data: { employeeId } });
          continue;
        }

        const parts = fullName.split(/\s+/);
        const firstName = parts.shift();
        const lastName = parts.join(' ') || '';

        const base = (email.split('@')[0] || `${firstName}.${lastName}`.replace(/\s+/g, '.')).toLowerCase().replace(/[^a-z0-9\.]/g, '');
        let username = base;
        let i = 0;
        while (await User.findOne({ username })) {
          i += 1;
          username = `${base}${i}`;
        }

        const defaultPassword = 'Welcome@123';
        const passwordHash = await bcrypt.hash(defaultPassword, 12);

        const user = await User.create({ email, passwordHash, role: 'faculty', username });

        const faculty = await Faculty.create({ userId: user._id, employeeId, firstName, lastName, department: selectedDepartment, designation, phone });

        results.success.push({ row: idx + 2, userId: user._id, facultyId: faculty._id, email, employeeId });
      } catch (errRow) {
        results.failed.push({ row: idx + 2, reason: errRow.message || 'Failed to process row', data: row });
      }
    }

    try { fs.unlinkSync(req.file.path); } catch (e) { }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Subjects
const normalizeAcademicCode = (value) => String(value || '').trim().toUpperCase();
const ACADEMIC_CODE_CONFLICT_MESSAGE = 'This code is already in use. Please enter a different code.';
const DEPARTMENT_CODES = (academicConfig.DEPARTMENTS || []).map((dept) => String(dept).toUpperCase());

const isValidSchemeBranch = (branch) => DEPARTMENT_CODES.includes(String(branch || '').trim().toUpperCase());

const validateAcademicFaculty = async (facultyId, branch) => {
  if (!facultyId) return null;
  const faculty = await Faculty.findById(facultyId).select('department').lean();
  if (!faculty) return 'Faculty not found';
  if (faculty.department && String(faculty.department).trim().toUpperCase() !== String(branch).trim().toUpperCase()) {
    return 'Assigned faculty must belong to the selected branch';
  }
  return null;
};

const validateFacultyIds = async (facultyIds, branch, { allowCrossDepartment = false } = {}) => {
  if (!facultyIds || facultyIds.length === 0) return null;
  const found = await Faculty.find({ _id: { $in: facultyIds } }).select('_id department').lean();
  if (found.length !== facultyIds.length) return 'One or more selected faculty were not found';
  // Year-1 common subjects are shared by all departments, so they may be taught
  // by faculty of the subject's own department (e.g. Maths, Physics, Civil).
  if (allowCrossDepartment) return null;
  const mismatch = found.find(
    (faculty) => faculty.department
      && String(faculty.department).trim().toUpperCase() !== String(branch).trim().toUpperCase(),
  );
  if (mismatch) return 'Assigned faculty must belong to the selected branch';
  return null;
};

const parseSchemeFields = (payload = {}) => {
  const fields = {};
  if (payload.session !== undefined) fields.session = normalizeSessionValue(payload.session) || undefined;
  if (payload.category !== undefined) fields.category = String(payload.category || '').trim().toUpperCase() || 'PCC';
  ['l', 't', 'p'].forEach((key) => {
    if (payload[key] !== undefined) fields[key] = Number(payload[key]) || 0;
  });
  if (payload.credits !== undefined) fields.credits = Number(payload.credits) || 0;
  // Marks structure fields (per scheme document)
  ['theoryEndMax', 'cwMax', 'practicalEndMax', 'swMax'].forEach((key) => {
    if (payload[key] !== undefined) fields[key] = Number(payload[key]) || 0;
  });
  if (payload.syllabusText !== undefined) fields.syllabusText = String(payload.syllabusText || '').trim();
  if (payload.syllabusFile !== undefined) fields.syllabusFile = String(payload.syllabusFile || '').trim();
  if (payload.electiveOptions !== undefined) fields.electiveOptions = normalizeElectiveOptions(payload.electiveOptions);
  return fields;
};

const resolveSyllabusFile = (req, fallback) => {
  if (req.file) return `/uploads/${req.file.filename}`;
  if (req.body && req.body.syllabusFile !== undefined) return String(req.body.syllabusFile || '').trim();
  return fallback;
};

const findAcademicCodeConflict = async (code, { subjectId, labId, session, branch, semester } = {}) => {
  const normalizedCode = normalizeAcademicCode(code);
  if (!normalizedCode) return null;

  const scope = {};
  if (session) scope.session = session;
  if (branch) scope.branch = String(branch).trim().toUpperCase();
  if (semester !== undefined && semester !== null && semester !== '') scope.semester = Number(semester);

  const [subject, lab] = await Promise.all([
    Subject.findOne({ code: normalizedCode, ...scope }).select('_id name').lean(),
    Lab.findOne({ code: normalizedCode, ...scope }).select('_id name').lean(),
  ]);

  if (subject && String(subject._id) !== String(subjectId || '')) {
    return ACADEMIC_CODE_CONFLICT_MESSAGE;
  }
  if (lab && String(lab._id) !== String(labId || '')) {
    return ACADEMIC_CODE_CONFLICT_MESSAGE;
  }
  return null;
};

const syncTeachingAssignments = async ({ facultyIds, session, semester, branch, note, itemType, subjectId, labId }) => {
  const term = termForSemester(semester);
  const desired = [...new Set((facultyIds || []).map(String).filter(Boolean))];
  const itemFilter = itemType === 'lab' ? { labId } : { subjectId };
  const existing = await FacultyTeachingAssignment.find({ ...itemFilter, itemType, session }).lean();
  const { toAdd, toRemove } = planAssignmentReconciliation(desired, existing);

  // Insert/replace first so a sync failure can never leave assignments deleted.
  if (toAdd.length) {
    const operations = toAdd.map((facultyId) => {
      const update = { $set: { semester, branch } };
      if (note !== undefined && note !== null && String(note).trim()) update.$set.note = String(note).trim();
      return {
        updateOne: {
          filter: { facultyId, itemType, ...itemFilter, session, term, section: '' },
          update,
          upsert: true,
        },
      };
    });
    await FacultyTeachingAssignment.bulkWrite(operations, { ordered: false });
  }

  if (toRemove.length) {
    await FacultyTeachingAssignment.deleteMany({ _id: { $in: toRemove } });
  }

  const removedFaculty = existing
    .filter((assignment) => toRemove.some((id) => String(id) === String(assignment._id)))
    .map((assignment) => String(assignment.facultyId && assignment.facultyId._id
      ? assignment.facultyId._id
      : assignment.facultyId))
    .filter(Boolean);

  return { added: toAdd, removed: removedFaculty };
};

const syncFacultySubjectsTaught = async (subjectId, addedFacultyIds, removedFacultyIds) => {
  if (addedFacultyIds.length) {
    await Faculty.updateMany({ _id: { $in: addedFacultyIds } }, { $addToSet: { subjectsTaught: subjectId } });
  }
  if (removedFacultyIds.length) {
    await Faculty.updateMany({ _id: { $in: removedFacultyIds } }, { $pull: { subjectsTaught: subjectId } });
  }
};

const attachFacultyLists = async (items, itemType) => {
  if (!items.length) return items;
  const ids = items.map((item) => item._id);
  const filter = itemType === 'lab'
    ? { itemType: 'lab', labId: { $in: ids } }
    : { itemType: 'class', subjectId: { $in: ids } };
  const assignments = await FacultyTeachingAssignment.find(filter)
    .populate('facultyId', 'firstName lastName department')
    .lean();

  const byItem = new Map();
  assignments.forEach((assignment) => {
    if (!assignment.facultyId) return;
    const key = String(itemType === 'lab' ? assignment.labId : assignment.subjectId);
    const list = byItem.get(key) || [];
    list.push({
      _id: assignment.facultyId._id,
      firstName: assignment.facultyId.firstName,
      lastName: assignment.facultyId.lastName,
      department: assignment.facultyId.department,
      note: assignment.note,
    });
    byItem.set(key, list);
  });

  return items.map((item) => {
    const list = byItem.get(String(item._id));
    if (list && list.length) return { ...item, facultyList: list };
    if (item.facultyId) {
      const primary = item.facultyId._id ? item.facultyId : { _id: item.facultyId };
      return {
        ...item,
        facultyList: [{
          _id: primary._id,
          firstName: primary.firstName,
          lastName: primary.lastName,
          department: primary.department,
        }],
      };
    }
    return { ...item, facultyList: [] };
  });
};

// Collapse per-department copies of Year-1 common items to one entry per code,
// preferring the canonical IT copy.
const dedupeCommonByCode = (items) => {
  const preferredBranch = 'IT';
  const seen = new Set();
  return [...items]
    .sort((a, b) => {
      const aPref = String(a.branch || '').toUpperCase() === preferredBranch ? 0 : 1;
      const bPref = String(b.branch || '').toUpperCase() === preferredBranch ? 0 : 1;
      return aPref - bPref;
    })
    .filter((item) => {
      const key = String(item.code || '').toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const pickSchemeFields = (item, isLab = false) => {
  const fields = {
    category: item.category,
    l: item.l,
    t: item.t,
    p: item.p,
    credits: item.credits,
    theoryEndMax: item.theoryEndMax,
    cwMax: item.cwMax,
    practicalEndMax: item.practicalEndMax,
    swMax: item.swMax,
    syllabusText: item.syllabusText,
    syllabusFile: item.syllabusFile,
  };
  if (!isLab) fields.electiveOptions = item.electiveOptions || [];
  return fields;
};

exports.createSubject = async (req, res) => {
  try {
    const code = normalizeAcademicCode(req.body.code);
    if (!code) return res.status(400).json({ success: false, message: 'Subject code is required' });
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Subject name is required' });
    const branch = String(req.body.branch || '').trim().toUpperCase();
    if (!isValidSchemeBranch(branch)) {
      return res.status(400).json({ success: false, message: 'Select a valid department' });
    }
    const semester = Number(req.body.semester);
    if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
      return res.status(400).json({ success: false, message: 'Select a valid semester (1-8)' });
    }
    const session = normalizeSessionValue(req.body.session) || normalizeSessionValue(req.academicSession);
    if (!session) {
      return res.status(400).json({ success: false, message: 'Academic session is required' });
    }

    const codeConflict = await findAcademicCodeConflict(code, { session, branch, semester });
    if (codeConflict) return res.status(400).json({ success: false, message: codeConflict });

    const isCommon = req.body.isCommon === true || req.body.isCommon === 'true';
    const facultyIds = normalizeFacultyIds(
      req.body.facultyIds !== undefined ? req.body.facultyIds : req.body.facultyId,
    );
    const facultyError = await validateFacultyIds(facultyIds, branch, { allowCrossDepartment: isCommon });
    if (facultyError) return res.status(400).json({ success: false, message: facultyError });

    const schemeFields = parseSchemeFields(req.body);
    const subject = await Subject.create({
      code,
      name,
      type: ['theory', 'lab'].includes(req.body.type) ? req.body.type : 'theory',
      branch,
      semester,
      session,
      isCommon,
      ...schemeFields,
      syllabusFile: resolveSyllabusFile(req, schemeFields.syllabusFile),
      facultyId: facultyIds[0],
    });

    if (facultyIds.length) {
      try {
        const result = await syncTeachingAssignments({
          facultyIds,
          session,
          semester,
          branch,
          note: req.body.note,
          itemType: 'class',
          subjectId: subject._id,
        });
        await syncFacultySubjectsTaught(subject._id, result.added, result.removed);
      } catch (syncErr) {
        // Subject is persisted; assignment reconciliation is idempotent and can be retried.
        console.error('Teaching assignment sync failed for subject', String(subject._id), syncErr.message);
      }
    }

    const created = await Subject.findById(subject._id)
      .populate('facultyId', 'firstName lastName department').lean();
    const [subjectWithFaculty] = await attachFacultyLists([created], 'class');
    res.status(201).json({ success: true, data: { subject: subjectWithFaculty } });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: ACADEMIC_CODE_CONFLICT_MESSAGE });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSubjects = async (req, res) => {
  try {
    const filter = {};
    const branchFilter = req.query.branch ? String(req.query.branch).trim().toUpperCase() : null;
    if (branchFilter) filter.branch = branchFilter;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const legacy = req.query.legacy === '1' || req.query.legacy === 'true';
    if (legacy) {
      filter.$or = [{ session: { $exists: false } }, { session: null }, { session: '' }];
    } else {
      const session = normalizeSessionValue(req.query.session) || normalizeSessionValue(req.academicSession);
      if (session) filter.session = session;
    }

    let subjects = await Subject.find(filter)
      .populate('facultyId', 'firstName lastName department')
      .sort({ code: 1 })
      .lean();

    // Also include Year-1 common subjects (isCommon=true, sem 1 or 2) when a branch filter is active
    // (they should show up in every branch's scheme view)
    if (branchFilter && !legacy) {
      const session = normalizeSessionValue(req.query.session) || normalizeSessionValue(req.academicSession);
      const commonFilter = {
        isCommon: true,
        semester: { $in: [1, 2] },
        ...(session ? { session } : {}),
      };
      const commonSubjects = await Subject.find(commonFilter)
        .populate('facultyId', 'firstName lastName department')
        .lean();
      subjects = [...subjects, ...commonSubjects];
    }

    // Year-1 common subjects are stored once per department. Collapse them to a
    // single row per subject/semester so the scheme view never shows repeats.
    if (!legacy) {
      const preferredBranch = String(branchFilter || 'IT').toUpperCase();
      const common = subjects
        .filter((s) => s.isCommon)
        .sort((a, b) => {
          const aPref = String(a.branch || '').toUpperCase() === preferredBranch ? 0 : 1;
          const bPref = String(b.branch || '').toUpperCase() === preferredBranch ? 0 : 1;
          return aPref - bPref;
        });
      // One row per subject code: a branch's own copy wins, which lets the same
      // subject be placed in Sem 1 for one department and Sem 2 for another.
      const seenCommon = new Set();
      const keptCommon = common.filter((s) => {
        const key = String(s.code || '').toUpperCase();
        if (seenCommon.has(key)) return false;
        seenCommon.add(key);
        return true;
      });
      subjects = [
        ...subjects.filter((s) => !s.isCommon),
        ...keptCommon,
      ].sort((a, b) => {
        if (a.semester !== b.semester) return a.semester - b.semester;
        return (a.code || '').localeCompare(b.code || '');
      });
    }

    const subjectsWithFaculty = await attachFacultyLists(subjects, 'class');
    res.json({ success: true, data: { subjects: subjectsWithFaculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /admin/subjects/common-year1?session=...
// Returns the canonical Year-1 common subjects and labs (one per code).
exports.getCommonYearOne = async (req, res) => {
  try {
    const session = normalizeSessionValue(req.query.session) || normalizeSessionValue(req.academicSession);
    if (!session) return res.status(400).json({ success: false, message: 'Academic session is required' });

    const [subjects, labs] = await Promise.all([
      Subject.find({ session, semester: { $in: [1, 2] }, isCommon: true })
        .populate('facultyId', 'firstName lastName department')
        .lean(),
      Lab.find({ session, semester: { $in: [1, 2] }, isCommon: true })
        .populate('facultyId', 'firstName lastName department')
        .lean(),
    ]);

    const sortBySemesterAndCode = (items) => [...items].sort(
      (a, b) => (a.semester - b.semester) || String(a.code).localeCompare(String(b.code)),
    );

    res.json({
      success: true,
      data: {
        subjects: sortBySemesterAndCode(dedupeCommonByCode(subjects)),
        labs: sortBySemesterAndCode(dedupeCommonByCode(labs)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /admin/subjects/import-common
// Body: { session, branch, items: [{ code, semester }] }
// Adds Year-1 common subjects/labs to a department, letting the admin choose
// whether each item sits in Semester A (1) or Semester B (2) for that branch.
exports.importCommonYearOne = async (req, res) => {
  try {
    const session = normalizeSessionValue(req.body.session) || normalizeSessionValue(req.academicSession);
    const branch = String(req.body.branch || '').trim().toUpperCase();
    if (!session) return res.status(400).json({ success: false, message: 'Academic session is required' });
    if (!isValidSchemeBranch(branch)) {
      return res.status(400).json({ success: false, message: 'Select a valid department' });
    }

    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ success: false, message: 'Select at least one subject or lab' });
    }

    const [existingSubjects, existingLabs, commonSubjects, commonLabs] = await Promise.all([
      Subject.find({ session, branch }).select('code').lean(),
      Lab.find({ session, branch }).select('code').lean(),
      Subject.find({ session, semester: { $in: [1, 2] }, isCommon: true }).lean(),
      Lab.find({ session, semester: { $in: [1, 2] }, isCommon: true }).lean(),
    ]);

    const takenCodes = new Set([
      ...existingSubjects.map((s) => String(s.code || '').toUpperCase()),
      ...existingLabs.map((l) => String(l.code || '').toUpperCase()),
    ]);
    const canonicalSubjects = dedupeCommonByCode(commonSubjects);
    const canonicalLabs = dedupeCommonByCode(commonLabs);

    const created = { subjects: 0, labs: 0, added: [], skipped: [] };
    for (const raw of items) {
      const code = String(raw.code || '').trim().toUpperCase();
      if (!code) continue;
      const targetSemester = Number(raw.semester);
      if (![1, 2].includes(targetSemester)) {
        created.skipped.push({ code, reason: 'Semester must be A (1) or B (2)' });
        continue;
      }
      if (takenCodes.has(code)) {
        created.skipped.push({ code, reason: 'Already exists in this department' });
        continue;
      }

      const sourceLab = canonicalLabs.find((l) => String(l.code).toUpperCase() === code);
      const sourceSubject = sourceLab
        ? null
        : canonicalSubjects.find((s) => String(s.code).toUpperCase() === code);
      const source = sourceLab || sourceSubject;
      if (!source) {
        created.skipped.push({ code, reason: 'Not a common Year-1 item' });
        continue;
      }

      const isLab = Boolean(sourceLab);
      const Model = isLab ? Lab : Subject;
      const doc = await Model.create({
        code,
        name: source.name,
        branch,
        semester: targetSemester,
        session,
        isCommon: true,
        facultyId: source.facultyId,
        ...pickSchemeFields(source, isLab),
        ...(isLab ? { year: Math.ceil(targetSemester / 2) } : {}),
      });

      takenCodes.add(code);

      if (source.facultyId) {
        try {
          await FacultyTeachingAssignment.create({
            facultyId: source.facultyId,
            itemType: isLab ? 'lab' : 'class',
            ...(isLab ? { labId: doc._id } : { subjectId: doc._id }),
            session,
            term: termForSemester(targetSemester),
            semester: targetSemester,
            branch,
            section: '',
          });
          await Faculty.updateOne({ _id: source.facultyId }, { $addToSet: { subjectsTaught: doc._id } });
        } catch (assignmentErr) {
          console.error('Common import assignment failed for', code, assignmentErr.message);
        }
      }

      if (isLab) created.labs += 1;
      else created.subjects += 1;
      created.added.push({ code, name: source.name, semester: targetSemester, kind: isLab ? 'lab' : 'subject' });
    }

    res.status(201).json({
      success: true,
      data: {
        ...created,
        message: `Added ${created.subjects} subject(s) and ${created.labs} lab(s) to ${branch}.`,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: ACADEMIC_CODE_CONFLICT_MESSAGE });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    if (req.body.code !== undefined) {
      const normalizedCode = normalizeAcademicCode(req.body.code);
      if (!normalizedCode) return res.status(400).json({ success: false, message: 'Subject code is required' });
      const codeConflict = await findAcademicCodeConflict(normalizedCode, {
        subjectId: subject._id,
        session: subject.session,
        branch: subject.branch,
        semester: subject.semester,
      });
      if (codeConflict) return res.status(400).json({ success: false, message: codeConflict });
      subject.code = normalizedCode;
    }
    if (req.body.name !== undefined) subject.name = String(req.body.name).trim();
    if (req.body.credits !== undefined) subject.credits = Number(req.body.credits) || 0;
    if (['theory', 'lab'].includes(req.body.type)) subject.type = req.body.type;
    if (req.body.isCommon !== undefined) subject.isCommon = req.body.isCommon === true || req.body.isCommon === 'true';

    const schemeFields = parseSchemeFields(req.body);
    // Session may only be set once (to migrate a legacy record); branch/semester are immutable.
    const settingLegacySession = !subject.session && schemeFields.session;
    delete schemeFields.session;
    Object.assign(subject, schemeFields);
    if (settingLegacySession) subject.session = normalizeSessionValue(req.body.session);
    subject.syllabusFile = resolveSyllabusFile(req, subject.syllabusFile);

    const hasFacultyUpdate = req.body.facultyIds !== undefined || req.body.facultyId !== undefined;
    let facultyIds = null;
    if (hasFacultyUpdate) {
      facultyIds = normalizeFacultyIds(
        req.body.facultyIds !== undefined ? req.body.facultyIds : req.body.facultyId,
      );
      const facultyError = await validateFacultyIds(facultyIds, subject.branch, { allowCrossDepartment: !!subject.isCommon });
      if (facultyError) return res.status(400).json({ success: false, message: facultyError });
      if (facultyIds.length && !subject.session) {
        return res.status(400).json({
          success: false,
          message: 'Set an academic session for this subject before assigning faculty',
        });
      }
      subject.facultyId = facultyIds[0];
    }

    await subject.save();

    if (facultyIds) {
      try {
        const result = await syncTeachingAssignments({
          facultyIds,
          session: subject.session,
          semester: subject.semester,
          branch: subject.branch,
          note: req.body.note,
          itemType: 'class',
          subjectId: subject._id,
        });
        await syncFacultySubjectsTaught(subject._id, result.added, result.removed);
      } catch (syncErr) {
        console.error('Teaching assignment sync failed on subject update', String(subject._id), syncErr.message);
      }
    }

    const updated = await Subject.findById(subject._id)
      .populate('facultyId', 'firstName lastName department').lean();
    const [subjectWithFaculty] = await attachFacultyLists([updated], 'class');
    res.json({ success: true, data: { subject: subjectWithFaculty } });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: ACADEMIC_CODE_CONFLICT_MESSAGE });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    const assignments = await FacultyTeachingAssignment.find({ itemType: 'class', subjectId: subject._id }).lean();
    await FacultyTeachingAssignment.deleteMany({ itemType: 'class', subjectId: subject._id });

    const facultyIds = [...new Set([
      ...assignments.map((assignment) => String(assignment.facultyId)),
      ...(subject.facultyId ? [String(subject.facultyId)] : []),
    ].filter(Boolean))];
    if (facultyIds.length) {
      await Faculty.updateMany({ _id: { $in: facultyIds } }, { $pull: { subjectsTaught: subject._id } });
    }

    res.json({ success: true, message: 'Subject deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.copyScheme = async (req, res) => {
  try {
    const fromSession = normalizeSessionValue(req.body.fromSession);
    const toSession = normalizeSessionValue(req.body.toSession);
    if (!fromSession || !toSession) {
      return res.status(400).json({ success: false, message: 'Source and target sessions are required' });
    }
    if (fromSession === toSession) {
      return res.status(400).json({ success: false, message: 'Source and target sessions must be different' });
    }
    const branch = req.body.branch ? String(req.body.branch).trim().toUpperCase() : null;
    const semester = req.body.semester ? Number(req.body.semester) : null;

    const sourceFilter = { session: fromSession };
    if (branch) sourceFilter.branch = branch;
    if (semester) sourceFilter.semester = semester;

    const targetScope = { session: toSession };
    if (branch) targetScope.branch = branch;
    if (semester) targetScope.semester = semester;

    const [sourceSubjects, sourceLabs, existingSubjects, existingLabs] = await Promise.all([
      Subject.find(sourceFilter).lean(),
      Lab.find(sourceFilter).lean(),
      Subject.find(targetScope).select('code').lean(),
      Lab.find(targetScope).select('code').lean(),
    ]);

    const takenCodes = new Set([
      ...existingSubjects.map((item) => item.code),
      ...existingLabs.map((item) => item.code),
    ]);

    const subjectDocs = [];
    let skippedSubjects = 0;
    for (const subject of sourceSubjects) {
      if (takenCodes.has(subject.code)) { skippedSubjects += 1; continue; }
      takenCodes.add(subject.code);
      subjectDocs.push({
        code: subject.code,
        name: subject.name,
        type: subject.type,
        branch: subject.branch,
        semester: subject.semester,
        session: toSession,
        isCommon: !!subject.isCommon,
        category: subject.category,
        l: subject.l,
        t: subject.t,
        p: subject.p,
        credits: subject.credits,
        theoryEndMax: subject.theoryEndMax,
        cwMax: subject.cwMax,
        practicalEndMax: subject.practicalEndMax,
        swMax: subject.swMax,
        syllabusText: subject.syllabusText,
        syllabusFile: subject.syllabusFile,
        electiveOptions: subject.electiveOptions || [],
      });
    }

    const labDocs = [];
    let skippedLabs = 0;
    for (const lab of sourceLabs) {
      if (takenCodes.has(lab.code)) { skippedLabs += 1; continue; }
      takenCodes.add(lab.code);
      labDocs.push({
        code: lab.code,
        name: lab.name,
        branch: lab.branch,
        semester: lab.semester,
        year: lab.year,
        session: toSession,
        category: lab.category,
        l: lab.l,
        t: lab.t,
        p: lab.p,
        credits: lab.credits,
        theoryEndMax: lab.theoryEndMax,
        cwMax: lab.cwMax,
        practicalEndMax: lab.practicalEndMax,
        swMax: lab.swMax,
        syllabusText: lab.syllabusText,
        syllabusFile: lab.syllabusFile,
      });
    }

    const insertSkippingDuplicates = async (Model, docs) => {
      if (!docs.length) return 0;
      try {
        const inserted = await Model.insertMany(docs, { ordered: false });
        return inserted.length;
      } catch (err) {
        const failed = err.writeErrors ? err.writeErrors.length : 0;
        if (!failed && err.code !== 11000) throw err;
        return Math.max(0, docs.length - failed);
      }
    };

    const createdSubjects = await insertSkippingDuplicates(Subject, subjectDocs);
    const createdLabs = await insertSkippingDuplicates(Lab, labDocs);

    const skipped = (subjectDocs.length - createdSubjects) + skippedSubjects
      + (labDocs.length - createdLabs) + skippedLabs;

    res.json({
      success: true,
      data: {
        fromSession,
        toSession,
        created: { subjects: createdSubjects, labs: createdLabs },
        skipped,
        message: `Copied ${createdSubjects} subject(s) and ${createdLabs} lab(s) into ${toSession}.`,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /admin/subjects/copy-year1-all-branches
 * Copies the common Year 1 (Sem 1 & 2) subjects and labs into every registered branch
 * for a given session. Only items with isCommon=true are duplicated.
 * Skips codes that already exist in the target branch+session.
 */
exports.copyYearOneToAllBranches = async (req, res) => {
  try {
    const session = normalizeSessionValue(req.body.session) || normalizeSessionValue(req.academicSession);
    if (!session) return res.status(400).json({ success: false, message: 'Session is required' });

    // Use the top-level academicConfig (required at line 30) — correct path, correct key
    const allBranches = (academicConfig.DEPARTMENTS || []).map(b => b.toUpperCase()).filter(Boolean);
    if (!allBranches.length) return res.status(400).json({ success: false, message: 'No departments configured in academicConfig.json' });

    // Fetch source: all common Year-1 subjects (sem 1 or 2, isCommon=true)
    const [commonSubjects, commonLabs] = await Promise.all([
      Subject.find({ session, semester: { $in: [1, 2] }, isCommon: true }).lean(),
      Lab.find({     session, semester: { $in: [1, 2] }, isCommon: true }).lean(),
    ]);

    let totalSubjects = 0;
    let totalLabs = 0;
    const results = [];

    for (const targetBranch of allBranches) {
      // Existing codes in this branch for Year 1
      const [existSub, existLab] = await Promise.all([
        Subject.find({ session, branch: targetBranch, semester: { $in: [1, 2] } }).select('code').lean(),
        Lab.find({     session, branch: targetBranch, semester: { $in: [1, 2] } }).select('code').lean(),
      ]);
      const takenCodes = new Set([...existSub.map(s => s.code), ...existLab.map(l => l.code)]);

      const subDocs = commonSubjects
        .filter(s => !takenCodes.has(s.code))
        .map(s => ({
          code: s.code, name: s.name, type: s.type, branch: targetBranch,
          semester: s.semester, session,
          isCommon: true,
          category: s.category, l: s.l, t: s.t, p: s.p, credits: s.credits,
          theoryEndMax: s.theoryEndMax, cwMax: s.cwMax,
          practicalEndMax: s.practicalEndMax, swMax: s.swMax,
          syllabusText: s.syllabusText, syllabusFile: s.syllabusFile,
          electiveOptions: s.electiveOptions || [],
        }));

      const labDocs = commonLabs
        .filter(l => !takenCodes.has(l.code))
        .map(l => ({
          code: l.code, name: l.name, branch: targetBranch,
          semester: l.semester, session,
          isCommon: true,
          category: l.category, l: l.l, t: l.t, p: l.p, credits: l.credits,
          theoryEndMax: l.theoryEndMax, cwMax: l.cwMax,
          practicalEndMax: l.practicalEndMax, swMax: l.swMax,
          syllabusText: l.syllabusText, syllabusFile: l.syllabusFile,
        }));

      const insertSkipping = async (Model, docs) => {
        if (!docs.length) return 0;
        try {
          const res = await Model.insertMany(docs, { ordered: false });
          return res.length;
        } catch (e) {
          return docs.length - (e.writeErrors ? e.writeErrors.length : 0);
        }
      };

      const [cs, cl] = await Promise.all([
        insertSkipping(Subject, subDocs),
        insertSkipping(Lab, labDocs),
      ]);
      totalSubjects += cs;
      totalLabs += cl;
      results.push({ branch: targetBranch, subjects: cs, labs: cl });
    }

    res.json({
      success: true,
      data: {
        session,
        totalSubjects,
        totalLabs,
        perBranch: results,
        message: `Copied ${totalSubjects} subject(s) and ${totalLabs} lab(s) across ${allBranches.length} departments.`,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const normalizeLabPayload = (payload) => {
  const semester = Number(payload.semester);
  const fields = {
    code: String(payload.code || '').trim().toUpperCase(),
    name: String(payload.name || '').trim(),
    branch: String(payload.branch || '').trim().toUpperCase(),
    semester,
    year: Math.ceil(semester / 2),
    credits: Number(payload.credits || 1),
    facultyId: payload.facultyId || undefined,
  };
  if (payload.session !== undefined) fields.session = normalizeSessionValue(payload.session) || undefined;
  if (payload.category !== undefined) fields.category = String(payload.category || '').trim().toUpperCase() || 'PCC';
  ['l', 't', 'p'].forEach((key) => {
    if (payload[key] !== undefined) fields[key] = Number(payload[key]) || 0;
  });
  ['theoryEndMax', 'cwMax', 'practicalEndMax', 'swMax'].forEach((key) => {
    if (payload[key] !== undefined) fields[key] = Number(payload[key]) || 0;
  });
  if (payload.syllabusText !== undefined) fields.syllabusText = String(payload.syllabusText || '').trim();
  if (payload.syllabusFile !== undefined) fields.syllabusFile = String(payload.syllabusFile || '').trim();
  if (payload.isCommon !== undefined) fields.isCommon = payload.isCommon === true || payload.isCommon === 'true';
  return fields;
};

exports.createLab = async (req, res) => {
  try {
    const payload = normalizeLabPayload(req.body);
    if (!payload.code || !payload.name || !payload.branch
      || !Number.isInteger(payload.semester) || payload.semester < 1 || payload.semester > 8) {
      return res.status(400).json({ success: false, message: 'Code, name, branch and a valid semester (1-8) are required' });
    }
    if (!isValidSchemeBranch(payload.branch)) {
      return res.status(400).json({ success: false, message: 'Select a valid department' });
    }
    const session = normalizeSessionValue(req.body.session) || normalizeSessionValue(req.academicSession);
    if (!session) return res.status(400).json({ success: false, message: 'Academic session is required' });
    payload.session = session;

    const codeConflict = await findAcademicCodeConflict(payload.code, {
      session, branch: payload.branch, semester: payload.semester,
    });
    if (codeConflict) return res.status(400).json({ success: false, message: codeConflict });

    const facultyIds = normalizeFacultyIds(
      req.body.facultyIds !== undefined ? req.body.facultyIds : req.body.facultyId,
    );
    const facultyError = await validateFacultyIds(facultyIds, payload.branch, { allowCrossDepartment: !!payload.isCommon });
    if (facultyError) return res.status(400).json({ success: false, message: facultyError });

    payload.facultyId = facultyIds[0];
    payload.syllabusFile = resolveSyllabusFile(req, payload.syllabusFile);
    const lab = await Lab.create(payload);

    if (facultyIds.length) {
      try {
        await syncTeachingAssignments({
          facultyIds,
          session,
          semester: lab.semester,
          branch: lab.branch,
          note: req.body.note,
          itemType: 'lab',
          labId: lab._id,
        });
      } catch (syncErr) {
        console.error('Teaching assignment sync failed for lab', String(lab._id), syncErr.message);
      }
    }

    const created = await Lab.findById(lab._id).populate('facultyId', 'firstName lastName department').lean();
    const [labWithFaculty] = await attachFacultyLists([created], 'lab');
    res.status(201).json({ success: true, data: { lab: labWithFaculty } });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: ACADEMIC_CODE_CONFLICT_MESSAGE });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLabs = async (req, res) => {
  try {
    const filter = {};
    const branchFilter = req.query.branch ? String(req.query.branch).trim().toUpperCase() : null;
    if (branchFilter) filter.branch = branchFilter;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const legacy = req.query.legacy === '1' || req.query.legacy === 'true';
    const session = normalizeSessionValue(req.query.session) || normalizeSessionValue(req.academicSession);
    if (legacy) {
      filter.$or = [{ session: { $exists: false } }, { session: null }, { session: '' }];
    } else if (session) {
      filter.session = session;
    }

    let labs = await Lab.find(filter)
      .populate('facultyId', 'firstName lastName department')
      .sort({ code: 1 })
      .lean();

    // Include Year-1 common labs (isCommon=true, sem 1 or 2) in every branch view.
    if (branchFilter && !legacy) {
      const commonLabs = await Lab.find({
        isCommon: true,
        semester: { $in: [1, 2] },
        ...(session ? { session } : {}),
      })
        .populate('facultyId', 'firstName lastName department')
        .lean();
      labs = [...labs, ...commonLabs];
    }

    // Collapse per-department copies of common labs to one row each.
    if (!legacy) {
      const preferredBranch = String(branchFilter || 'IT').toUpperCase();
      const common = labs
        .filter((l) => l.isCommon)
        .sort((a, b) => {
          const aPref = String(a.branch || '').toUpperCase() === preferredBranch ? 0 : 1;
          const bPref = String(b.branch || '').toUpperCase() === preferredBranch ? 0 : 1;
          return aPref - bPref;
        });
      const seenCommon = new Set();
      const keptCommon = common.filter((l) => {
        const key = String(l.code || '').toUpperCase();
        if (seenCommon.has(key)) return false;
        seenCommon.add(key);
        return true;
      });
      labs = [
        ...labs.filter((l) => !l.isCommon),
        ...keptCommon,
      ].sort((a, b) => {
        if (a.semester !== b.semester) return a.semester - b.semester;
        return (a.code || '').localeCompare(b.code || '');
      });
    }

    const labsWithFaculty = await attachFacultyLists(labs, 'lab');
    res.json({ success: true, data: { labs: labsWithFaculty } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLab = async (req, res) => {
  try {
    const lab = await Lab.findById(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found' });

    if (req.body.code !== undefined) {
      const normalizedCode = normalizeAcademicCode(req.body.code);
      if (!normalizedCode) return res.status(400).json({ success: false, message: 'Lab code is required' });
      const codeConflict = await findAcademicCodeConflict(normalizedCode, {
        labId: lab._id,
        session: lab.session,
        branch: lab.branch,
        semester: lab.semester,
      });
      if (codeConflict) return res.status(400).json({ success: false, message: codeConflict });
      lab.code = normalizedCode;
    }
    if (req.body.name !== undefined) lab.name = String(req.body.name).trim();
    if (req.body.credits !== undefined) lab.credits = Number(req.body.credits) || 0;
    if (req.body.isCommon !== undefined) lab.isCommon = req.body.isCommon === true || req.body.isCommon === 'true';
    if (req.body.semester !== undefined) {
      const semester = Number(req.body.semester);
      if (Number.isInteger(semester) && semester >= 1 && semester <= 8) {
        lab.semester = semester;
        lab.year = Math.ceil(semester / 2);
      }
    }

    const schemeFields = parseSchemeFields(req.body);
    const settingLegacySession = !lab.session && schemeFields.session;
    delete schemeFields.session;
    Object.assign(lab, schemeFields);
    if (settingLegacySession) lab.session = normalizeSessionValue(req.body.session);
    lab.syllabusFile = resolveSyllabusFile(req, lab.syllabusFile);

    const hasFacultyUpdate = req.body.facultyIds !== undefined || req.body.facultyId !== undefined;
    let facultyIds = null;
    if (hasFacultyUpdate) {
      facultyIds = normalizeFacultyIds(
        req.body.facultyIds !== undefined ? req.body.facultyIds : req.body.facultyId,
      );
      const facultyError = await validateFacultyIds(facultyIds, lab.branch, { allowCrossDepartment: !!lab.isCommon });
      if (facultyError) return res.status(400).json({ success: false, message: facultyError });
      if (facultyIds.length && !lab.session) {
        return res.status(400).json({
          success: false,
          message: 'Set an academic session for this lab before assigning faculty',
        });
      }
      lab.facultyId = facultyIds[0];
    }

    await lab.save();

    if (facultyIds) {
      try {
        await syncTeachingAssignments({
          facultyIds,
          session: lab.session,
          semester: lab.semester,
          branch: lab.branch,
          note: req.body.note,
          itemType: 'lab',
          labId: lab._id,
        });
      } catch (syncErr) {
        console.error('Teaching assignment sync failed on lab update', String(lab._id), syncErr.message);
      }
    }

    const updated = await Lab.findById(lab._id).populate('facultyId', 'firstName lastName department').lean();
    const [labWithFaculty] = await attachFacultyLists([updated], 'lab');
    res.json({ success: true, data: { lab: labWithFaculty } });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: ACADEMIC_CODE_CONFLICT_MESSAGE });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteLab = async (req, res) => {
  try {
    const lab = await Lab.findByIdAndDelete(req.params.id);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found' });
    await FacultyTeachingAssignment.deleteMany({ itemType: 'lab', labId: lab._id });
    res.json({ success: true, message: 'Lab deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLabStudents = async (req, res) => {
  try {
    const lab = await Lab.findById(req.params.id).lean();
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found' });
    const studentFilter = { branch: lab.branch, currentSemester: lab.semester };
    if (lab.session) {
      const year = String(lab.session).slice(0, 4);
      studentFilter.session = { $in: [lab.session, `${year}-${String(Number(year) + 1).slice(2)}`] };
    }
    const students = await Student.find(studentFilter)
      .sort({ enrollmentNo: 1 })
      .select('firstName lastName enrollmentNo branch currentSemester section session year')
      .lean();
    res.json({ success: true, data: { lab, students } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSubjectStudents = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    const studentFilter = { branch: subject.branch, currentSemester: subject.semester };
    if (subject.session) {
      const year = String(subject.session).slice(0, 4);
      studentFilter.session = { $in: [subject.session, `${year}-${String(Number(year) + 1).slice(2)}`] };
    }
    const students = await Student.find(studentFilter)
      .sort({ enrollmentNo: 1 })
      .select('firstName lastName enrollmentNo branch currentSemester section session year')
      .lean();
    res.json({ success: true, data: { subject, students } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Notices
exports.createNotice = async (req, res) => {
  try {
    const admin = await Admin.findOne({ userId: req.user._id });
    const notice = await Notice.create({
      ...req.body,
      session: normalizeSessionValue(req.body.session),
      term: req.body.term || undefined,
      postedBy: admin?._id,
    });
    res.status(201).json({ success: true, data: { notice } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ isPinned: -1, createdAt: -1 }).lean();
    res.json({ success: true, data: { notices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteNotice = async (req, res) => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Notice deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Exam Schedule
exports.createExamSchedule = async (req, res) => {
  try {
    const schedule = await ExamSchedule.create(req.body);
    res.status(201).json({ success: true, data: { schedule } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getExamSchedules = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const schedules = await ExamSchedule.find(filter).populate('entries.subjectId', 'code name').lean();
    res.json({ success: true, data: { schedules } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Class Schedule
exports.createClassSchedule = async (req, res) => {
  try {
    const schedule = await ClassSchedule.create(req.body);
    res.status(201).json({ success: true, data: { schedule } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getClassSchedules = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const schedules = await ClassSchedule.find(filter).populate('timetable.subjectId', 'code name').populate('timetable.facultyId', 'firstName lastName').lean();
    res.json({ success: true, data: { schedules } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFeedback = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) {
      const subjectsForDepartment = await Subject.find({ branch: req.query.department }).distinct('_id');
      filter.subjectId = { $in: subjectsForDepartment };
    }
    if (req.query.facultyId) filter.facultyId = req.query.facultyId;
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    if (req.query.session) filter.session = req.query.session;
    if (req.query.term) filter.term = req.query.term;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.year) {
      const year = Number(req.query.year);
      if (!req.query.semester && Number.isInteger(year) && year > 0) filter.semester = { $in: [year * 2 - 1, year * 2] };
    }
    if (req.query.status) filter.status = req.query.status;
    const feedback = await Feedback.find(filter)
      .populate('studentId', 'firstName lastName enrollmentNo branch section')
      .populate('subjectId', 'code name semester branch')
      .populate('facultyId', 'firstName lastName department')
      .sort({ submittedAt: -1 }).lean();
    const summary = feedback.reduce((result, item) => {
      const key = `${String(item.subjectId?._id || item.subjectId)}:${String(item.facultyId?._id || item.facultyId)}`;
      if (!result[key]) result[key] = { subject: item.subjectId, faculty: item.facultyId, count: 0, knowledge: 0, clarity: 0, punctuality: 0, interaction: 0, doubtSolving: 0, fairness: 0 };
      result[key].count += 1;
      ['knowledge', 'clarity', 'punctuality', 'interaction', 'doubtSolving', 'fairness'].forEach(metric => {
        result[key][metric] += item.ratings?.[metric] || 0;
      });
      return result;
    }, {});
    const criteria = ['knowledge', 'clarity', 'punctuality', 'interaction', 'doubtSolving', 'fairness'];
    const analytics = Object.values(summary).map(item => ({
      ...item,
      ...Object.fromEntries(criteria.map(metric => [metric, Number((item[metric] / item.count).toFixed(2))])),
      average: Number((criteria.reduce((sum, metric) => sum + (item[metric] / item.count), 0) / criteria.length).toFixed(2)),
    })).sort((a, b) => b.average - a.average);
    const criterionAverages = Object.fromEntries(criteria.map(metric => [
      metric,
      feedback.length
        ? Number((feedback.reduce((sum, item) => sum + (Number(item.ratings?.[metric]) || 0), 0) / feedback.length).toFixed(2))
        : 0,
    ]));
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedback.forEach(item => criteria.forEach(metric => {
      const rating = Number(item.ratings?.[metric]);
      if (rating >= 1 && rating <= 5) ratingDistribution[rating] += 1;
    }));
    const statusCounts = feedback.reduce((result, item) => {
      result[item.status || 'submitted'] = (result[item.status || 'submitted'] || 0) + 1;
      return result;
    }, {});
    const commentsCount = feedback.filter(item => String(item.comments || '').trim()).length;
    const overallAverage = feedback.length
      ? Number((Object.values(criterionAverages).reduce((sum, value) => sum + value, 0) / criteria.length).toFixed(2))
      : 0;
    let facultyFilter = { _id: { $in: [] } };
    if (req.query.subjectId) {
      const assignmentFilter = {
        subjectId: req.query.subjectId,
        ...(req.query.session ? { session: req.query.session } : {}),
        ...(req.query.term ? { term: req.query.term } : {}),
        ...(req.query.semester ? { semester: Number(req.query.semester) } : {}),
      };
      const assignedFacultyIds = await FacultyTeachingAssignment.distinct('facultyId', assignmentFilter);
      if (assignedFacultyIds.length) {
        facultyFilter = { _id: { $in: assignedFacultyIds } };
      } else {
        const subject = await Subject.findById(req.query.subjectId).select('facultyId').lean();
        if (subject?.facultyId) facultyFilter = { _id: subject.facultyId };
      }
    }
    const [sessions, studentSemesters, subjectSemesters, studentBranches, subjectBranches, facultyDepartments, subjects, faculties] = await Promise.all([
      Feedback.distinct('session'),
      Student.distinct('currentSemester'),
      Subject.distinct('semester'),
      Student.distinct('branch'),
      Subject.distinct('branch'),
      Faculty.distinct('department'),
      Subject.find({}).select('code name semester branch').sort({ code: 1 }).lean(),
      Faculty.find(facultyFilter).select('firstName lastName department').sort({ firstName: 1 }).lean(),
    ]);
    res.json({
      success: true,
      data: {
        feedback,
        analytics,
        overview: {
          totalResponses: feedback.length,
          overallAverage,
          commentsCount,
          commentRate: feedback.length ? Number(((commentsCount / feedback.length) * 100).toFixed(1)) : 0,
          criterionAverages,
          ratingDistribution,
          statusCounts,
          strongest: analytics.slice(0, 5),
          needsAttention: analytics.slice().sort((a, b) => a.average - b.average).slice(0, 5),
        },
        filterOptions: {
          sessions: sessions.filter(Boolean).sort(),
          terms: ['july-december', 'january-june'],
          departments: [...new Set([...studentBranches, ...subjectBranches, ...facultyDepartments].filter(Boolean))].sort(),
          semesters: [...new Set([...studentSemesters, ...subjectSemesters].filter(Boolean))].sort((a, b) => a - b),
          subjects,
          faculties,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateFeedbackStatus = async (req, res) => {
  try {
    if (!['submitted', 'under_review', 'action_taken', 'closed'].includes(req.body.status)) {
      return res.status(400).json({ success: false, message: 'Invalid feedback status' });
    }
    const feedback = await Feedback.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!feedback) return res.status(404).json({ success: false, message: 'Feedback not found' });
    res.json({ success: true, data: { feedback } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.seedFeedbackDemo = async (req, res) => {
  try {
    const session = String(req.body.session || '2026-2027').trim();
    const term = req.body.term || 'july-december';
    const [students, subjects, faculties, teachingAssignments] = await Promise.all([
      Student.find({}).select('_id').limit(12).lean(),
      Subject.find({}).select('_id facultyId code name semester').sort({ code: 1 }).lean(),
      Faculty.find({}).select('_id firstName lastName').sort({ firstName: 1 }).limit(50).lean(),
      FacultyTeachingAssignment.find({ session, term }).select('facultyId subjectId').lean(),
    ]);
    if (!students.length || !subjects.length || !faculties.length) {
      return res.status(400).json({ success: false, message: 'Create students, subjects and faculty before seeding feedback' });
    }
    const subjectById = new Map(subjects.map(subject => [String(subject._id), subject]));
    const facultyById = new Map(faculties.map(faculty => [String(faculty._id), faculty]));
    const assignedPairs = teachingAssignments.length
      ? teachingAssignments
        .map(item => ({ subject: subjectById.get(String(item.subjectId)), faculty: facultyById.get(String(item.facultyId)) }))
        .filter(item => item.subject && item.faculty)
      : subjects
        .filter(subject => subject.facultyId && facultyById.has(String(subject.facultyId)))
        .map(subject => ({ subject, faculty: facultyById.get(String(subject.facultyId)) }));
    const uniquePairs = [...new Map(assignedPairs.map(item => [`${item.subject._id}:${item.faculty._id}`, item])).values()];
    if (!uniquePairs.length) {
      return res.status(400).json({ success: false, message: `No subject-faculty assignments found for ${session} / ${term}` });
    }
    const operations = [];
    uniquePairs.forEach(({ subject, faculty }, pairIndex) => {
      for (let responseIndex = 0; responseIndex < Math.min(students.length, 8); responseIndex += 1) {
        const base = 3 + ((pairIndex + responseIndex) % 3);
        const ratings = {
          knowledge: Math.min(5, base),
          clarity: Math.min(5, base - (responseIndex % 2 === 0 ? 0 : 1)),
          punctuality: Math.min(5, base),
          interaction: Math.min(5, base + (pairIndex % 2)),
          doubtSolving: Math.min(5, base),
          fairness: Math.min(5, base),
        };
        operations.push({
          updateOne: {
            filter: { studentId: students[responseIndex]._id, subjectId: subject._id, facultyId: faculty._id, session, term },
            update: {
              $set: {
                semester: subject.semester,
                ratings,
                comments: responseIndex % 3 === 0 ? 'Clear explanations and helpful classroom interaction.' : '',
                status: responseIndex % 4 === 0 ? 'under_review' : 'submitted',
                submittedAt: new Date(Date.now() - ((pairIndex * 2) + responseIndex) * 86400000),
              },
            },
            upsert: true,
          },
        });
      }
    });
    const result = await Feedback.bulkWrite(operations);
    res.json({
      success: true,
      message: `Demo feedback ready for ${uniquePairs.length} assigned subject-faculty pair(s)`,
      data: { matched: result.matchedCount, created: result.upsertedCount, responses: operations.length, assignedPairs: uniquePairs.length, session, term },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const defaultFeedbackCriteria = [
  ['knowledge', 'Subject knowledge'],
  ['clarity', 'Clarity of explanation'],
  ['punctuality', 'Punctuality'],
  ['interaction', 'Class interaction'],
  ['doubtSolving', 'Doubt solving'],
  ['fairness', 'Fairness and respect'],
].map(([key, label]) => ({ key, label, enabled: true }));

exports.getFeedbackConfig = async (req, res) => {
  try {
    const config = await FeedbackConfig.findOneAndUpdate(
      { key: 'default' },
      { $setOnInsert: { key: 'default', criteria: defaultFeedbackCriteria } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ success: true, data: { config } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateFeedbackConfig = async (req, res) => {
  try {
    const { isOpen, startsAt, endsAt, requireCommentForLowRating, criteria } = req.body;
    if (startsAt && Number.isNaN(new Date(startsAt).getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid feedback start date' });
    }
    if (endsAt && Number.isNaN(new Date(endsAt).getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid feedback end date' });
    }
    if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
      return res.status(400).json({ success: false, message: 'Feedback start date must be before end date' });
    }
    const safeCriteria = Array.isArray(criteria) && criteria.length
      ? criteria.filter(item => item && String(item.key || '').trim() && String(item.label || '').trim()).map(item => ({
        key: String(item.key).trim(),
        label: String(item.label).trim(),
        enabled: item.enabled !== false,
      }))
      : defaultFeedbackCriteria;
    const config = await FeedbackConfig.findOneAndUpdate(
      { key: 'default' },
      {
        $set: {
          isOpen: isOpen !== false,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
          requireCommentForLowRating: requireCommentForLowRating !== false,
          criteria: safeCriteria,
        },
        $setOnInsert: { key: 'default' },
      },
      { new: true, upsert: true, runValidators: true },
    ).lean();
    res.json({ success: true, data: { config } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportFeedback = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) {
      const subjectsForDepartment = await Subject.find({ branch: req.query.department }).distinct('_id');
      filter.subjectId = { $in: subjectsForDepartment };
    }
    if (req.query.facultyId) filter.facultyId = req.query.facultyId;
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    if (req.query.session) filter.session = req.query.session;
    if (req.query.term) filter.term = req.query.term;
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.year) {
      const year = Number(req.query.year);
      if (!req.query.semester && Number.isInteger(year) && year > 0) filter.semester = { $in: [year * 2 - 1, year * 2] };
    }
    const feedback = await Feedback.find(filter)
      .populate('studentId', 'firstName lastName enrollmentNo branch section')
      .populate('subjectId', 'code name')
      .populate('facultyId', 'firstName lastName')
      .sort({ submittedAt: -1 }).lean();
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Feedback');
    sheet.columns = [
      { header: 'Subject', key: 'subject', width: 28 },
      { header: 'Faculty', key: 'faculty', width: 24 },
      { header: 'Student', key: 'student', width: 24 },
      { header: 'Enrollment No', key: 'enrollmentNo', width: 18 },
      { header: 'Session', key: 'session', width: 14 },
      { header: 'Term', key: 'term', width: 16 },
      { header: 'Knowledge', key: 'knowledge', width: 12 },
      { header: 'Clarity', key: 'clarity', width: 12 },
      { header: 'Punctuality', key: 'punctuality', width: 12 },
      { header: 'Interaction', key: 'interaction', width: 12 },
      { header: 'Doubt solving', key: 'doubtSolving', width: 14 },
      { header: 'Fairness', key: 'fairness', width: 12 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Comments', key: 'comments', width: 40 },
    ];
    feedback.forEach(item => sheet.addRow({
      subject: `${item.subjectId?.code || ''} — ${item.subjectId?.name || ''}`,
      faculty: `${item.facultyId?.firstName || ''} ${item.facultyId?.lastName || ''}`.trim(),
      student: `${item.studentId?.firstName || ''} ${item.studentId?.lastName || ''}`.trim(),
      enrollmentNo: item.studentId?.enrollmentNo || '',
      session: item.session || '',
      term: item.term || '',
      ...item.ratings,
      status: item.status,
      comments: item.comments || '',
    }));
    sheet.getRow(1).font = { bold: true };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="feedback-report.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Stats
exports.getStats = async (req, res) => {
  try {
    const [students, faculty, subjects, notices] = await Promise.all([
      Student.countDocuments(),
      Faculty.countDocuments(),
      Subject.countDocuments(),
      Notice.countDocuments(),
    ]);
    res.json({ success: true, data: { students, faculty, subjects, notices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Fee management (admin view)
exports.getFees = async (req, res) => {
  try {
    const fees = await Fee.find().populate('studentId', 'firstName lastName enrollmentNo').lean();
    res.json({ success: true, data: { fees } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Result Management

// Grade calculation helpers
const calcGrade = (totalMarks) => {
  if (totalMarks >= 80) return 'A';
  if (totalMarks >= 70) return 'B';
  if (totalMarks >= 60) return 'C';
  if (totalMarks >= 50) return 'D';
  if (totalMarks >= 40) return 'E';
  return 'F (FAIL)';
};

const calcGradePoints = (totalMarks) => {
  if (totalMarks >= 80) return 10;
  if (totalMarks >= 70) return 9;
  if (totalMarks >= 60) return 8;
  if (totalMarks >= 50) return 7;
  if (totalMarks >= 40) return 6;
  return 0;
};

exports.getResults = async (req, res) => {
  try {
    const filter = {};
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.session) filter.session = req.query.session;
    if (req.query.branch) filter.branch = req.query.branch;
    const results = await Result.find(filter)
      .populate('studentId', 'firstName lastName enrollmentNo branch')
      .populate('subjectMarks.subjectId', 'code name credits')
      .populate('subjectMarks.labId', 'code name credits')
      .sort({ rank: 1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Check which subjects have marks submitted for a semester/session
exports.getSubmissionStatus = async (req, res) => {
  try {
    const { semester, session, branch } = req.query;
    if (!semester || !session) return res.status(400).json({ success: false, message: 'semester and session required' });

    // Get all subjects for this semester/branch
    const subjectFilter = { semester: Number(semester) };
    if (branch) subjectFilter.branch = branch;
    const [subjects, labs] = await Promise.all([
      Subject.find(subjectFilter)
        .populate('facultyId', 'firstName lastName')
        .lean(),
      Lab.find(subjectFilter)
        .populate('facultyId', 'firstName lastName')
        .lean(),
    ]);
    const academicItems = [
      ...subjects.map(item => ({ ...item, itemType: 'class' })),
      ...labs.map(item => ({ ...item, itemType: 'lab' })),
    ];

    // Get all results for this semester/session
    const resultFilter = { semester: Number(semester), session };
    if (branch) resultFilter.branch = branch;
    const results = await Result.find(resultFilter).lean();

    // Count students who have marks for each subject
    const totalStudents = await Student.countDocuments({
      currentSemester: Number(semester),
      ...(branch ? { branch } : {}),
    });

    const subjectStatus = academicItems.map(sub => {
      let studentsWithMarks = 0;
      for (const r of results) {
        if (r.subjectMarks.some(sm => {
          const matchesItem = sub.itemType === 'lab'
            ? sm.labId?.toString() === sub._id.toString()
            : sm.subjectId?.toString() === sub._id.toString();
          return matchesItem && sm.totalMarks != null;
        })) {
          studentsWithMarks++;
        }
      }
      return {
        _id: sub._id,
        itemType: sub.itemType,
        code: sub.code,
        name: sub.name,
        credits: sub.credits,
        faculty: sub.facultyId ? `${sub.facultyId.firstName} ${sub.facultyId.lastName}` : 'Unassigned',
        studentsWithMarks,
        totalStudents,
        isComplete: studentsWithMarks >= totalStudents && totalStudents > 0,
      };
    });

    const completedCount = subjectStatus.filter(s => s.isComplete).length;

    res.json({
      success: true,
      data: {
        subjects: subjectStatus,
        totalSubjects: academicItems.length,
        completedSubjects: completedCount,
        totalStudents,
        allComplete: completedCount === academicItems.length && academicItems.length > 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Generate full gradesheet — calculate SGPA, CGPA, percentage, rank, etc.
exports.generateGradesheet = async (req, res) => {
  try {
    const { semester, session, branch } = req.body;
    if (!semester || !session) return res.status(400).json({ success: false, message: 'Semester and session required' });

    const filter = { semester: Number(semester), session };
    if (branch) filter.branch = branch;

    const results = await Result.find(filter)
      .populate('subjectMarks.subjectId', 'credits code name')
      .populate('subjectMarks.labId', 'credits code name')
      .lean();

    if (results.length === 0) return res.status(404).json({ success: false, message: 'No results found for this semester/session' });

    const updated = [];

    for (const result of results) {
      const subjectMarks = result.subjectMarks || [];

      if (subjectMarks.length === 0) continue;

      const updatedSubjectMarks = subjectMarks.map(sm => {
        const itemType = sm.itemType || (sm.labId ? 'lab' : 'class');
        const assessment = calculateAssessment({ itemType, ...sm });
        if (assessment.error) {
          throw new Error(`Invalid marks for ${sm.itemCode || sm.subjectId || sm.labId}: ${assessment.error}`);
        }
        const { totalMarks, cw = 0, sw = 0, theory = 0, practical = 0 } = assessment;
        const { grade, gradePoints } = calculateGrade(totalMarks);
        const credits = sm.credits || sm.subjectId?.credits || 3;
        return {
          ...sm,
          cw, sw, theory, practical, totalMarks, grade, gradePoints,
          internalMarks: itemType === 'lab' ? sw : cw,
          externalMarks: itemType === 'lab' ? practical : theory,
          credits,
          creditPoints: gradePoints * credits,
        };
      });
      const summary = calculateSemesterSummary(updatedSubjectMarks);
      const { totalCredits, earnedCredits, sgpa, percentage, status } = summary;
      const totalCreditPoints = updatedSubjectMarks.reduce(
        (sum, mark) => sum + Number(mark.creditPoints || 0),
        0
      );

      // Calculate CGPA — get all previous semester results for this student
      const allResults = await Result.find({
        studentId: result.studentId,
        semester: { $lte: Number(semester) },
        isGenerated: true,
      }).lean();

      // Include current semester calculation
      let cgpaTotalCP = totalCreditPoints;
      let cgpaTotalCredits = totalCredits;

      for (const prev of allResults) {
        if (prev.semester === Number(semester) && prev.session === session) continue; // skip current
        const prevCP = (prev.subjectMarks || []).reduce((sum, sm) => sum + (sm.creditPoints || 0), 0);
        const prevC = (prev.subjectMarks || []).reduce((sum, sm) => sum + (sm.credits || 0), 0);
        cgpaTotalCP += prevCP;
        cgpaTotalCredits += prevC;
      }

      const cgpa = cgpaTotalCredits > 0 ? Number((cgpaTotalCP / cgpaTotalCredits).toFixed(2)) : sgpa;
      const remarks = status === 'pass' ? 'Promoted' : 'Reappear';

      await Result.findByIdAndUpdate(result._id, {
        sgpa,
        cgpa,
        percentage,
        status,
        totalCredits,
        earnedCredits,
        remarks,
        isGenerated: true,
        subjectMarks: updatedSubjectMarks,
      });

      updated.push({
        studentId: result.studentId,
        sgpa,
        cgpa,
        percentage,
        status,
        totalCredits,
        earnedCredits,
        remarks,
      });
    }

    // Calculate ranks — sort by SGPA desc, assign rank
    const sortedByPerformance = [...updated].sort((a, b) => b.sgpa - a.sgpa);
    for (let i = 0; i < sortedByPerformance.length; i++) {
      const rank = i + 1;
      await Result.findOneAndUpdate(
        { studentId: sortedByPerformance[i].studentId, semester: Number(semester), session },
        { rank }
      );
      sortedByPerformance[i].rank = rank;
    }

    res.json({
      success: true,
      message: `Gradesheet generated for ${updated.length} students`,
      data: { updated: sortedByPerformance, totalProcessed: updated.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Publish/Unpublish results
exports.publishResults = async (req, res) => {
  try {
    const { semester, session, branch, publish } = req.body;
    if (!semester || !session) return res.status(400).json({ success: false, message: 'Semester and session required' });

    const filter = { semester: Number(semester), session };
    if (branch) filter.branch = branch;

    const updateData = { isPublished: !!publish };
    if (publish) updateData.publishedAt = new Date();

    const result = await Result.updateMany(filter, updateData);

    res.json({
      success: true,
      message: `${publish ? 'Published' : 'Unpublished'} ${result.modifiedCount} results`,
      data: { modifiedCount: result.modifiedCount, isPublished: !!publish },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Result Analytics
exports.getResultAnalytics = async (req, res) => {
  try {
    const { semester, session, branch } = req.query;
    if (!semester || !session) return res.status(400).json({ success: false, message: 'semester and session required' });

    const filter = { semester: Number(semester), session, isGenerated: true };
    if (branch) filter.branch = branch;

    const results = await Result.find(filter)
      .populate('studentId', 'firstName lastName enrollmentNo branch')
      .populate('subjectMarks.subjectId', 'code name')
      .populate('subjectMarks.labId', 'code name')
      .lean();

    if (results.length === 0) return res.json({ success: true, data: { analytics: null } });

    // Pass/Fail counts
    const passCount = results.filter(r => r.status === 'pass').length;
    const failCount = results.filter(r => r.status === 'fail').length;
    const passPercentage = ((passCount / results.length) * 100).toFixed(1);

    // Grade distribution
    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, E: 0, 'F (FAIL)': 0 };
    for (const r of results) {
      for (const sm of (r.subjectMarks || [])) {
        if (sm.grade && gradeDistribution[sm.grade] !== undefined) {
          gradeDistribution[sm.grade]++;
        }
      }
    }

    // Top 10 students
    const topStudents = [...results]
      .filter(r => r.sgpa)
      .sort((a, b) => b.sgpa - a.sgpa)
      .slice(0, 10)
      .map(r => ({
        name: `${r.studentId?.firstName} ${r.studentId?.lastName}`,
        enrollmentNo: r.studentId?.enrollmentNo,
        sgpa: r.sgpa,
        cgpa: r.cgpa,
        percentage: r.percentage,
        rank: r.rank,
      }));

    // Subject-wise average
    const subjectMap = {};
    for (const r of results) {
      for (const sm of (r.subjectMarks || [])) {
        const itemType = sm.itemType === 'lab' || sm.labId ? 'lab' : 'class';
        const item = itemType === 'lab' ? sm.labId : sm.subjectId;
        const code = sm.itemCode || item?.code || 'Unknown';
        const name = sm.itemName || item?.name || 'Unknown';
        if (!subjectMap[code]) subjectMap[code] = { code, name, marks: [], passCount: 0, failCount: 0 };
        subjectMap[code].marks.push(sm.totalMarks || 0);
        if ((sm.totalMarks || 0) >= 40) subjectMap[code].passCount++;
        else subjectMap[code].failCount++;
      }
    }
    const subjectWise = Object.values(subjectMap).map(s => ({
      ...s,
      average: (s.marks.reduce((a, b) => a + b, 0) / s.marks.length).toFixed(1),
      highest: Math.max(...s.marks),
      lowest: Math.min(...s.marks),
      passPercentage: ((s.passCount / s.marks.length) * 100).toFixed(1),
      totalStudents: s.marks.length,
      marks: undefined,
    }));

    // Average SGPA
    const avgSgpa = (results.reduce((sum, r) => sum + (r.sgpa || 0), 0) / results.length).toFixed(2);
    const avgPercentage = (results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length).toFixed(1);

    res.json({
      success: true,
      data: {
        analytics: {
          totalStudents: results.length,
          passCount,
          failCount,
          passPercentage,
          avgSgpa,
          avgPercentage,
          gradeDistribution,
          topStudents,
          subjectWise,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Export gradesheet as Excel
exports.exportGradesheet = async (req, res) => {
  try {
    const { semester, session, branch } = req.query;
    if (!semester || !session) return res.status(400).json({ success: false, message: 'semester and session required' });

    const filter = { semester: Number(semester), session, isGenerated: true };
    if (branch) filter.branch = branch;

    const results = await Result.find(filter)
      .populate('studentId', 'firstName lastName enrollmentNo branch')
      .populate('subjectMarks.subjectId', 'code name credits')
      .populate('subjectMarks.labId', 'code name credits')
      .sort({ rank: 1 })
      .lean();

    if (results.length === 0) return res.status(404).json({ success: false, message: 'No gradesheet data found' });

    // Collect all unique subjects
    const subjectSet = new Map();
    for (const r of results) {
      for (const sm of (r.subjectMarks || [])) {
        const itemType = sm.itemType === 'lab' || sm.labId ? 'lab' : 'class';
        const item = itemType === 'lab' ? sm.labId : sm.subjectId;
        if (item) {
          const itemKey = `${itemType}:${item._id.toString()}`;
          subjectSet.set(itemKey, { code: sm.itemCode || item.code, name: sm.itemName || item.name });
        }
      }
    }
    const allSubjects = Array.from(subjectSet.entries());

    // Build spreadsheet data
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Gradesheet');

    // Header row
    const headerRow = ['Rank', 'Enrollment No', 'Name', 'Branch'];
    for (const [, sub] of allSubjects) {
      headerRow.push(`${sub.code} (Marks)`, `${sub.code} (Grade)`, `${sub.code} (GP)`);
    }
    headerRow.push('Total Credits', 'Earned Credits', 'SGPA', 'CGPA', 'Percentage', 'Status', 'Remarks');

    ws.addRow(headerRow);

    // Style header
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Data rows
    for (const r of results) {
      const row = [
        r.rank || '',
        r.studentId?.enrollmentNo || '',
        `${r.studentId?.firstName || ''} ${r.studentId?.lastName || ''}`,
        r.studentId?.branch || r.branch || '',
      ];

      for (const [itemKey] of allSubjects) {
        const sm = (r.subjectMarks || []).find(s => {
          const itemType = s.itemType === 'lab' || s.labId ? 'lab' : 'class';
          const item = itemType === 'lab' ? s.labId : s.subjectId;
          return item && `${itemType}:${item._id.toString()}` === itemKey;
        });
        row.push(sm?.totalMarks ?? '', sm?.grade ?? '', sm?.gradePoints ?? '');
      }

      row.push(r.totalCredits || '', r.earnedCredits || '', r.sgpa || '', r.cgpa || '',
        r.percentage ? `${r.percentage}%` : '', (r.status || '').toUpperCase(), r.remarks || '');

      const dataRow = ws.addRow(row);

      // Color pass/fail
      if (r.status === 'fail') {
        dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4E4' } };
      }
    }

    // Auto-width columns
    ws.columns.forEach(col => {
      let maxLen = 10;
      col.eachCell(cell => {
        const len = String(cell.value || '').length;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 2, 30);
    });

    const filename = `Gradesheet_Sem${semester}_${session}${branch ? '_' + branch : ''}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Keep backward compatibility
exports.calculatePercentage = exports.generateGradesheet;

// Export Students to Excel
exports.exportStudents = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branch) filter.branch = req.query.branch;
    if (req.query.semesterSession && SEMESTER_SESSION_MAP[req.query.semesterSession]) {
      filter.currentSemester = { $in: SEMESTER_SESSION_MAP[req.query.semesterSession] };
    }
    if (req.query.semester) filter.currentSemester = Number(req.query.semester);
    const yearFilter = buildYearFilter(req.query.year ?? req.query.admissionYear);
    if (yearFilter) Object.assign(filter, yearFilter);
    if (req.query.session) filter.session = buildSessionRegex(req.query.session);
    if (req.query.gender) filter.gender = req.query.gender;
    if (req.query.search?.trim()) {
      const search = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchingUsers = await User.find(
        { email: new RegExp(search, 'i') },
        { _id: 1 }
      ).lean();
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { enrollmentNo: new RegExp(search, 'i') },
        { userId: { $in: matchingUsers.map(user => user._id) } },
      ];
    }

    const students = await Student.find(filter)
      .populate('userId', 'email')
      .sort({ enrollmentNo: 1 })
      .lean();

    const studentsWithEmail = students.map(s => ({ ...s, email: s.userId?.email }));

    const workbook = createStudentWorkbook(studentsWithEmail);

    // Generate filename with filters
    const filterStr = [];
    if (req.query.branch) filterStr.push(`Branch-${req.query.branch}`);
    if (req.query.semester) filterStr.push(`Sem-${req.query.semester}`);
    const exportYear = req.query.year ?? req.query.admissionYear;
    if (exportYear) filterStr.push(formatYearLabel(exportYear));
    const filename = filterStr.length > 0
      ? `Students_${filterStr.join('_')}_${Date.now()}.xlsx`
      : `Students_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Export Faculty to Excel
exports.exportFaculty = async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.designation) filter.designation = req.query.designation;
    if (req.query.search?.trim()) {
      const search = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchingUsers = await User.find(
        { email: new RegExp(search, 'i') },
        { _id: 1 }
      ).lean();
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { employeeId: new RegExp(search, 'i') },
        { department: new RegExp(search, 'i') },
        { designation: new RegExp(search, 'i') },
        { userId: { $in: matchingUsers.map(user => user._id) } },
      ];
    }

    const faculty = await Faculty.find(filter)
      .populate('userId', 'email')
      .sort({ employeeId: 1 })
      .lean();

    const facultyWithEmail = faculty.map(f => ({ ...f, email: f.userId?.email }));

    const workbook = createFacultyWorkbook(facultyWithEmail);

    // Generate filename with filters
    const filterStr = [];
    if (req.query.department) filterStr.push(`Dept-${req.query.department}`);
    if (req.query.designation) filterStr.push(`Desg-${req.query.designation}`);
    const filename = filterStr.length > 0
      ? `Faculty_${filterStr.join('_')}_${Date.now()}.xlsx`
      : `Faculty_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =============== TEMPORARY: Seed Test Data (For Development Only) ===============
// This endpoint generates 10 test students and 10 test faculty for quick testing
// REMOVE THIS IN PRODUCTION
exports.seedTestData = async (req, res) => {
  try {
    const { seedTestData, testStudentData, testFacultyData } = require('../utils/seedTestData');
    const results = await seedTestData();

    // Map generated data to credentials format
    const studentCredentials = results.studentsCreated > 0
      ? testStudentData.map((s, idx) => ({
        name: `${s.firstName} ${s.lastName}`,
        rollNo: `TS${String(idx + 1).padStart(4, '0')}`,
        email: s.email,
        username: `${s.firstName.toLowerCase()}.${s.lastName.toLowerCase()}`,
        password: 'Welcome@123',
      }))
      : [];

    const facultyCredentials = results.facultyCreated > 0
      ? testFacultyData.map((f, idx) => ({
        name: `${f.title ? f.title + ' ' : ''}${f.firstName} ${f.lastName}`,
        employeeId: `EMPL${String(idx + 1).padStart(5, '0')}`,
        email: f.email,
        username: `${f.firstName.toLowerCase()}.${f.lastName.toLowerCase()}`,
        password: 'Welcome@123',
      }))
      : [];

    res.status(201).json({
      success: true,
      message: 'Test data seeded successfully',
      data: {
        studentsCreated: results.studentsCreated,
        facultyCreated: results.facultyCreated,
        studentsSkipped: results.studentsSkipped,
        facultySkipped: results.facultySkipped,
        errors: results.errors,
        testAccounts: {
          students: studentCredentials,
          faculty: facultyCredentials,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRevaluationRequests = async (req, res) => {
  try {
    const requests = await RevaluationRequest.find()
      .populate('studentId', 'firstName lastName enrollmentNo branch')
      .populate('subjectId', 'code name')
      .sort({ requestedAt: -1 })
      .lean();
    res.json({ success: true, data: { requests } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateRevaluationRequest = async (req, res) => {
  try {
    const { status, internalMarks, externalMarks } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
    }
    const request = await RevaluationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    request.status = status;
    request.reviewedAt = new Date();
    if (internalMarks !== undefined && internalMarks !== '') request.internalMarks = Number(internalMarks);
    if (externalMarks !== undefined && externalMarks !== '') request.externalMarks = Number(externalMarks);
    if (request.internalMarks !== undefined || request.externalMarks !== undefined) {
      request.totalMarks = (request.internalMarks || 0) + (request.externalMarks || 0);
    }
    await request.save();

    // If approved and marks provided, update the actual result
    if (status === 'approved' && (internalMarks !== undefined || externalMarks !== undefined)) {
      const result = await Result.findOne({
        studentId: request.studentId,
        semester: request.semester,
        session: request.session
      });

      if (result) {
        const smIndex = result.subjectMarks.findIndex(s => s.subjectId.toString() === request.subjectId.toString());
        if (smIndex !== -1) {
          const sm = result.subjectMarks[smIndex];
          if (internalMarks !== undefined) sm.internalMarks = Number(internalMarks);
          if (externalMarks !== undefined) sm.externalMarks = Number(externalMarks);

          sm.totalMarks = (sm.internalMarks || 0) + (sm.externalMarks || 0);

          // Re-calculate grade and GP for this subject
          const calcGrade = (total) => {
            if (total >= 80) return 'A';
            if (total >= 70) return 'B';
            if (total >= 60) return 'C';
            if (total >= 50) return 'D';
            if (total >= 40) return 'E';
            return 'F (FAIL)';
          };
          const calcGP = (total) => {
            if (total >= 90) return 10;
            if (total >= 75) return 9;
            if (total >= 60) return 8;
            if (total >= 50) return 7;
            if (total >= 40) return 6;
            return 0;
          };

          sm.grade = calcGrade(sm.totalMarks);
          sm.gradePoints = calcGP(sm.totalMarks);
          sm.creditPoints = sm.gradePoints * (sm.credits || 3);

          result.markModified('subjectMarks');

          // Re-calculate SGPA for the whole result
          const totalCP = result.subjectMarks.reduce((sum, s) => sum + (s.creditPoints || 0), 0);
          const totalCredits = result.subjectMarks.reduce((sum, s) => sum + (s.credits || 0), 0);
          result.sgpa = totalCredits > 0 ? Number((totalCP / totalCredits).toFixed(2)) : 0;
          result.totalMarks = result.subjectMarks.reduce((sum, s) => sum + (s.totalMarks || 0), 0);
          result.percentage = Number(((result.totalMarks / (result.subjectMarks.length * 100)) * 100).toFixed(2));
          result.status = result.subjectMarks.every(s => (s.totalMarks || 0) >= 40) ? 'pass' : 'fail';

          await result.save();
        }
      }
    }

    res.json({ success: true, message: `Request ${status} successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
