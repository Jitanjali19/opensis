const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Notice = require('../models/Notice');
const ClassSchedule = require('../models/ClassSchedule');
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const facultyOwnsSubject = (faculty, subjectId, subject) => {
  if (!faculty || !subject) return false;
  const subjectOwned = subject.facultyId && String(subject.facultyId) === String(faculty._id);
  const facultyAssigned = Array.isArray(faculty.subjectsTaught) && faculty.subjectsTaught.map(String).includes(String(subjectId));
  return subjectOwned || facultyAssigned;
};

const getClassRoster = async (subject, semester, section = '') => {
  const filter = { branch: subject.branch, currentSemester: Number(semester) };
  if (section) filter.section = section;
  return Student.find(filter)
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

const getAttendanceRecordForDate = async (subjectId, date) => {
  const day = toLocalDateOnly(date);
  if (!day) return null;
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return Attendance.findOne({ subjectId, date: { $gte: start, $lte: end } }).lean();
};

const saveAttendanceWorkbook = async (workbook, filename) => {
  const dir = await ensureAttendanceUploadDir();
  const fullPath = path.join(dir, filename);
  await workbook.xlsx.writeFile(fullPath);
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
      update.profilePhotoUrl = `/uploads/${req.files.profilePhoto[0].filename}`;
    }

    if (req.files?.profilePhoto?.[0]) {
      update.profilePhotoUrl = `/uploads/${req.files.profilePhoto[0].filename}`;
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
    const [subjects, labs] = await Promise.all([
      Subject.find({ facultyId: faculty._id }).lean(),
      Lab.find({ facultyId: faculty._id }).lean(),
    ]);
    const items = [
      ...subjects.map(item => ({ ...item, itemType: 'class' })),
      ...labs.map(item => ({ ...item, itemType: 'lab' })),
    ];
    res.json({ success: true, data: { subjects: items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getClassStudents = async (req, res) => {
  try {
    const { subjectId, semester, session, section } = req.query;
    if (!subjectId || !semester) {
      return res.status(400).json({ success: false, message: 'subjectId and semester are required' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    if (!facultyOwnsSubject(faculty, subjectId, subject)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this class roster' });
    }

    const filter = {
      branch: subject.branch,
      currentSemester: Number(semester),
    };
    if (session) filter.session = session;
    if (section) filter.section = section;

    const students = await Student.find(filter)
      .sort({ enrollmentNo: 1 })
      .select('firstName lastName enrollmentNo branch currentSemester section session')
      .lean();

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
    const { subjectId, date, section, records } = req.body;
    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    if (!facultyOwnsSubject(faculty, subjectId, subject)) {
      return res.status(403).json({ success: false, message: 'Not authorized to mark attendance for this subject' });
    }

    const attendanceDate = toLocalDateOnly(date);
    if (!attendanceDate) return res.status(400).json({ success: false, message: 'Please select a valid date' });
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No attendance records provided' });
    }

    const rosterIds = new Set((await getClassRoster(subject, subject.semester, section || '')).map(s => String(s._id)));
    const cleanedRecords = records
      .filter(r => r.studentId && rosterIds.has(String(r.studentId)))
      .map(r => ({
        studentId: r.studentId,
        status: normalizeAttendanceStatus(r.status) || 'present',
      }));

    const attendanceFilter = {
      subjectId,
      facultyId: faculty._id,
      date: attendanceDate,
    };

    const attendancePayload = {
      subjectId,
      facultyId: faculty._id,
      date: attendanceDate,
      semester: subject.semester,
      branch: subject.branch,
      section: section || '',
      records: cleanedRecords,
    };

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
    const filter = { facultyId: faculty._id };
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    const records = await Attendance.find(filter)
      .populate('subjectId', 'code name')
      .sort({ date: -1 })
      .lean();
    res.json({ success: true, data: { records } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadAttendanceTemplate = async (req, res) => {
  try {
    const { subjectId, date } = req.query;
    if (!subjectId || !date) {
      return res.status(400).json({ success: false, message: 'subjectId and date are required' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    if (!facultyOwnsSubject(faculty, subjectId, subject)) {
      return res.status(403).json({ success: false, message: 'Not authorized to download attendance template for this subject' });
    }

    const students = await getClassRoster(subject, subject.semester);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'No students found for this subject class' });
    }

    const attendanceDate = toLocalDateOnly(date);
    const dateLabel = attendanceDate ? formatDisplayDate(attendanceDate) : date;

    // Check if attendance record already exists for this date
    const existingAttendance = await getAttendanceRecordForDate(subjectId, date);
    
    // Create a map of studentId to status from existing attendance record
    const statusMap = new Map();
    if (existingAttendance && existingAttendance.records && Array.isArray(existingAttendance.records)) {
      existingAttendance.records.forEach(record => {
        statusMap.set(String(record.studentId), record.status);
      });
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(`${subject.code}_${date}`);
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

    const filename = `AttendanceTemplate_${subject.code}_${date}.xlsx`;
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

    const { subjectId, date } = req.body;
    if (!subjectId || !date) {
      return res.status(400).json({ success: false, message: 'subjectId and date are required' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });
    if (!facultyOwnsSubject(faculty, subjectId, subject)) {
      return res.status(403).json({ success: false, message: 'Not authorized to upload attendance for this subject' });
    }

    const attendanceDate = toLocalDateOnly(date);
    if (!attendanceDate) return res.status(400).json({ success: false, message: 'Please select a valid date' });

    const students = await getClassRoster(subject, subject.semester);
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

    const existing = await Attendance.findOne({ subjectId, facultyId: faculty._id, date: attendanceDate });
    const attendancePayload = {
      subjectId,
      facultyId: faculty._id,
      date: attendanceDate,
      semester: subject.semester,
      branch: subject.branch,
      section: '',
      records,
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

const buildMonthlyAttendanceSummary = async ({ faculty, subjectId, month }) => {
  const subject = await Subject.findById(subjectId).lean();
  if (!subject) throw new Error('Subject not found');
  if (!facultyOwnsSubject(faculty, subjectId, subject)) throw new Error('Not authorized for this subject');

  const monthBounds = getMonthBounds(month);
  if (!monthBounds) throw new Error('month is required in YYYY-MM format');

  const students = await getClassRoster(subject, subject.semester);
  const attendanceDocs = await Attendance.find({
    subjectId,
    date: { $gte: monthBounds.start, $lte: monthBounds.end },
  })
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

  return { subject, monthBounds, monthDates, rows, attendanceDocs };
};

const createMonthlyAttendanceWorkbook = async (summary) => {
  const { subject, monthBounds, monthDates, rows } = summary;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(`${subject.code}_${monthBounds.year}_${String(monthBounds.month).padStart(2, '0')}`);

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
  const { subject, monthBounds, monthDates, rows } = summary;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(`Detention_${subject.code}_${monthBounds.year}`);

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
    const { subjectId, month } = req.query;
    if (!subjectId || !month) {
      return res.status(400).json({ success: false, message: 'subjectId and month are required' });
    }
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const summary = await buildMonthlyAttendanceSummary({ faculty, subjectId, month });
    res.json({
      success: true,
      data: {
        subject: summary.subject,
        month: month,
        days: summary.monthDates.map(entry => entry.day),
        dayLabels: summary.monthDates.map(entry => entry.label),
        students: summary.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadMonthlyAttendanceReport = async (req, res) => {
  try {
    const { subjectId, month } = req.query;
    if (!subjectId || !month) {
      return res.status(400).json({ success: false, message: 'subjectId and month are required' });
    }
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const summary = await buildMonthlyAttendanceSummary({ faculty, subjectId, month });
    const workbook = await createMonthlyAttendanceWorkbook(summary);
    const filename = `Attendance_${summary.subject.code}_${month}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.downloadDetentionAttendanceReport = async (req, res) => {
  try {
    const { subjectId, month } = req.query;
    if (!subjectId || !month) {
      return res.status(400).json({ success: false, message: 'subjectId and month are required' });
    }
    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    const summary = await buildMonthlyAttendanceSummary({ faculty, subjectId, month });
    const workbook = await createDetainedAttendanceWorkbook(summary);
    const filename = `DetentionList_${summary.subject.code}_${month}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.publishMonthlyAttendanceNotice = async (req, res) => {
  try {
    const { subjectId, month, type } = req.body;
    if (!subjectId || !month) {
      return res.status(400).json({ success: false, message: 'subjectId and month are required' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id }).lean();
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });

    const summary = await buildMonthlyAttendanceSummary({ faculty, subjectId, month });
    
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
      const detentionFilename = `DetentionList_${summary.subject.code}_${month}.xlsx`;
      const savedDetentionSheet = await saveAttendanceWorkbook(detentionWorkbook, detentionFilename);
      attachments = [savedDetentionSheet.publicPath];

      noticeTitle = `⚠️ Detention List: ${summary.subject.code} — ${month}`;
      noticeBody = [
        `📋 DETENTION NOTICE — ${summary.subject.code} (${summary.subject.name})`,
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
      const overallFilename = `Attendance_${summary.subject.code}_${month}.xlsx`;
      const savedOverallSheet = await saveAttendanceWorkbook(overallWorkbook, overallFilename);
      attachments = [savedOverallSheet.publicPath];

      noticeTitle = `📢 Monthly Attendance Record: ${summary.subject.code} — ${month}`;
      noticeBody = [
        `📋 ATTENDANCE STATUS — ${summary.subject.code} (${summary.subject.name})`,
        `Month: ${month}`,
        '------------------------------------------------------------------',
        'The overall monthly attendance record has been published.',
        '',
        'Please refer to the attached Excel sheet to view the complete monthly attendance report of all students in the class.',
      ].join('\n');
    }

    // Create a single class notice visible to all students
    const notice = await Notice.create({
      title: noticeTitle,
      body: noticeBody,
      audience: 'students',
      targetStudentIds: [], // Empty array = public to all students
      attachments,
      isPinned: type === 'detention', // Pin detention notices
    });

    res.status(201).json({ success: true, data: { notice, fileUrl: attachments[0] } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }

    const { subjectId, dueDate: dueDateRaw, title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!subjectId) {
      return res.status(400).json({ success: false, message: 'Subject is required' });
    }
    if (!dueDateRaw) {
      return res.status(400).json({ success: false, message: 'Due date is required' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ success: false, message: 'Invalid Subject ID' });
    }

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    if (!facultyOwnsSubject(faculty, subjectId, subject)) {
      return res.status(403).json({ success: false, message: 'Not authorized to create assignments for this subject' });
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
    const assignment = await Assignment.create({ ...req.body, facultyId: faculty._id, fileUrl });
    res.status(201).json({ success: true, data: { assignment } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAssignments = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const assignments = await Assignment.find({ facultyId: faculty._id })
      .populate('subjectId', 'code name')
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
      .populate('submissions.studentId', 'firstName lastName enrollmentNo')
      .lean();
    if (!assignment) return res.status(404).json({ success: false, message: 'Not found' });
    if (assignment.facultyId.toString() !== faculty._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view these submissions' });
    }

    const subject = assignment.subjectId;
    if (!subject) {
      return res.status(400).json({ success: false, message: 'Subject associated with assignment not found' });
    }

    // Find all students enrolled in the subject's branch and semester
    const enrolledStudents = await Student.find({
      branch: subject.branch,
      currentSemester: subject.semester,
    })
      .sort({ enrollmentNo: 1 })
      .select('firstName lastName enrollmentNo')
      .lean();

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
      if (student && item && student.branch !== item.branch) {
        throw new Error(`Enrollment Mismatch: Student ${student.enrollmentNo} is from ${student.branch}, cannot assign marks for ${item.branch} item`);
      }
      if (student && item && student.currentSemester < item.semester) {
        throw new Error(`Semester Mismatch: Student ${student.enrollmentNo} is in Sem ${student.currentSemester}, but this item is for Sem ${item.semester}`);
      }

      let result = await Result.findOne({ studentId, semester, session });
      if (!result) result = new Result({ studentId, semester, session, branch: student?.branch, subjectMarks: [] });

      const existing = result.subjectMarks.findIndex(s => (
        itemType === 'lab' ? s.labId?.toString() === String(itemId) : s.subjectId?.toString() === String(itemId)
      ));
      const markEntry = {
        ...(itemType === 'lab' ? { labId: itemId } : { subjectId: itemId }),
        itemType, itemCode: item.code, itemName: item.name,
        cw, sw, theory, practical, internalMarks: itemType === 'lab' ? sw : cw,
        externalMarks: itemType === 'lab' ? practical : theory,
        totalMarks, grade, gradePoints, credits, creditPoints,
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
      .lean();
    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bulk upload marks via Excel
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
          ...(itemType === 'lab' ? { labId: itemId } : { subjectId: itemId }),
          itemType, itemCode: subject.code, itemName: subject.name,
          cw, sw, theory, practical, internalMarks: itemType === 'lab' ? sw : cw,
          externalMarks: itemType === 'lab' ? practical : theory,
          totalMarks, grade, gradePoints, credits, creditPoints,
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
    const notices = await Notice.find({ audience: { $in: ['all', 'faculty'] } })
      .sort({ isPinned: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: { notices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getClassSchedule = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    const schedules = await ClassSchedule.find({ 'timetable.facultyId': faculty._id })
      .populate('timetable.subjectId', 'code name')
      .populate('timetable.facultyId', 'firstName lastName')
      .lean();
    res.json({ success: true, data: { schedules } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
