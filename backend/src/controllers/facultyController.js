const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Notice = require('../models/Notice');
const Result = require('../models/Result');
const Student = require('../models/Student');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const xlsx = require('xlsx');
const {
  normalizeComponentMarks,
  validateComponentMarks,
  computeComponentTotal,
  calculateAssessment,
  calculateGrade,
} = require('../utils/resultManagement');
const { isValidPhone, PHONE_ERROR_MESSAGE } = require('../utils/phoneValidation');
const Feedback = require('../models/Feedback');
const StudentAcademicHistory = require('../models/StudentAcademicHistory');
const TimetableEntry = require('../models/TimetableEntry');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');
const LabBatch = require('../models/LabBatch');
const Section = require('../models/Section');
const FileAsset = require('../models/FileAsset');
const { termForSemester } = require('../utils/scheme');
const { saveUploadedFile } = require('../utils/fileAsset');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const numberFromRow = (row, names, fallback = 0) => {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return Number(row[name]);
  }
  return fallback;
};

const validateMarkRange = (value, min, max, label) => (
  Number.isFinite(value) && value >= min && value <= max
    ? null
    : `${label} must be between ${min} and ${max}`
);

const parseDateOnly = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isFutureDate = (date) => {
  if (!date) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return date > endOfToday;
};

const toLocalDateOnly = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const getMonthBounds = (monthValue) => {
  if (!monthValue || typeof monthValue !== 'string' || !/^\d{4}-\d{2}$/.test(monthValue)) {
    return null;
  }
  const [year, month] = monthValue.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end, daysInMonth: end.getDate(), year, month };
};

const formatDisplayDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const getMonthDateEntries = (monthBounds) => Array.from({ length: monthBounds.daysInMonth }, (_, index) => {
  const day = index + 1;
  const date = new Date(monthBounds.year, monthBounds.month - 1, day);
  return {
    day,
    date,
    label: formatDisplayDate(date),
  };
});

const calculateAttendancePercentage = (presentDays, markedDays) => {
  if (!markedDays) return 0;
  return Number(((presentDays / markedDays) * 100).toFixed(2));
};

const getAttendanceRowFill = (percentage) => {
  if (percentage < 60) return 'FFFDE8E8';
  if (percentage < 75) return 'FFFFF4CC';
  return null;
};

const normalizeAttendanceStatus = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['present', 'p', '1', 'yes', 'y', 'true'].includes(normalized)) return 'present';
  if (['absent', 'a', '0', 'no', 'n', 'false'].includes(normalized)) return 'absent';
  return null;
};

const getAttendanceUploadDir = () => path.join(__dirname, '../uploads/attendance-reports');

const ensureAttendanceUploadDir = async () => {
  const dir = getAttendanceUploadDir();
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
};

const facultyOwnsSubject = async (faculty, subjectId, subject, session, semester, section) => {
  if (!faculty || !subject) return false;
  const hasTeachingAssignments = await FacultyTeachingAssignment.exists({ facultyId: faculty._id, itemType: 'class' });
  if (hasTeachingAssignments) {
    if (!session) return false;
    return Boolean(await FacultyTeachingAssignment.exists({
      facultyId: faculty._id,
      itemType: 'class',
      subjectId,
      session,
      ...(semester ? { semester: Number(semester) } : {}),
      ...(section ? { section } : {}),
    }));
  }
  const subjectOwned = subject.facultyId && String(subject.facultyId) === String(faculty._id);
  const facultyAssigned = Array.isArray(faculty.subjectsTaught) && faculty.subjectsTaught.map(String).includes(String(subjectId));
  return Boolean(subjectOwned || facultyAssigned);
};

const facultyOwnsLab = async (faculty, labId, lab, session) => {
  if (!faculty || !lab) return false;
  const hasTeachingAssignments = await FacultyTeachingAssignment.exists({ facultyId: faculty._id, itemType: 'lab' });
  if (hasTeachingAssignments) {
    if (!session) return false;
    return Boolean(await FacultyTeachingAssignment.exists({
      facultyId: faculty._id,
      itemType: 'lab',
      labId,
      session,
    }));
  }
  return Boolean(lab.facultyId && String(lab.facultyId) === String(faculty._id));
};

const facultyTeachesItem = async (faculty, itemId, itemType, item, session) => {
  if (!faculty || !item) return false;
  if (itemType === 'lab') return facultyOwnsLab(faculty, itemId, item, session);
  return facultyOwnsSubject(faculty, itemId, item, session, item.semester);
};

const getAttendanceItem = async (faculty, itemId, itemType = 'class', session) => {
  const item = itemType === 'lab'
    ? await Lab.findById(itemId).lean()
    : await Subject.findById(itemId).lean();
  if (!item) return { item: null, message: itemType === 'lab' ? 'Lab not found' : 'Subject not found' };
  const owns = itemType === 'lab'
    ? await facultyOwnsLab(faculty, itemId, item, session)
    : await facultyOwnsSubject(faculty, itemId, item, session, item.semester);
  if (!owns) return { item: null, message: `Not authorized to mark attendance for this ${itemType}` };
  return { item };
};

const getClassRoster = async (subject, semester, section = '', session) => {
  const filter = { branch: subject.branch };
  if (session) {
    const historyStudents = await StudentAcademicHistory.find({
      session,
      semester: Number(semester),
      branch: subject.branch,
      ...(section ? { section } : {}),
    }).distinct('studentId');
    filter._id = historyStudents.length > 0
      ? { $in: historyStudents }
      : { $in: await Student.find({ session, branch: subject.branch }).distinct('_id') };
  } else {
    filter.currentSemester = Number(semester);
  }
  if (section) filter.section = section;
  return Student.find(filter)
    .sort({ enrollmentNo: 1 })
    .select('firstName lastName enrollmentNo branch currentSemester section session')
    .lean();
};

const isValidObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || ''));

/**
 * Resolve the lab + batch scope used by every lab attendance operation.
 *
 * The faculty-managed LabBatch collection is the single source of truth: the
 * batches saved from "My Subjects & Labs -> Batches" for (labId, session).
 * Returns either { lab, batchName, batchNames, studentIds } or
 * { status, message } describing why the request is invalid.
 */
const resolveLabBatchScope = async (labId, batchName, session) => {
  if (!isValidObjectId(labId)) {
    return { status: 400, message: 'Invalid lab id' };
  }

  const lab = await Lab.findById(labId).lean();
  if (!lab) return { status: 404, message: 'Lab not found' };

  const batchDoc = await LabBatch.findOne({ labId, session }).lean();
  const batches = batchDoc?.batches || [];
  const batchNames = batches.map((b) => b.batchName);

  const requested = String(batchName || '').trim();
  if (!requested) {
    return {
      status: 400,
      message: batchNames.length
        ? 'Select a batch for this lab'
        : 'No batches are configured for this lab. Configure them in My Subjects & Labs -> Batches.',
    };
  }

  const entry = batches.find((b) => String(b.batchName) === requested);
  if (!entry) {
    return {
      status: 400,
      message: `Batch "${requested}" is not configured for this lab in session ${session || 'current session'}`,
    };
  }

  return {
    lab,
    batchName: entry.batchName,
    batchNames,
    studentIds: (entry.studentIds || []).map((id) => String(id)),
  };
};

/**
 * Students of a single lab batch. Mirrors the roster filter used when the
 * batch was created, so only students of the lab's branch and semester are
 * ever returned.
 */
const getLabBatchStudents = async (lab, studentIds) => {
  const ids = (studentIds || []).filter(isValidObjectId);
  if (!ids.length) return [];
  return Student.find({
    _id: { $in: ids },
    branch: lab.branch,
    currentSemester: lab.semester,
  })
    .sort({ enrollmentNo: 1 })
    .select('firstName lastName enrollmentNo branch currentSemester section session')
    .lean();
};

const normalizeEnrollmentNo = (value) => String(value ?? '').trim();

const findUniqueStudentByEnrollmentNo = async (enrollmentNo) => {
  const normalizedEnrollmentNo = normalizeEnrollmentNo(enrollmentNo);
  if (!normalizedEnrollmentNo) return { student: null, reason: 'Missing enrollment number' };

  const students = await Student.find({ enrollmentNo: normalizedEnrollmentNo }).lean();
  if (students.length === 0) return { student: null, reason: 'Student not found in system' };
  if (students.length > 1) return { student: null, reason: `Duplicate enrollment number exists in system: ${normalizedEnrollmentNo}` };

  return { student: students[0], enrollmentNo: normalizedEnrollmentNo };
};

const findDuplicateEnrollmentsInRows = (rows) => {
  const counts = new Map();
  const duplicates = new Set();

  for (const row of rows) {
    const enrollmentNo = normalizeEnrollmentNo(row.enrollmentNo || row.EnrollmentNo || row.enrollment_no || row.rollNo || row.RollNo);
    if (!enrollmentNo) continue;

    const key = enrollmentNo.toLowerCase();
    const nextCount = (counts.get(key) || 0) + 1;
    counts.set(key, nextCount);
    if (nextCount > 1) duplicates.add(enrollmentNo);
  }

  return [...duplicates];
};

const getAttendanceRecordForDate = async (subjectId, date, session) => {
  const day = toLocalDateOnly(date);
  if (!day) return null;
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return Attendance.findOne({ subjectId, session, date: { $gte: start, $lte: end } }).lean();
};

// Lab attendance is stored per batch, so the lookup for an existing sheet must
// be scoped to the selected batch as well.
const getLabBatchAttendanceRecordForDate = async (labId, batchName, date, session) => {
  const day = toLocalDateOnly(date);
  if (!day) return null;
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return Attendance.findOne({
    labId,
    itemType: 'lab',
    batch: batchName,
    session,
    date: { $gte: start, $lte: end },
  }).lean();
};

const saveAttendanceWorkbook = async (workbook, filename) => {
  const dir = await ensureAttendanceUploadDir();
  const fullPath = path.join(dir, filename);
  const buffer = await workbook.xlsx.writeBuffer();
  await fs.promises.writeFile(fullPath, buffer);
  // Store a durable copy so the notice attachment survives Render redeploys.
  // Report names are reused each month, so replace any previous copy.
  await FileAsset.findOneAndUpdate(
    { key: `attendance-reports/${filename}` },
    {
      $set: {
        data: Buffer.from(buffer),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: filename,
        size: buffer.length,
      },
    },
    { upsert: true }
  ).catch((err) => console.error('Failed to store attendance report in MongoDB:', err.message));
  return { fullPath, publicPath: `/uploads/attendance-reports/${filename}` };
};

exports.getProfile = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id })
      .populate('userId', 'email')
      .populate('subjectsTaught', 'code name branch semester')
      .lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: { faculty: { ...faculty, officialEmail: faculty.userId?.email } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).populate('userId', 'email');
    if (!faculty) return res.status(404).json({ success: false, message: 'Profile not found' });

    const allowed = ['email', 'phone', 'address', 'gender', 'qualification', 'experience', 'joiningDate'];
    const update = {};

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });

    if (update.phone !== undefined && !isValidPhone(update.phone)) {
      return res.status(400).json({ success: false, message: PHONE_ERROR_MESSAGE });
    }

    const email = update.email?.trim().toLowerCase();
    if (email !== undefined) {
      if (!email || !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
      }
      const duplicate = await require('../models/User').findOne({ email, _id: { $ne: req.user._id } });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      update.email = email;
    }

    if (update.experience !== undefined) {
      const experience = Number(update.experience);
      if (!Number.isFinite(experience) || experience < 0) {
        return res.status(400).json({ success: false, message: 'Experience must be a valid non-negative number' });
      }
      update.experience = experience;
    }

    if (update.phone !== undefined && update.phone !== '') {
      const phone = String(update.phone).trim();
      if (!/^[0-9\s\-\+\(\)]+$/.test(phone) || phone.replace(/\D/g, '').length < 10) {
        return res.status(400).json({ success: false, message: 'Phone number must be valid (at least 10 digits)' });
      }
      update.phone = phone;
    }

    if (update.joiningDate !== undefined) {
      const joiningDate = parseDateOnly(update.joiningDate);
      if (!joiningDate) {
        return res.status(400).json({ success: false, message: 'Please select a valid joining date' });
      }
      if (isFutureDate(joiningDate)) {
        return res.status(400).json({ success: false, message: 'Joining date cannot be in the future' });
      }
      update.joiningDate = joiningDate;
    }

    if (req.files?.profilePhoto?.[0]) {
      update.profilePhotoUrl = await saveUploadedFile(req.files.profilePhoto[0]);
    }

    if (update.email) {
      await require('../models/User').findByIdAndUpdate(req.user._id, { email: update.email }, { runValidators: true });
    }

    delete update.email;

    await Faculty.findByIdAndUpdate(faculty._id, update, { runValidators: true });

    const updated = await Faculty.findOne({ userId: req.user._id })
      .populate('userId', 'email')
      .populate('subjectsTaught', 'code name branch semester')
      .lean();

    res.json({ success: true, data: { faculty: { ...updated, officialEmail: updated.userId?.email } } });
  } catch (err) {
    const message = err.name === 'ValidationError' ? Object.values(err.errors).map(e => e.message).join(', ') : err.message;
    const statusCode = err.name === 'ValidationError' ? 400 : 500;
    res.status(statusCode).json({ success: false, message });
  }
};

exports.getSubjects = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const selectFields = 'code name type branch semester session credits facultyId l t p theoryEndMax cwMax practicalEndMax swMax syllabusText syllabusFile';
    const assignmentFilter = { facultyId: faculty._id, session: req.academicSession };
    if (req.academicTerm) {
      assignmentFilter.$or = [{ term: req.academicTerm }, { term: { $exists: false } }, { term: null }];
    }
    const assignments = await FacultyTeachingAssignment.find(assignmentFilter)
      .populate('subjectId', selectFields)
      .populate('labId', selectFields)
      .lean();

    // Deduplicate: if a faculty has multiple teaching assignment rows for the same item
    // (e.g., different sections/notes), consolidate them to one entry per unique item._id
    const seenIds = new Set();
    const classAssignments = [];
    const labAssignments = [];

    assignments.forEach((item) => {
      const base = item.itemType === 'lab' ? item.labId : item.subjectId;
      if (!base) return;
      const key = String(base._id);
      if (seenIds.has(key)) return;   // skip duplicate rows for same subject/lab
      seenIds.add(key);
      const mapped = {
        ...base,
        teachingAssignmentId: item._id,
        session: item.session,
        term: item.term,
        section: item.section,
        note: item.note,
        itemType: item.itemType === 'lab' ? 'lab' : 'class',
      };
      if (item.itemType === 'lab') labAssignments.push(mapped);
      else classAssignments.push(mapped);
    });

    const hasSessionAssignments = req.academicSession
      ? await FacultyTeachingAssignment.exists({ facultyId: faculty._id, session: req.academicSession })
      : await FacultyTeachingAssignment.exists({ facultyId: faculty._id });

    let legacySubjects = [];
    let legacyLabs = [];
    if (!hasSessionAssignments) {
      const legacyFilter = { facultyId: faculty._id };
      if (req.academicSession) {
        legacyFilter.$or = [
          { session: req.academicSession },
          { session: { $exists: false } },
          { session: null },
        ];
      }
      if (req.academicTerm) {
        legacyFilter.semester = {
          $in: req.academicTerm === 'january-june' ? [2, 4, 6, 8] : [1, 3, 5, 7],
        };
      }
      [legacySubjects, legacyLabs] = await Promise.all([
        Subject.find(legacyFilter).lean(),
        Lab.find(legacyFilter).lean(),
      ]);
    }

    const allClasses = [
      ...classAssignments,
      ...legacySubjects.map((s) => ({
        ...s,
        itemType: 'class',
        term: s.semester ? termForSemester(s.semester) : req.academicTerm,
        section: '',
      })),
    ];
    const allLabs = [
      ...labAssignments,
      ...legacyLabs.map((l) => ({
        ...l,
        itemType: 'lab',
        term: l.semester ? termForSemester(l.semester) : req.academicTerm,
        section: '',
      })),
    ];

    // Backward-compatible flat list
    const subjects = [...allClasses, ...allLabs];

    res.json({
      success: true,
      data: {
        subjects,          // flat legacy list for old UI components
        classes: allClasses,
        labs: allLabs,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getClassStudents = async (req, res) => {
  try {
    const { subjectId, labId, semester, section, batch } = req.query;
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    // Lab attendance is rostered per batch: only students assigned to the
    // selected batch of that lab are returned.
    if (labId) {
      const scope = await resolveLabBatchScope(labId, batch, req.academicSession);
      if (scope.status) return res.status(scope.status).json({ success: false, message: scope.message });

      if (!await facultyOwnsLab(faculty, scope.lab._id, scope.lab, req.academicSession)) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this lab batch roster' });
      }

      const students = await getLabBatchStudents(scope.lab, scope.studentIds);

      return res.json({
        success: true,
        data: {
          students,
          count: students.length,
          itemType: 'lab',
          batch: scope.batchName,
          subject: {
            _id: scope.lab._id,
            code: scope.lab.code,
            name: scope.lab.name,
            branch: scope.lab.branch,
            semester: scope.lab.semester,
          },
        },
      });
    }

    if (!subjectId || !semester) {
      return res.status(400).json({ success: false, message: 'subjectId and semester are required' });
    }

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    if (!await facultyOwnsSubject(faculty, subjectId, subject, req.academicSession, semester, section)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this class roster' });
    }

    const students = await getClassRoster(subject, semester, section || '', req.academicSession);

    res.json({
      success: true,
      data: {
        students,
        count: students.length,
        subject: {
          _id: subject._id,
          code: subject.code,
          name: subject.name,
          branch: subject.branch,
          semester: subject.semester,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const { subjectId, labId, itemType = 'class', date, section, batch, records } = req.body;
    const itemId = itemType === 'lab' ? labId : subjectId;
    if (itemType === 'lab' && !isValidObjectId(labId)) {
      return res.status(400).json({ success: false, message: 'Invalid lab id' });
    }
    const { item, message } = await getAttendanceItem(faculty, itemId, itemType, req.academicSession);
    if (!item) return res.status(message.endsWith('not found') ? 404 : 403).json({ success: false, message });

    const attendanceDate = toLocalDateOnly(date);
    if (!attendanceDate) return res.status(400).json({ success: false, message: 'Please select a valid date' });
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No attendance records provided' });
    }

    let rosterIds;
    let batchName = '';
    if (itemType === 'lab') {
      const scope = await resolveLabBatchScope(labId, batch, req.academicSession);
      if (scope.status) return res.status(scope.status).json({ success: false, message: scope.message });
      batchName = scope.batchName;
      const labStudents = await getLabBatchStudents(scope.lab, scope.studentIds);
      rosterIds = new Set(labStudents.map((s) => String(s._id)));
    } else {
      const roster = await getClassRoster(item, item.semester, section || '', req.academicSession);
      rosterIds = new Set(roster.map((s) => String(s._id)));
    }

    const submitted = records.filter((r) => r && r.studentId);

    // A lab batch may only be marked with its own students.
    if (itemType === 'lab') {
      const outsiders = submitted.filter((r) => !rosterIds.has(String(r.studentId)));
      if (outsiders.length > 0) {
        return res.status(400).json({
          success: false,
          message: `${outsiders.length} student(s) are not assigned to batch "${batchName}" and cannot be marked`,
        });
      }
    }

    const cleanedRecords = submitted
      .filter((r) => rosterIds.has(String(r.studentId)))
      .map((r) => ({
        studentId: r.studentId,
        status: normalizeAttendanceStatus(r.status) || 'present',
      }));

    const attendanceFilter = {
      ...(itemType === 'lab' ? { labId: itemId } : { subjectId: itemId }),
      itemType,
      facultyId: faculty._id,
      session: req.academicSession,
      date: attendanceDate,
    };
    // Batches are stored as separate documents so saving one batch never
    // overwrites another batch for the same lab and date.
    if (itemType === 'lab') attendanceFilter.batch = batchName;

    const attendancePayload = {
      ...(itemType === 'lab' ? { labId: itemId } : { subjectId: itemId }),
      itemType,
      facultyId: faculty._id,
      date: attendanceDate,
      semester: item.semester,
      branch: item.branch,
      section: section || '',
      session: req.academicSession,
      records: cleanedRecords,
    };
    if (itemType === 'lab') attendancePayload.batch = batchName;

    const existing = await Attendance.findOne(attendanceFilter);
    const attendance = existing
      ? await Attendance.findByIdAndUpdate(existing._id, attendancePayload, { new: true, runValidators: true })
      : await Attendance.create(attendancePayload);

    res.status(existing ? 200 : 201).json({ success: true, data: { attendance } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const filter = { facultyId: faculty._id, session: req.academicSession };
    if (req.academicTerm) {
      filter.semester = {
        $in: req.academicTerm === 'january-june' ? [2, 4, 6, 8] : [1, 3, 5, 7],
      };
    }
    if (req.query.itemType === 'lab' && req.query.labId) {
      filter.labId = req.query.labId;
      const batch = String(req.query.batch || '').trim();
      if (batch) filter.batch = batch;
    } else if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    const records = await Attendance.find(filter)
      .populate('subjectId', 'code name')
      .populate('labId', 'code name')
      .sort({ date: -1 })
      .lean();
    res.json({ success: true, data: { records } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadAttendanceTemplate = async (req, res) => {
  try {
    const { subjectId, labId, itemType = 'class', batch, date } = req.query;
    const itemId = itemType === 'lab' ? labId : subjectId;
    if (!itemId || !date) {
      return res.status(400).json({ success: false, message: 'class or lab and date are required' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    let item;
    let students;
    let existingAttendance;
    let batchName = '';

    if (itemType === 'lab') {
      const scope = await resolveLabBatchScope(labId, batch, req.academicSession);
      if (scope.status) return res.status(scope.status).json({ success: false, message: scope.message });

      if (!await facultyOwnsLab(faculty, scope.lab._id, scope.lab, req.academicSession)) {
        return res.status(403).json({ success: false, message: 'Not authorized to download attendance template for this lab' });
      }

      item = scope.lab;
      batchName = scope.batchName;
      students = await getLabBatchStudents(scope.lab, scope.studentIds);
      existingAttendance = await getLabBatchAttendanceRecordForDate(labId, batchName, date, req.academicSession);
    } else {
      const subject = await Subject.findById(subjectId).lean();
      if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
      if (!await facultyOwnsSubject(faculty, subjectId, subject, req.academicSession, subject.semester)) {
        return res.status(403).json({ success: false, message: 'Not authorized to download attendance template for this subject' });
      }

      item = subject;
      students = await getClassRoster(subject, subject.semester, '', req.academicSession);
      existingAttendance = await getAttendanceRecordForDate(subjectId, date, req.academicSession);
    }

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: itemType === 'lab'
          ? `No students found for batch "${batchName}"`
          : 'No students found for this subject class',
      });
    }

    const attendanceDate = toLocalDateOnly(date);
    const dateLabel = attendanceDate ? formatDisplayDate(attendanceDate) : date;

    // Check if attendance record already exists for this date
    // Create a map of studentId to status from existing attendance record
    const statusMap = new Map();
    if (existingAttendance && existingAttendance.records && Array.isArray(existingAttendance.records)) {
      existingAttendance.records.forEach(record => {
        statusMap.set(String(record.studentId), record.status);
      });
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`${item.code}_${date}`);
    ws.columns = [
      { header: 'enrollmentNo', key: 'enrollmentNo', width: 18 },
      { header: 'studentName', key: 'studentName', width: 26 },
      { header: dateLabel, key: 'attendance', width: 14 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    students.forEach((student) => {
      // Use existing status if available, otherwise default to 'present'
      const status = statusMap.get(String(student._id)) || 'present';
      ws.addRow({
        enrollmentNo: student.enrollmentNo,
        studentName: `${student.firstName} ${student.lastName}`,
        attendance: status,
      });
    });

    const filename = itemType === 'lab'
      ? `AttendanceTemplate_${item.code}_${batchName}_${date}.xlsx`
      : `AttendanceTemplate_${item.code}_${date}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.bulkUploadAttendance = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { subjectId, labId, itemType = 'class', batch, date } = req.body;
    const itemId = itemType === 'lab' ? labId : subjectId;
    if (!itemId || !date) {
      return res.status(400).json({ success: false, message: 'class or lab and date are required' });
    }
    if (itemType === 'lab' && !isValidObjectId(labId)) {
      return res.status(400).json({ success: false, message: 'Invalid lab id' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const { item, message } = await getAttendanceItem(faculty, itemId, itemType, req.academicSession);
    if (!item) return res.status(message.endsWith('not found') ? 404 : 403).json({ success: false, message });

    const attendanceDate = toLocalDateOnly(date);
    if (!attendanceDate) return res.status(400).json({ success: false, message: 'Please select a valid date' });

    let students;
    let batchName = '';
    if (itemType === 'lab') {
      const scope = await resolveLabBatchScope(labId, batch, req.academicSession);
      if (scope.status) return res.status(scope.status).json({ success: false, message: scope.message });
      batchName = scope.batchName;
      students = await getLabBatchStudents(scope.lab, scope.studentIds);
    } else {
      students = await getClassRoster(item, item.semester, '', req.academicSession);
    }
    const rosterByRoll = new Map(students.map(student => [String(student.enrollmentNo).trim().toLowerCase(), student]));

    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const duplicateEnrollments = findDuplicateEnrollmentsInRows(rows);
    if (duplicateEnrollments.length > 0) {
      try { fs.unlinkSync(req.file.path); } catch (e) { }
      return res.status(400).json({
        success: false,
        message: `Duplicate enrollment number(s) found in upload file: ${duplicateEnrollments.join(', ')}`,
      });
    }

    const records = [];
    const results = { success: [], failed: [] };

    for (const [idx, row] of rows.entries()) {
      const enrollmentNo = normalizeEnrollmentNo(row.enrollmentNo || row.EnrollmentNo || row.enrollment_no || row.rollNo || row.RollNo);
      const statusRaw = row.status || row.Status || row.attendance || row.Attendance || '';
      if (!enrollmentNo) {
        results.failed.push({ row: idx + 2, reason: 'Missing enrollment number' });
        continue;
      }

      const student = rosterByRoll.get(enrollmentNo.toLowerCase());
      if (!student) {
        results.failed.push({ row: idx + 2, enrollmentNo, reason: 'Student not found in this class' });
        continue;
      }

      const status = normalizeAttendanceStatus(statusRaw) || 'present';
      records.push({ studentId: student._id, status });
      results.success.push({ row: idx + 2, enrollmentNo, status });
    }

    if (records.length === 0) {
      try { fs.unlinkSync(req.file.path); } catch (e) { }
      return res.status(400).json({ success: false, message: 'No valid attendance rows found' });
    }

    const existing = await Attendance.findOne({
      ...(itemType === 'lab' ? { labId: itemId } : { subjectId: itemId }),
      facultyId: faculty._id,
      session: req.academicSession,
      date: attendanceDate,
      ...(itemType === 'lab' ? { batch: batchName } : {}),
    });
    const attendancePayload = {
      ...(itemType === 'lab' ? { labId: itemId } : { subjectId: itemId }),
      itemType,
      facultyId: faculty._id,
      date: attendanceDate,
      semester: item.semester,
      branch: item.branch,
      section: '',
      session: req.academicSession,
      records,
      ...(itemType === 'lab' ? { batch: batchName } : {}),
    };

    const attendance = existing
      ? await Attendance.findByIdAndUpdate(existing._id, attendancePayload, { new: true, runValidators: true })
      : await Attendance.create(attendancePayload);

    try { fs.unlinkSync(req.file.path); } catch (e) { }
    res.json({ success: true, data: { attendance, results } });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch (e) { }
    res.status(500).json({ success: false, message: err.message });
  }
};

const buildError = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const buildMonthlyAttendanceSummary = async ({ faculty, subjectId, labId, itemType = 'class', batch, month, session }) => {
  const itemId = itemType === 'lab' ? labId : subjectId;
  const { item, message } = await getAttendanceItem(faculty, itemId, itemType, session);
  if (!item) throw buildError(message, message.endsWith('not found') ? 404 : 403);

  const monthBounds = getMonthBounds(month);
  if (!monthBounds) throw buildError('month is required in YYYY-MM format');

  let students;
  let batchName = '';
  if (itemType === 'lab') {
    const scope = await resolveLabBatchScope(labId, batch, session);
    if (scope.status) throw buildError(scope.message, scope.status);
    batchName = scope.batchName;
    students = await getLabBatchStudents(scope.lab, scope.studentIds);
  } else {
    students = await getClassRoster(item, item.semester, '', session);
  }

  const attendanceFilter = {
    ...(itemType === 'lab' ? { labId: itemId } : { subjectId: itemId }),
    facultyId: faculty._id,
    session,
    date: { $gte: monthBounds.start, $lte: monthBounds.end },
  };
  if (itemType === 'lab') attendanceFilter.batch = batchName;

  const attendanceDocs = await Attendance.find(attendanceFilter)
    .sort({ date: 1 })
    .lean();

  const monthDates = getMonthDateEntries(monthBounds);
  const rows = students.map((student) => ({
    studentId: student._id,
    enrollmentNo: student.enrollmentNo,
    studentName: `${student.firstName} ${student.lastName}`,
    statuses: Array(monthBounds.daysInMonth).fill(''),
    presentDays: 0,
    absentDays: 0,
    markedDays: 0,
    attendancePercentage: 0,
  }));
  const rowMap = new Map(rows.map(row => [String(row.studentId), row]));

  attendanceDocs.forEach((attendance) => {
    const dayIndex = new Date(attendance.date).getDate() - 1;
    (attendance.records || []).forEach((record) => {
      const row = rowMap.get(String(record.studentId));
      if (!row || dayIndex < 0 || dayIndex >= monthBounds.daysInMonth) return;
      const status = normalizeAttendanceStatus(record.status) || 'present';
      row.statuses[dayIndex] = status === 'present' ? 'P' : 'A';
      row.markedDays += 1;
      if (status === 'present') row.presentDays += 1;
      else row.absentDays += 1;
    });
  });

  rows.forEach((row) => {
    row.attendancePercentage = calculateAttendancePercentage(row.presentDays, row.markedDays);
  });

  return { subject: item, itemType, batchName, monthBounds, monthDates, rows, attendanceDocs };
};

const createMonthlyAttendanceWorkbook = async (summary) => {
  const { subject, batchName, monthBounds, monthDates, rows } = summary;
  const workbook = new ExcelJS.Workbook();
  const sheetSuffix = batchName ? `${batchName}_` : '';
  const ws = workbook.addWorksheet(`${subject.code}_${sheetSuffix}${monthBounds.year}_${String(monthBounds.month).padStart(2, '0')}`);

  const totalColumns = 2 + monthDates.length + 4;

  ws.columns = [
    { header: 'enrollmentNo', key: 'enrollmentNo', width: 18 },
    { header: 'studentName', key: 'studentName', width: 26 },
    ...monthDates.map(({ label }, index) => ({ header: label, key: `d${index + 1}`, width: 12 })),
    { header: 'presentDays', key: 'presentDays', width: 14 },
    { header: 'absentDays', key: 'absentDays', width: 14 },
    { header: 'markedDays', key: 'markedDays', width: 14 },
    { header: 'attendancePercentage', key: 'attendancePercentage', width: 18 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  rows.forEach((row) => {
    const values = {
      enrollmentNo: row.enrollmentNo,
      studentName: row.studentName,
      presentDays: row.presentDays,
      absentDays: row.absentDays,
      markedDays: row.markedDays,
      attendancePercentage: `${row.attendancePercentage.toFixed(2)}%`,
    };
    monthDates.forEach(({ day }, idx) => {
      values[`d${day}`] = row.statuses[idx] || '';
    });
    const excelRow = ws.addRow(values);
    const rowFill = getAttendanceRowFill(row.attendancePercentage);
    if (rowFill) {
      excelRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
      });
    }
    excelRow.getCell(totalColumns).font = {
      bold: true,
      color: row.attendancePercentage < 60 ? { argb: 'FF9C0006' } : row.attendancePercentage < 75 ? { argb: 'FF9C6500' } : { argb: 'FF006100' },
    };
  });

  return workbook;
};

const createDetainedAttendanceWorkbook = async (summary) => {
  const { subject, batchName, monthBounds, monthDates, rows } = summary;
  const workbook = new ExcelJS.Workbook();
  const sheetSuffix = batchName ? `${batchName}_` : '';
  const ws = workbook.addWorksheet(`Detention_${subject.code}_${sheetSuffix}${monthBounds.year}`);

  const totalColumns = 2 + monthDates.length + 4;

  ws.columns = [
    { header: 'enrollmentNo', key: 'enrollmentNo', width: 18 },
    { header: 'studentName', key: 'studentName', width: 26 },
    ...monthDates.map(({ label }, index) => ({ header: label, key: `d${index + 1}`, width: 12 })),
    { header: 'presentDays', key: 'presentDays', width: 14 },
    { header: 'absentDays', key: 'absentDays', width: 14 },
    { header: 'markedDays', key: 'markedDays', width: 14 },
    { header: 'attendancePercentage', key: 'attendancePercentage', width: 18 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }; // Soft red header for detention
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const detainedRows = rows.filter(row => row.attendancePercentage < 75);

  detainedRows.forEach((row) => {
    const values = {
      enrollmentNo: row.enrollmentNo,
      studentName: row.studentName,
      presentDays: row.presentDays,
      absentDays: row.absentDays,
      markedDays: row.markedDays,
      attendancePercentage: `${row.attendancePercentage.toFixed(2)}%`,
    };
    monthDates.forEach(({ day }, idx) => {
      values[`d${day}`] = row.statuses[idx] || '';
    });
    const excelRow = ws.addRow(values);
    excelRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } }; // Light red highlight
    });
    excelRow.getCell(totalColumns).font = {
      bold: true,
      color: { argb: 'FF9C0006' },
    };
  });

  return workbook;
};

exports.getMonthlyAttendanceSummary = async (req, res) => {
  try {
    const { subjectId, labId, itemType = 'class', batch, month } = req.query;
    if (!(itemType === 'lab' ? labId : subjectId) || !month) {
      return res.status(400).json({ success: false, message: 'class or lab and month are required' });
    }
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const summary = await buildMonthlyAttendanceSummary({
      faculty, subjectId, labId, itemType, batch, month, session: req.academicSession,
    });
    res.json({
      success: true,
      data: {
        subject: summary.subject,
        itemType: summary.itemType,
        batch: summary.batchName,
        month: month,
        days: summary.monthDates.map(entry => entry.day),
        dayLabels: summary.monthDates.map(entry => entry.label),
        students: summary.rows,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.downloadMonthlyAttendanceReport = async (req, res) => {
  try {
    const { subjectId, labId, itemType = 'class', batch, month } = req.query;
    if (!(itemType === 'lab' ? labId : subjectId) || !month) {
      return res.status(400).json({ success: false, message: 'class or lab and month are required' });
    }
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const summary = await buildMonthlyAttendanceSummary({
      faculty, subjectId, labId, itemType, batch, month, session: req.academicSession,
    });
    const workbook = await createMonthlyAttendanceWorkbook(summary);
    const filename = `Attendance_${summary.subject.code}${summary.batchName ? `_${summary.batchName}` : ''}_${month}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.downloadDetentionAttendanceReport = async (req, res) => {
  try {
    const { subjectId, labId, itemType = 'class', batch, month } = req.query;
    if (!(itemType === 'lab' ? labId : subjectId) || !month) {
      return res.status(400).json({ success: false, message: 'class or lab and month are required' });
    }
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const summary = await buildMonthlyAttendanceSummary({
      faculty, subjectId, labId, itemType, batch, month, session: req.academicSession,
    });
    const workbook = await createDetainedAttendanceWorkbook(summary);
    const filename = `DetentionList_${summary.subject.code}${summary.batchName ? `_${summary.batchName}` : ''}_${month}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.publishMonthlyAttendanceNotice = async (req, res) => {
  try {
    const { subjectId, labId, itemType = 'class', batch, month, type } = req.body;
    if (!(itemType === 'lab' ? labId : subjectId) || !month) {
      return res.status(400).json({ success: false, message: 'class or lab and month are required' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const summary = await buildMonthlyAttendanceSummary({
      faculty, subjectId, labId, itemType, batch, month, session: req.academicSession,
    });

    const batchLabel = summary.batchName ? ` — Batch ${summary.batchName}` : '';
    let noticeTitle = '';
    let noticeBody = '';
    let attachments = [];

    if (type === 'detention') {
      const detainedStudents = summary.rows.filter(row => row.attendancePercentage < 75);
      if (detainedStudents.length === 0) {
        return res.status(400).json({ success: false, message: 'No students have attendance below 75% for this month. No detention notice required.' });
      }

      // Generate the detention-only sheet (contains only detained students)
      const detentionWorkbook = await createDetainedAttendanceWorkbook(summary);
      const detentionFilename = `DetentionList_${summary.subject.code}${summary.batchName ? `_${summary.batchName}` : ''}_${month}.xlsx`;
      const savedDetentionSheet = await saveAttendanceWorkbook(detentionWorkbook, detentionFilename);
      attachments = [savedDetentionSheet.publicPath];

      noticeTitle = `⚠️ Detention List: ${summary.subject.code}${batchLabel} — ${month}`;
      noticeBody = [
        `📋 DETENTION NOTICE — ${summary.subject.code} (${summary.subject.name})${batchLabel}`,
        `Month: ${month}`,
        '------------------------------------------------------------------',
        'The detention list of students whose overall attendance has fallen below the required 75% threshold has been published.',
        '',
        'Please refer to the attached Excel sheet to view the list of detained students and their detailed day-wise attendance log.',
        '',
        'Note: Detained students are NOT eligible to appear in the end-semester examinations for this subject.',
      ].join('\n');
    } else {
      // type === 'attendance'
      const overallWorkbook = await createMonthlyAttendanceWorkbook(summary);
      const overallFilename = `Attendance_${summary.subject.code}${summary.batchName ? `_${summary.batchName}` : ''}_${month}.xlsx`;
      const savedOverallSheet = await saveAttendanceWorkbook(overallWorkbook, overallFilename);
      attachments = [savedOverallSheet.publicPath];

      noticeTitle = `📢 Monthly Attendance Record: ${summary.subject.code}${batchLabel} — ${month}`;
      noticeBody = [
        `📋 ATTENDANCE STATUS — ${summary.subject.code} (${summary.subject.name})${batchLabel}`,
        `Month: ${month}`,
        '------------------------------------------------------------------',
        'The overall monthly attendance record has been published.',
        '',
        'Please refer to the attached Excel sheet to view the complete monthly attendance report of all students in the class.',
      ].join('\n');
    }

    // Lab batch notices are only for the students of that batch; class notices
    // stay public to all students.
    const targetStudentIds = summary.itemType === 'lab'
      ? summary.rows.map((row) => row.studentId)
      : [];

    const notice = await Notice.create({
      title: noticeTitle,
      body: noticeBody,
      audience: 'students',
      session: req.academicSession || undefined,
      term: req.academicTerm || undefined,
      targetStudentIds, // Empty array = public to all students
      attachments,
      isPinned: type === 'detention', // Pin detention notices
    });

    res.status(201).json({ success: true, data: { notice, fileUrl: attachments[0] } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }

    const { subjectId, labId, itemType = 'class', dueDate: dueDateRaw, title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    const itemId = itemType === 'lab' ? labId : subjectId;
    if (!itemId) {
      return res.status(400).json({ success: false, message: 'Class or lab is required' });
    }
    if (!dueDateRaw) {
      return res.status(400).json({ success: false, message: 'Due date is required' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid class or lab ID' });
    }

    const item = itemType === 'lab'
      ? await Lab.findById(itemId).lean()
      : await Subject.findById(itemId).lean();
    if (!item) {
      return res.status(404).json({ success: false, message: itemType === 'lab' ? 'Lab not found' : 'Subject not found' });
    }

    if (!await facultyOwnsSubject(faculty, itemId, item, req.academicSession, item.semester)) {
      return res.status(403).json({ success: false, message: 'Not authorized to create assignments for this class or lab' });
    }

    const dueDate = new Date(dueDateRaw);
    if (Number.isNaN(dueDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid due date' });
    }

    // Compare with current date (ignoring hours/minutes to allow setting today as due date)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDate < today) {
      return res.status(400).json({ success: false, message: 'Due date cannot be in the past' });
    }

    const fileUrl = req.file ? `/uploads/${req.file.filename}` : req.body.fileUrl;
    const assignment = await Assignment.create({
      ...req.body,
      itemType,
      subjectId: itemType === 'class' ? itemId : undefined,
      labId: itemType === 'lab' ? itemId : undefined,
      facultyId: faculty._id,
      session: req.academicSession,
      fileUrl,
    });
    res.status(201).json({ success: true, data: { assignment } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAssignments = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const query = { facultyId: faculty._id, session: req.academicSession };
    if (req.academicTerm) {
      const termFilter = { facultyId: faculty._id, session: req.academicSession };
      termFilter.$or = [{ term: req.academicTerm }, { term: { $exists: false } }, { term: null }];
      const teaching = await FacultyTeachingAssignment.find(termFilter).select('itemType subjectId labId').lean();
      const subjectIds = teaching.filter(t => t.itemType !== 'lab').map(t => t.subjectId).filter(Boolean);
      const labIds = teaching.filter(t => t.itemType === 'lab').map(t => t.labId).filter(Boolean);
      query.$or = [{ subjectId: { $in: subjectIds } }, { labId: { $in: labIds } }];
    }
    const assignments = await Assignment.find(query)
      .populate('subjectId', 'code name')
      .populate('labId', 'code name branch semester')
      .lean();
    res.json({ success: true, data: { assignments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSubmissions = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).select('_id').lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const assignment = await Assignment.findById(req.params.id)
      .populate('subjectId')
      .populate('labId')
      .populate('submissions.studentId', 'firstName lastName enrollmentNo')
      .lean();
    if (!assignment) return res.status(404).json({ success: false, message: 'Not found' });
    if (assignment.facultyId.toString() !== faculty._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view these submissions' });
    }

    const subject = assignment.itemType === 'lab' ? assignment.labId : assignment.subjectId;
    if (!subject) {
      return res.status(400).json({ success: false, message: 'Class or lab associated with assignment not found' });
    }

    // Find all students enrolled in the subject's branch and semester
    const enrolledStudents = await getClassRoster(subject, subject.semester, '', assignment.session);

    const submittedStudentIds = new Set(
      assignment.submissions
        .map(s => s.studentId?._id ? s.studentId._id.toString() : (s.studentId ? s.studentId.toString() : null))
        .filter(Boolean)
    );

    const submitted = assignment.submissions.map(s => ({
      ...s,
      isLate: !!(s.submittedAt && assignment.dueDate && new Date(s.submittedAt) > new Date(assignment.dueDate)),
    }));

    const unsubmitted = enrolledStudents
      .filter(student => !submittedStudentIds.has(student._id.toString()))
      .map(student => ({
        studentId: {
          _id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          enrollmentNo: student.enrollmentNo,
        },
        fileUrl: null,
        submittedAt: null,
      }));

    res.json({
      success: true,
      data: {
        submissions: {
          submitted,
          unsubmitted,
          stats: {
            totalStudents: enrolledStudents.length,
            submittedCount: submitted.length,
            unsubmittedCount: unsubmitted.length,
          },
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    if (String(assignment.facultyId) !== String(faculty._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this assignment' });
    }

    const { title, description, dueDate: dueDateRaw, maxMarks, isClosed, deleteAttachment } = req.body;

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ success: false, message: 'Title cannot be empty' });
      }
      assignment.title = title;
    }

    if (description !== undefined) assignment.description = description;
    if (maxMarks !== undefined) assignment.maxMarks = Number(maxMarks);
    if (isClosed !== undefined) assignment.isClosed = Boolean(isClosed);

    if (dueDateRaw !== undefined) {
      const dueDate = new Date(dueDateRaw);
      if (Number.isNaN(dueDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid due date' });
      }
      assignment.dueDate = dueDate;
    }

    // Handle file changes (upload new, delete existing)
    if (req.file || deleteAttachment === 'true' || deleteAttachment === true) {
      if (assignment.fileUrl) {
        const oldPath = path.join(__dirname, '..', assignment.fileUrl);
        try {
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        } catch (err) {
          console.error('Failed to delete old file:', err);
        }
      }

      if (req.file) {
        assignment.fileUrl = `/uploads/${req.file.filename}`;
      } else {
        assignment.fileUrl = undefined;
      }
    }

    await assignment.save();
    res.json({ success: true, message: 'Assignment updated successfully', data: { assignment } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    if (String(assignment.facultyId) !== String(faculty._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this assignment' });
    }

    // Also delete assignment file from disk if it exists
    if (assignment.fileUrl) {
      const filePath = path.join(__dirname, '..', assignment.fileUrl);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error('Failed to delete assignment file:', err);
      }
    }

    // Delete student submissions files from disk too
    for (const sub of assignment.submissions) {
      if (sub.fileUrl) {
        const subPath = path.join(__dirname, '..', sub.fileUrl);
        try {
          if (fs.existsSync(subPath)) {
            fs.unlinkSync(subPath);
          }
        } catch (err) {
          console.error('Failed to delete student submission file:', err);
        }
      }
    }

    await Assignment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.gradeSubmission = async (req, res) => {
  try {
    const { marks, feedback } = req.body;
    const faculty = await Faculty.findOne({ userId: req.user._id }).select('_id').lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const assignment = await Assignment.findOne({
      facultyId: faculty._id,
      'submissions._id': req.params.id,
    });
    if (!assignment) return res.status(404).json({ success: false, message: 'Submission not found' });
    const sub = assignment.submissions.id(req.params.id);

    if (marks !== undefined && marks !== null && marks !== '') {
      const numMarks = Number(marks);
      if (Number.isNaN(numMarks)) {
        return res.status(400).json({ success: false, message: 'Marks must be a valid number' });
      }
      if (numMarks < 0) {
        return res.status(400).json({ success: false, message: 'Marks cannot be negative' });
      }
      if (numMarks > assignment.maxMarks) {
        return res.status(400).json({ success: false, message: `Marks cannot exceed maximum marks (${assignment.maxMarks})` });
      }
      sub.marks = numMarks;
    } else {
      sub.marks = undefined; // marks are optional, so allow clearing them
    }

    sub.feedback = feedback || '';
    await assignment.save();
    res.json({ success: true, message: 'Graded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSubmission = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }

    const assignment = await Assignment.findOne({ 'submissions._id': req.params.id });
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    if (String(assignment.facultyId) !== String(faculty._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage submissions for this assignment' });
    }

    const { feedback } = req.body;
    const sub = assignment.submissions.id(req.params.id);
    sub.resubmissionRequested = true;
    sub.marks = undefined; // clear score
    if (feedback !== undefined) {
      sub.feedback = feedback;
    }

    await assignment.save();

    res.json({ success: true, message: 'Resubmission requested successfully. Student has been notified.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

exports.updateMarks = async (req, res) => {
  try {
    const { semester, session, entries } = req.body;
    if (!Number.isInteger(Number(semester)) || !session || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: 'semester, session and entries are required' });
    }
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    for (const entry of entries) {
      const { studentId, subjectId, labId, itemType = 'class' } = entry;
      const itemId = itemType === 'lab' ? labId : subjectId;
      const item = itemType === 'lab'
        ? await Lab.findById(itemId).lean()
        : await Subject.findById(itemId).lean();
      if (!item) return res.status(404).json({ success: false, message: `${itemType} not found` });
      const assessment = calculateAssessment({ itemType, ...entry });
      if (assessment.error) return res.status(400).json({ success: false, message: assessment.error });
      const { cw = 0, sw = 0, theory = 0, practical = 0, totalMarks } = assessment;
      const { grade, gradePoints } = calculateGrade(totalMarks);

      // Get subject credits
      const credits = item.credits || 3;
      const creditPoints = gradePoints * credits;

      // Get student for branch info
      const student = await Student.findById(studentId).lean();

      // Enrollment check
      if (student && item && !item.isCommon && student.branch && item.branch && student.branch !== item.branch) {
        throw new Error(`Enrollment Mismatch: Student ${student.enrollmentNo} is from ${student.branch}, cannot assign marks for ${item.branch} item`);
      }
      if (student && item && student.currentSemester && item.semester && student.currentSemester < item.semester) {
        const inHistory = await StudentAcademicHistory.exists({ studentId, semester: item.semester });
        if (!inHistory && student.currentSemester < item.semester) {
          console.warn(`Semester Notice: Student ${student.enrollmentNo} currentSemester (${student.currentSemester}) < item.semester (${item.semester})`);
        }
      }

      let result = await Result.findOne({ studentId, semester, session });
      if (!result) result = new Result({ studentId, semester, session, branch: student?.branch, subjectMarks: [] });

      const existing = result.subjectMarks.findIndex(s => (
        itemType === 'lab' ? s.labId?.toString() === String(itemId) : s.subjectId?.toString() === String(itemId)
      ));
      const markEntry = {
        ...(existing >= 0
          ? (result.subjectMarks[existing].toObject ? result.subjectMarks[existing].toObject() : result.subjectMarks[existing])
          : {}),
        ...(itemType === 'lab' ? { labId: itemId } : { subjectId: itemId }),
        itemType, itemCode: item.code, itemName: item.name,
        cw, sw, theory, practical, internalMarks: itemType === 'lab' ? sw : cw,
        externalMarks: itemType === 'lab' ? practical : theory,
        totalMarks, grade, gradePoints, credits, creditPoints,
        submissionStatus: 'pending',
        submittedBy: faculty._id,
        submittedAt: new Date(),
        reviewedBy: undefined,
        reviewedAt: undefined,
        rejectionReason: undefined,
      };
      if (existing >= 0) result.subjectMarks[existing] = markEntry;
      else result.subjectMarks.push(markEntry);

      await result.save();
    }
    res.json({ success: true, message: 'Marks updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMarks = async (req, res) => {
  try {
    const { semester, session, subjectId } = req.query;
    const filter = {};
    if (semester) filter.semester = Number(semester);
    if (session) filter.session = session;
    const results = await Result.find(filter)
      .populate('studentId', 'firstName lastName enrollmentNo')
      .populate('subjectMarks.subjectId', 'code name credits')
      .populate('subjectMarks.labId', 'code name credits')
      .lean();
    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk upload marks via Excel
exports.bulkUploadCoursework = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { subjectId, labId, itemType = 'class', semester, session, midTermMode = 'average', publishNotice = 'true' } = req.body;
    const itemId = itemType === 'lab' ? labId : subjectId;
    if (!itemId || !semester || !session) {
      return res.status(400).json({ success: false, message: 'item, semester, and session are required' });
    }
    if (itemType === 'class' && !['average', 'best'].includes(midTermMode)) {
      return res.status(400).json({ success: false, message: 'midTermMode must be average or best' });
    }

    const item = itemType === 'lab'
      ? await Lab.findById(itemId).lean()
      : await Subject.findById(itemId).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Class or lab not found' });

    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const teaches = await facultyTeachesItem(faculty, itemId, itemType, item, session);
    if (!teaches) return res.status(403).json({ success: false, message: 'Not authorized to upload marks for this item' });

    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const duplicateEnrollments = findDuplicateEnrollmentsInRows(rows);
    if (duplicateEnrollments.length > 0) {
      return res.status(400).json({ success: false, message: `Duplicate enrollment number(s): ${duplicateEnrollments.join(', ')}` });
    }

    const results = { success: [], failed: [] };
    for (const [idx, row] of rows.entries()) {
      const rowNumber = idx + 2;
      try {
        const enrollmentNo = normalizeEnrollmentNo(row.enrollmentNo || row.EnrollmentNo || row['Enrollment No'] || row.rollNo || row.RollNo);
        if (!enrollmentNo) throw new Error('Missing enrollment number');
        const { student, reason } = await findUniqueStudentByEnrollmentNo(enrollmentNo);
        if (!student) throw new Error(reason);
        if (student.branch !== item.branch) throw new Error(`Student is from ${student.branch}, item is for ${item.branch}`);

        const assignmentMarks = numberFromRow(row, ['assignmentMarks', 'AssignmentMarks', 'Assignment Marks', 'assignment', 'Assignment', 'Assignments']);
        let midTerm1;
        let midTerm2;
        let attendanceMarks;
        let internalMarks;
        if (itemType === 'class') {
          midTerm1 = numberFromRow(row, ['midTerm1', 'MidTerm1', 'Mid Term 1', 'MidTerm 1']);
          midTerm2 = numberFromRow(row, ['midTerm2', 'MidTerm2', 'Mid Term 2', 'MidTerm 2']);
          const midTermError = validateMarkRange(midTerm1, 0, 20, 'Mid Term 1')
            || validateMarkRange(midTerm2, 0, 20, 'Mid Term 2');
          if (midTermError) throw new Error(midTermError);
        } else {
          attendanceMarks = numberFromRow(row, ['attendanceMarks', 'AttendanceMarks', 'Attendance Marks', 'attendance', 'Attendance']);
          internalMarks = numberFromRow(row, ['internalMarks', 'InternalMarks', 'Internal Marks', 'internal', 'Internal']);
          const labError = validateMarkRange(attendanceMarks, 0, 10, 'Attendance marks')
            || validateMarkRange(assignmentMarks, 0, 10, 'Assignment marks')
            || validateMarkRange(internalMarks, 0, 20, 'Internal marks');
          if (labError) throw new Error(labError);
        }
        const assignmentError = validateMarkRange(assignmentMarks, 0, 10, 'Assignment marks');
        if (assignmentError) throw new Error(assignmentError);

        const result = await Result.findOneAndUpdate(
          { studentId: student._id, semester: Number(semester), session },
          { $setOnInsert: { branch: student.branch, subjectMarks: [] } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        const existingIdx = result.subjectMarks.findIndex(mark => (
          itemType === 'lab'
            ? String(mark.labId) === String(itemId)
            : String(mark.subjectId) === String(itemId)
        ));
        const existing = existingIdx >= 0 ? result.subjectMarks[existingIdx] : {};
        const midTermAverage = itemType === 'class'
          ? (midTermMode === 'best' ? Math.max(midTerm1, midTerm2) : (midTerm1 + midTerm2) / 2)
          : undefined;
        const coursework = itemType === 'class'
          ? Number((midTermAverage + assignmentMarks).toFixed(2))
          : Number((attendanceMarks + assignmentMarks + internalMarks).toFixed(2));
        const markEntry = {
          ...(existing.toObject ? existing.toObject() : existing),
          ...(itemType === 'lab' ? { labId: itemId } : { subjectId: itemId }),
          itemType,
          itemCode: item.code,
          itemName: item.name,
          ...(itemType === 'class'
            ? { midTerm1, midTerm2, midTermMode, midTermAverage, assignmentMarks, cw: coursework, internalMarks: coursework }
            : { attendanceMarks, assignmentMarks, internalMarks, sw: coursework }),
          submissionStatus: 'pending',
          submittedBy: faculty._id,
          submittedAt: new Date(),
          reviewedBy: undefined,
          reviewedAt: undefined,
          rejectionReason: undefined,
        };
        const theory = Number(markEntry.theory || markEntry.externalMarks || 0);
        const practical = Number(markEntry.practical || markEntry.externalMarks || 0);
        markEntry.totalMarks = itemType === 'lab' ? coursework + practical : coursework + theory;
        markEntry.externalMarks = itemType === 'lab' ? practical : theory;
        markEntry.internalMarks = coursework;
        markEntry.credits = markEntry.credits || item.credits || (itemType === 'lab' ? 1 : 3);
        markEntry.grade = calculateGrade(markEntry.totalMarks).grade;
        markEntry.gradePoints = calculateGrade(markEntry.totalMarks).gradePoints;
        markEntry.creditPoints = markEntry.gradePoints * markEntry.credits;

        if (existingIdx >= 0) result.subjectMarks[existingIdx] = markEntry;
        else result.subjectMarks.push(markEntry);
        result.markModified('subjectMarks');
        await result.save();
        results.success.push({ row: rowNumber, enrollmentNo, coursework, totalMarks: markEntry.totalMarks });
      } catch (err) {
        results.failed.push({ row: rowNumber, enrollmentNo: row.enrollmentNo || row.EnrollmentNo || '', reason: err.message });
      }
    }

    if (String(publishNotice) !== 'false' && results.success.length > 0) {
      const label = itemType === 'lab' ? 'Lab Internal Marks' : 'Class CW Marks';
      await Notice.create({
        title: `${label} Published: ${item.code} — ${item.name}`,
        body: itemType === 'lab'
          ? `Attendance, assignment and internal marks for ${item.code} — ${item.name} have been published. Please check your student Results page.`
          : `Mid Term and assignment marks for ${item.code} — ${item.name} have been published. CW is calculated using ${midTermMode === 'best' ? 'best of Mid Term 1 and Mid Term 2' : 'the average of Mid Term 1 and Mid Term 2'} plus assignment marks. Please check your student Results page.`,
        audience: 'students',
        isPinned: false,
      });
    }
    try { fs.unlinkSync(req.file.path); } catch (e) { /* cleanup best effort */ }
    res.json({ success: true, data: results });
  } catch (err) {
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch (e) { /* cleanup best effort */ }
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.bulkUploadMarks = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { subjectId, labId, itemType = 'class', semester, session } = req.body;
    const itemId = itemType === 'lab' ? labId : subjectId;
    if (!itemId || !semester || !session) {
      return res.status(400).json({ success: false, message: 'item, semester, and session are required' });
    }

    const xlsx = require('xlsx');
    const fs = require('fs');

    const subject = itemType === 'lab'
      ? await Lab.findById(itemId).lean()
      : await Subject.findById(itemId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Class or lab not found' });
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const credits = subject.credits || 3;

    const workbook = xlsx.readFile(req.file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const duplicateEnrollments = findDuplicateEnrollmentsInRows(rows);
    if (duplicateEnrollments.length > 0) {
      try { fs.unlinkSync(req.file.path); } catch (e) { }
      return res.status(400).json({
        success: false,
        message: `Duplicate enrollment number(s) found in upload file: ${duplicateEnrollments.join(', ')}`,
      });
    }

    const results = { success: [], failed: [] };

    for (const [idx, row] of rows.entries()) {
      try {
        const enrollmentNo = normalizeEnrollmentNo(row.enrollmentNo || row.EnrollmentNo || row.enrollment_no || row.rollNo || row.RollNo);
        const rawMarks = {
          cw: row.cw ?? row.CW ?? row['CW (30)'],
          sw: row.sw ?? row.SW ?? row['SW (40)'],
          theory: row.theory ?? row.Theory ?? row['Theory (70)'],
          practical: row.practical ?? row.Practical ?? row['Practical (60)'],
          internalMarks: row.internalMarks || row.InternalMarks || row.internal || row.Internal,
          externalMarks: row.externalMarks || row.ExternalMarks || row.external || row.External,
        };

        const assessment = calculateAssessment({ itemType, ...rawMarks });
        if (assessment.error) {
          results.failed.push({ row: idx + 2, reason: assessment.error, enrollmentNo });
          continue;
        }
        const { cw = 0, sw = 0, theory = 0, practical = 0, totalMarks } = assessment;

        if (!enrollmentNo) {
          results.failed.push({ row: idx + 2, reason: 'Missing enrollment number' });
          continue;
        }

        const { student, reason } = await findUniqueStudentByEnrollmentNo(enrollmentNo);
        if (!student) {
          results.failed.push({ row: idx + 2, reason, enrollmentNo });
          continue;
        }

        // Enrollment check: branch must match subject branch
        if (student.branch !== subject.branch) {
          results.failed.push({
            row: idx + 2,
            reason: `Enrollment Mismatch: Student is from ${student.branch}, but this subject is for ${subject.branch}`,
            enrollmentNo
          });
          continue;
        }

        // Semester check: Ensure student is in (or has passed) the semester of the subject
        if (student.currentSemester < subject.semester) {
          results.failed.push({
            row: idx + 2,
            reason: `Semester Mismatch: Student is in Sem ${student.currentSemester}, but this subject is for Sem ${subject.semester}`,
            enrollmentNo
          });
          continue;
        }

        const { grade, gradePoints } = calculateGrade(totalMarks);
        const creditPoints = gradePoints * credits;

        let result = await Result.findOne({ studentId: student._id, semester: Number(semester), session });
        if (!result) {
          result = new Result({
            studentId: student._id,
            semester: Number(semester),
            session,
            branch: student.branch,
            subjectMarks: [],
          });
        }

        const existingIdx = result.subjectMarks.findIndex(s => (
          itemType === 'lab' ? s.labId?.toString() === String(itemId) : s.subjectId?.toString() === String(itemId)
        ));
        const markEntry = {
          ...(existingIdx >= 0
            ? (result.subjectMarks[existingIdx].toObject ? result.subjectMarks[existingIdx].toObject() : result.subjectMarks[existingIdx])
            : {}),
          ...(itemType === 'lab' ? { labId: itemId } : { subjectId: itemId }),
          itemType, itemCode: subject.code, itemName: subject.name,
          cw, sw, theory, practical, internalMarks: itemType === 'lab' ? sw : cw,
          externalMarks: itemType === 'lab' ? practical : theory,
          totalMarks, grade, gradePoints, credits, creditPoints,
          submissionStatus: 'pending',
          submittedBy: faculty._id,
          submittedAt: new Date(),
          reviewedBy: undefined,
          reviewedAt: undefined,
          rejectionReason: undefined,
        };

        if (existingIdx >= 0) result.subjectMarks[existingIdx] = markEntry;
        else result.subjectMarks.push(markEntry);

        await result.save();
        results.success.push({ row: idx + 2, enrollmentNo, totalMarks, grade });
      } catch (errRow) {
        results.failed.push({ row: idx + 2, reason: errRow.message || 'Failed to process row' });
      }
    }

    // cleanup uploaded file
    try { require('fs').unlinkSync(req.file.path); } catch (e) { }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadMarksTemplate = async (req, res) => {
  try {
    const { subjectId, labId, itemType = 'class', semester, session } = req.query;
    const itemId = itemType === 'lab' ? labId : subjectId;
    if (!itemId || !semester || !session) return res.status(400).json({ success: false, message: 'item, semester, and session required' });

    const subject = itemType === 'lab' ? await Lab.findById(itemId).lean() : await Subject.findById(itemId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Class or lab not found' });

    // Ensure requesting faculty actually teaches this subject
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const teaches = (subject.facultyId && subject.facultyId.toString() === (faculty._id || '').toString())
      || (itemType === 'class' && Array.isArray(faculty.subjectsTaught) && faculty.subjectsTaught.map(s => s.toString()).includes(itemId.toString()));
    if (!teaches) return res.status(403).json({ success: false, message: 'Not authorized to download template for this item' });

    const studentFilter = { branch: subject.branch, currentSemester: Number(semester), session };
    if (req.query.section) studentFilter.section = req.query.section;

    let students = await Student.find(studentFilter)
      .sort({ enrollmentNo: 1 })
      .select('firstName lastName enrollmentNo branch currentSemester section session')
      .lean();

    // Match the roster shown in the upload screen when legacy student records
    // have a different session value.
    if (students.length <= 2) {
      const rosterFilter = { branch: subject.branch, currentSemester: Number(semester) };
      if (req.query.section) rosterFilter.section = req.query.section;
      const rosterStudents = await Student.find(rosterFilter)
        .sort({ enrollmentNo: 1 })
        .select('firstName lastName enrollmentNo branch currentSemester section session')
        .lean();
      if (rosterStudents.length > students.length) students = rosterStudents;
    }

    if (students.length === 0) return res.status(404).json({ success: false, message: 'No students found for this branch and semester' });

    // Find existing results to pre-fill marks if any
    const results = await Result.find({ semester: Number(semester), session }).lean();

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`${subject.code} Marks`);

    // Add columns
    ws.columns = [
      { header: 'enrollmentNo', key: 'enrollmentNo', width: 20 },
      { header: 'studentName', key: 'studentName', width: 30 },
      ...(itemType === 'lab'
        ? [{ header: 'SW (40)', key: 'sw', width: 10 }, { header: 'Practical (60)', key: 'practical', width: 14 }]
        : [{ header: 'CW (30)', key: 'cw', width: 10 }, { header: 'Theory (70)', key: 'theory', width: 12 }]),
    ];

    // Style header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Add data
    for (const student of students) {
      // Look for existing marks for this student and subject
      const result = results.find(r => r.studentId?.toString() === student._id.toString());
      let cw = '';
      let sw = '';
      let theory = '';
      let practical = '';

      if (result) {
        const sm = (result.subjectMarks || []).find(s => (
          itemType === 'lab' ? s.labId?.toString() === itemId : s.subjectId?.toString() === itemId
        ));
        if (sm) {
          cw = sm.cw ?? sm.internalMarks ?? '';
          sw = sm.sw ?? '';
          theory = sm.theory ?? sm.externalMarks ?? '';
          practical = sm.practical ?? sm.externalMarks ?? '';
        }
      }

      ws.addRow({
        enrollmentNo: student.enrollmentNo,
        studentName: `${student.firstName} ${student.lastName}`,
        ...(itemType === 'lab' ? { sw, practical } : { cw, theory }),
      });
    }

    const filename = `MarksTemplate_${subject.code}_Sem${semester}_${session}.xlsx`;
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadCourseworkTemplate = async (req, res) => {
  try {
    const { subjectId, labId, itemType = 'class', semester, session } = req.query;
    const itemId = itemType === 'lab' ? labId : subjectId;
    const item = itemType === 'lab' ? await Lab.findById(itemId).lean() : await Subject.findById(itemId).lean();
    if (!itemId || !semester || !session || !item) {
      return res.status(400).json({ success: false, message: 'item, semester, session and a valid item are required' });
    }
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    const teaches = await facultyTeachesItem(faculty, itemId, itemType, item, session);
    if (!teaches) return res.status(403).json({ success: false, message: 'Not authorized to download template for this item' });

    const students = await Student.find({
      branch: item.branch,
      currentSemester: Number(semester),
      session,
    }).sort({ enrollmentNo: 1 }).select('enrollmentNo firstName lastName branch currentSemester session section').lean();
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`${item.code} Internal Marks`);
    ws.columns = [
      { header: 'enrollmentNo', key: 'enrollmentNo', width: 20 },
      { header: 'studentName', key: 'studentName', width: 30 },
      ...(itemType === 'lab'
        ? [
          { header: 'Attendance Marks', key: 'attendanceMarks', width: 18 },
          { header: 'Assignment Marks', key: 'assignmentMarks', width: 18 },
          { header: 'Internal Marks', key: 'internalMarks', width: 18 },
        ]
        : [
          { header: 'midTerm1', key: 'midTerm1', width: 15 },
          { header: 'midTerm2', key: 'midTerm2', width: 15 },
          { header: 'assignmentMarks', key: 'assignmentMarks', width: 18 },
        ]),
    ];
    ws.getRow(1).font = { bold: true };
    students.forEach(student => ws.addRow({
      enrollmentNo: student.enrollmentNo,
      studentName: `${student.firstName} ${student.lastName}`,
    }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="InternalMarksTemplate_${item.code}_Sem${semester}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadCourseworkRoster = async (req, res) => {
  try {
    const { subjectId, labId, itemType = 'class', semester, session } = req.query;
    const itemId = itemType === 'lab' ? labId : subjectId;
    const item = itemType === 'lab' ? await Lab.findById(itemId).lean() : await Subject.findById(itemId).lean();
    if (!itemId || !semester || !session || !item) {
      return res.status(400).json({ success: false, message: 'item, semester, session and a valid item are required' });
    }
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    const teaches = String(item.facultyId) === String(faculty?._id)
      || (itemType === 'class' && (faculty?.subjectsTaught || []).map(String).includes(String(itemId)));
    if (!teaches) return res.status(403).json({ success: false, message: 'Not authorized to download this roster' });

    const students = await Student.find({
      branch: item.branch,
      currentSemester: Number(semester),
      session,
    }).sort({ enrollmentNo: 1 }).select('enrollmentNo firstName lastName branch currentSemester session section').lean();
    if (students.length === 0) return res.status(404).json({ success: false, message: 'No students found for this class or lab' });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`${item.code} Student List`);
    ws.columns = [
      { header: 'enrollmentNo', key: 'enrollmentNo', width: 20 },
      { header: 'studentName', key: 'studentName', width: 30 },
      ...(itemType === 'lab'
        ? [
          { header: 'Attendance Marks', key: 'attendanceMarks', width: 18 },
          { header: 'Assignment Marks', key: 'assignmentMarks', width: 18 },
          { header: 'Internal Marks', key: 'internalMarks', width: 18 },
        ]
        : [
          { header: 'midTerm1', key: 'midTerm1', width: 15 },
          { header: 'midTerm2', key: 'midTerm2', width: 15 },
          { header: 'assignmentMarks', key: 'assignmentMarks', width: 18 },
        ]),
    ];
    ws.getRow(1).font = { bold: true };
    students.forEach(student => ws.addRow({
      enrollmentNo: student.enrollmentNo,
      studentName: `${student.firstName} ${student.lastName}`,
    }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="StudentList_${item.code}_Sem${semester}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadMarksReport = async (req, res) => {
  try {
    const { subjectId, labId, itemType = 'class', semester, session } = req.query;
    const itemId = itemType === 'lab' ? labId : subjectId;
    if (!itemId || !semester || !session) return res.status(400).json({ success: false, message: 'item, semester, and session required' });

    const subject = itemType === 'lab' ? await Lab.findById(itemId).lean() : await Subject.findById(itemId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Class or lab not found' });

    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const teaches = (subject.facultyId && subject.facultyId.toString() === (faculty._id || '').toString())
      || (itemType === 'class' && Array.isArray(faculty.subjectsTaught) && faculty.subjectsTaught.map(s => s.toString()).includes(itemId.toString()));
    if (!teaches) return res.status(403).json({ success: false, message: 'Not authorized to export marks for this item' });

    const studentFilter = { branch: subject.branch, currentSemester: Number(semester), session };
    if (req.query.section) studentFilter.section = req.query.section;

    const students = await Student.find(studentFilter)
      .sort({ enrollmentNo: 1 })
      .select('firstName lastName enrollmentNo')
      .lean();

    if (students.length === 0) return res.status(404).json({ success: false, message: 'No students found for this branch and semester' });

    // Load results for these students to fill marks
    const studentIds = students.map(s => s._id);
    const results = await Result.find({ studentId: { $in: studentIds }, semester: Number(semester), session }).lean();

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`${subject.code}_Marks_${session}`);

    ws.columns = [
      { header: 'enrollmentNo', key: 'enrollmentNo', width: 20 },
      { header: 'studentName', key: 'studentName', width: 30 },
      ...(itemType === 'lab'
        ? [{ header: 'SW (40)', key: 'sw', width: 10 }, { header: 'Practical (60)', key: 'practical', width: 14 }]
        : [{ header: 'CW (30)', key: 'cw', width: 10 }, { header: 'Theory (70)', key: 'theory', width: 12 }]),
    ];

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const student of students) {
      const result = results.find(r => String(r.studentId) === String(student._id));
      let cw = '';
      let sw = '';
      let theory = '';
      let practical = '';

      if (result && Array.isArray(result.subjectMarks)) {
        const sm = result.subjectMarks.find(s => (
          itemType === 'lab' ? s.labId?.toString() === itemId.toString() : s.subjectId?.toString() === itemId.toString()
        ));
        if (sm) {
          cw = sm.cw ?? sm.internalMarks ?? '';
          sw = sm.sw ?? '';
          theory = sm.theory ?? sm.externalMarks ?? '';
          practical = sm.practical ?? sm.externalMarks ?? '';
        }
      }

      ws.addRow({
        enrollmentNo: student.enrollmentNo,
        studentName: `${student.firstName} ${student.lastName}`,
        ...(itemType === 'lab' ? { sw, practical } : { cw, theory }),
      });
    }

    const filename = `SubmittedMarks_${subject.code}_Sem${semester}_${session}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNotices = async (req, res) => {
  try {
    const filters = [{ audience: { $in: ['all', 'faculty'] } }];
    if (req.academicSession) {
      filters.push({
        $or: [{ session: req.academicSession }, { session: null }, { session: '' }, { session: { $exists: false } }],
      });
    }
    if (req.academicTerm) {
      filters.push({
        $or: [{ term: req.academicTerm }, { term: { $exists: false } }, { term: null }],
      });
    }
    const notices = await Notice.find({ $and: filters })
      .sort({ isPinned: -1, createdAt: -1 })
      .lean();

    const userIdStr = String(req.user._id);
    const mapped = notices.map(n => ({
      ...n,
      isRead: Array.isArray(n.readBy) && n.readBy.some(id => String(id) === userIdStr),
    }));
    const unreadCount = mapped.filter(n => !n.isRead).length;

    res.json({ success: true, data: { notices: mapped, unreadCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markNoticesRead = async (req, res) => {
  try {
    const { noticeIds } = req.body || {};
    const filters = [{ audience: { $in: ['all', 'faculty'] } }];
    if (req.academicSession) {
      filters.push({
        $or: [{ session: req.academicSession }, { session: null }, { session: '' }, { session: { $exists: false } }],
      });
    }
    if (req.academicTerm) {
      filters.push({
        $or: [{ term: req.academicTerm }, { term: { $exists: false } }, { term: null }],
      });
    }

    const filter = { $and: filters };

    if (Array.isArray(noticeIds) && noticeIds.length > 0) {
      filter._id = { $in: noticeIds };
    }

    await Notice.updateMany(filter, {
      $addToSet: { readBy: req.user._id },
    });

    res.json({ success: true, message: 'Notices marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getClassSchedule = async (req, res) => {
  try {
    const entries = await TimetableEntry.find({ faculty: req.user._id, academicYear: req.academicSession })
      .populate('subject', 'code name')
      .populate('faculty', 'firstName lastName')
      .populate('section', 'department year sectionName')
      .populate('room', 'name code')
      .lean();
    res.json({ success: true, data: { schedules: entries } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFeedback = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const teachingAssignments = await FacultyTeachingAssignment.find({
      facultyId: faculty._id,
      session: req.academicSession,
      term: req.academicTerm,
    }).select('subjectId').lean();
    const assignedSubjectIds = teachingAssignments.length
      ? teachingAssignments.map(item => item.subjectId)
      : await Subject.find({ facultyId: faculty._id }).distinct('_id');
    const feedback = await Feedback.find({
      facultyId: faculty._id,
      session: req.academicSession,
      term: req.academicTerm,
      subjectId: { $in: assignedSubjectIds },
    })
      .populate('subjectId', 'code name semester')
      .sort({ submittedAt: -1 }).lean();
    const criteria = ['knowledge', 'clarity', 'punctuality', 'interaction', 'doubtSolving', 'fairness'];
    const grouped = feedback.reduce((result, item) => {
      const key = String(item.subjectId?._id || item.subjectId);
      if (!result[key]) result[key] = { subject: item.subjectId, count: 0, totals: {} };
      result[key].count += 1;
      criteria.forEach(metric => {
        result[key].totals[metric] = (result[key].totals[metric] || 0) + (Number(item.ratings?.[metric]) || 0);
      });
      return result;
    }, {});
    const analytics = Object.values(grouped).map(item => {
      const averages = Object.fromEntries(criteria.map(metric => [metric, Number((item.totals[metric] / item.count).toFixed(2))]));
      return {
        subject: item.subject,
        count: item.count,
        ...averages,
        average: Number((criteria.reduce((sum, metric) => sum + averages[metric], 0) / criteria.length).toFixed(2)),
      };
    }).sort((a, b) => b.average - a.average);
    const criterionAverages = Object.fromEntries(criteria.map(metric => [
      metric,
      feedback.length ? Number((feedback.reduce((sum, item) => sum + (Number(item.ratings?.[metric]) || 0), 0) / feedback.length).toFixed(2)) : 0,
    ]));
    const commentsCount = feedback.filter(item => String(item.comments || '').trim()).length;
    const overview = {
      totalResponses: feedback.length,
      overallAverage: feedback.length ? Number((Object.values(criterionAverages).reduce((sum, value) => sum + value, 0) / criteria.length).toFixed(2)) : 0,
      commentsCount,
      commentRate: feedback.length ? Number(((commentsCount / feedback.length) * 100).toFixed(1)) : 0,
      criterionAverages,
      strongestSubject: analytics[0] || null,
      needsAttention: analytics.length && analytics[analytics.length - 1].average <= 2.5
        ? analytics[analytics.length - 1]
        : null,
    };
    res.json({ success: true, data: { feedback, analytics, overview } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Lab Batch Management ────────────────────────────────────────────────────

/**
 * GET /faculty/lab-batches/:labId
 * Returns the batch assignments for a lab the faculty teaches.
 * Also returns the full student roster for the lab so the UI can show
 * unassigned students.
 */
exports.getLabBatches = async (req, res) => {
  try {
    const { labId } = req.params;
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const lab = await Lab.findById(labId).lean();
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found' });

    // Verify faculty teaches this lab
    const assignment = await FacultyTeachingAssignment.findOne({
      facultyId: faculty._id,
      labId,
      itemType: 'lab',
    });
    if (!assignment) return res.status(403).json({ success: false, message: 'Not authorized for this lab' });

    const session = req.academicSession;
    // All students in this branch + semester
    const students = await Student.find({
      branch: lab.branch,
      currentSemester: lab.semester,
    })
      .sort({ enrollmentNo: 1 })
      .select('firstName lastName enrollmentNo branch currentSemester section')
      .lean();

    const batchDoc = await LabBatch.findOne({ labId, session })
      .populate('batches.studentIds', 'firstName lastName enrollmentNo')
      .lean();

    // Batch names the section actually uses (e.g. A1, A2, A3) so the UI assigns
    // students to real timetable batches instead of free-form names.
    const sectionName = students.find((s) => s.section)?.section || '';
    const sectionDoc = await Section.findOne({
      department: lab.branch,
      year: Math.ceil(lab.semester / 2),
      ...(sectionName ? { sectionName: String(sectionName) } : {}),
    }).select('batches').lean();

    res.json({
      success: true,
      data: {
        lab,
        students,
        batches: batchDoc ? batchDoc.batches : [],
        sectionBatches: sectionDoc?.batches || [],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /faculty/lab-batches/:labId
 * Saves/replaces all batches for a lab.
 * Body: { batches: [{ batchName, studentIds: [...] }] }
 * Supports bulk assignment via enrollmentRange: { from, to } instead of studentIds.
 * Body: { batches: [{ batchName, enrollmentRange: { from: '2300101', to: '2300130' } }] }
 */
exports.saveLabBatches = async (req, res) => {
  try {
    const { labId } = req.params;
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const lab = await Lab.findById(labId).lean();
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found' });

    const assignment = await FacultyTeachingAssignment.findOne({
      facultyId: faculty._id,
      labId,
      itemType: 'lab',
    });
    if (!assignment) return res.status(403).json({ success: false, message: 'Not authorized for this lab' });

    const session = req.academicSession;
    const rawBatches = req.body.batches || [];

    // Resolve enrollmentRange → studentIds if provided
    const resolvedBatches = await Promise.all(
      rawBatches.map(async (b) => {
        if (b.enrollmentRange) {
          const { from, to } = b.enrollmentRange;
          // Fetch all students in the lab whose enrollmentNo falls in [from, to] lexicographically
          const students = await Student.find({
            branch: lab.branch,
            currentSemester: lab.semester,
            enrollmentNo: { $gte: String(from), $lte: String(to) },
          }).select('_id').lean();
          return { batchName: b.batchName, studentIds: students.map((s) => s._id) };
        }
        return { batchName: b.batchName, studentIds: (b.studentIds || []) };
      }),
    );

    const batchDoc = await LabBatch.findOneAndUpdate(
      { labId, session },
      { $set: { batches: resolvedBatches } },
      { upsert: true, new: true },
    );

    res.json({ success: true, data: { batches: batchDoc.batches } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Syllabus Management (Faculty) ──────────────────────────────────────────

/**
 * Helper: verify the faculty is assigned to a subject or lab.
 */
const facultyOwnsItem = async (facultyId, itemType, itemId, session) => {
  const filter = { facultyId, itemType, session };
  if (itemType === 'lab') filter.labId = itemId;
  else filter.subjectId = itemId;
  return FacultyTeachingAssignment.exists(filter);
};

/**
 * PATCH /faculty/syllabus/subject/:subjectId
 * Faculty updates syllabus text (and optionally uploads a file) for a subject.
 */
exports.updateSubjectSyllabus = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    const owns = await facultyOwnsItem(faculty._id, 'class', subject._id, req.academicSession);
    if (!owns) return res.status(403).json({ success: false, message: 'Not authorized for this subject' });

    if (req.body.syllabusText !== undefined) subject.syllabusText = String(req.body.syllabusText || '').trim();
    if (req.file) subject.syllabusFile = `/uploads/${req.file.filename}`;

    await subject.save();
    res.json({ success: true, data: { subject: { _id: subject._id, syllabusText: subject.syllabusText, syllabusFile: subject.syllabusFile } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /faculty/syllabus/lab/:labId
 * Faculty updates syllabus text (and optionally uploads a file) for a lab.
 */
exports.updateLabSyllabus = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const lab = await Lab.findById(req.params.labId);
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found' });

    const owns = await facultyOwnsItem(faculty._id, 'lab', lab._id, req.academicSession);
    if (!owns) return res.status(403).json({ success: false, message: 'Not authorized for this lab' });

    if (req.body.syllabusText !== undefined) lab.syllabusText = String(req.body.syllabusText || '').trim();
    if (req.file) lab.syllabusFile = `/uploads/${req.file.filename}`;

    await lab.save();
    res.json({ success: true, data: { lab: { _id: lab._id, syllabusText: lab.syllabusText, syllabusFile: lab.syllabusFile } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Enrolled Students (Faculty) ────────────────────────────────────────────

const STUDENT_FIELDS = 'firstName lastName enrollmentNo branch currentSemester section session year admissionYear dob gender';

/**
 * GET /faculty/subject-students/:subjectId
 * Returns all students enrolled in the subject's branch+semester.
 * Faculty must be assigned to the subject.
 */
exports.getSubjectStudents = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const subject = await Subject.findById(req.params.subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    // Verify faculty is assigned to this subject
    const owns = await FacultyTeachingAssignment.exists({
      facultyId: faculty._id,
      itemType: 'class',
      subjectId: subject._id,
      session: req.academicSession,
    });
    if (!owns) return res.status(403).json({ success: false, message: 'Not authorized for this subject' });

    // Fetch students in this branch+semester for the active session
    const studentFilter = {
      branch: subject.branch,
      currentSemester: subject.semester,
    };
    const students = await Student.find(studentFilter)
      .select(STUDENT_FIELDS)
      .sort({ section: 1, enrollmentNo: 1 })
      .lean();

    const semToYear = (sem) => Math.ceil(sem / 2);

    res.json({
      success: true,
      data: {
        subject: { _id: subject._id, code: subject.code, name: subject.name, branch: subject.branch, semester: subject.semester },
        students: students.map(s => ({
          _id: s._id,
          firstName: s.firstName,
          lastName: s.lastName,
          enrollmentNo: s.enrollmentNo,
          branch: s.branch,
          section: s.section || '—',
          semester: s.currentSemester,
          year: semToYear(s.currentSemester),
          gender: s.gender,
        })),
        count: students.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /faculty/lab-students/:labId
 * Returns all students enrolled in the lab's branch+semester, with their batch info.
 * Faculty must be assigned to the lab.
 */
exports.getLabStudents = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const lab = await Lab.findById(req.params.labId).lean();
    if (!lab) return res.status(404).json({ success: false, message: 'Lab not found' });

    // Verify faculty is assigned to this lab
    const owns = await FacultyTeachingAssignment.exists({
      facultyId: faculty._id,
      itemType: 'lab',
      labId: lab._id,
      session: req.academicSession,
    });
    if (!owns) return res.status(403).json({ success: false, message: 'Not authorized for this lab' });

    // Fetch all students in this branch+semester
    const students = await Student.find({
      branch: lab.branch,
      currentSemester: lab.semester,
    })
      .select(STUDENT_FIELDS)
      .sort({ section: 1, enrollmentNo: 1 })
      .lean();

    // Fetch batch assignments for this lab
    const batchDoc = await LabBatch.findOne({ labId: lab._id, session: req.academicSession }).lean();
    const batches = batchDoc?.batches || [];

    // Build studentId → batchName map
    const batchByStudent = new Map();
    batches.forEach(b => {
      b.studentIds.forEach(sid => batchByStudent.set(String(sid), b.batchName));
    });

    const semToYear = (sem) => Math.ceil(sem / 2);

    res.json({
      success: true,
      data: {
        lab: { _id: lab._id, code: lab.code, name: lab.name, branch: lab.branch, semester: lab.semester },
        students: students.map(s => ({
          _id: s._id,
          firstName: s.firstName,
          lastName: s.lastName,
          enrollmentNo: s.enrollmentNo,
          branch: s.branch,
          section: s.section || '—',
          semester: s.currentSemester,
          year: semToYear(s.currentSemester),
          gender: s.gender,
          batch: batchByStudent.get(String(s._id)) || null,
        })),
        batches: batches.map(b => b.batchName),
        count: students.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
