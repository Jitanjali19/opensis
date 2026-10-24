const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
const Student = require('../models/Student');
const FileAsset = require('../models/FileAsset');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Notice = require('../models/Notice');
const ExamTimetable = require('../models/ExamTimetable');
const Result = require('../models/Result');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');
const Fee = require('../models/Fee');
const LibraryIssue = require('../models/LibraryIssue');
const LibraryBook = require('../models/LibraryBook');
const Feedback = require('../models/Feedback');
const Faculty = require('../models/Faculty');
const RevaluationRequest = require('../models/RevaluationRequest');
const Section = require('../models/Section');
const TimetableEntry = require('../models/TimetableEntry');
const AdmitCard = require('../models/AdmitCard');

const { isValidPhone, PHONE_ERROR_MESSAGE } = require('../utils/phoneValidation');
const { getAcademicContext, normalizeSession } = require('../utils/academicSession');
const { resolveFeedbackConfig, isFeedbackOpen } = require('../utils/feedbackConfig');

const { getStudentTimetable } = require('../services/timetableData');
const { resolveStudentSection } = require('../utils/sectionResolver');
const { serializeAdmitCard } = require('../services/admitCard');

// Persist an uploaded image in MongoDB and return its public API path.
// The multer temp file is removed afterwards; the database is the durable copy.
const storeImageAsset = async (file) => {
  try {
    const data = await fs.readFile(file.path);
    const asset = await FileAsset.create({
      data,
      contentType: file.mimetype,
      fileName: file.originalname,
      size: file.size,
    });
    return `/api/files/${asset._id}`;
  } finally {
    await fs.unlink(file.path).catch(() => {});
  }
};

exports.getMyTimetable = async (req, res) => {
  try {
    const timetable = await getStudentTimetable(req.user._id, {
      session: req.academicSession,
      term: req.academicTerm,
      semester: req.academicSemester ?? req.query.semester,
      academicYear: req.query.academicYear,
    });
    if (!timetable) return res.status(404).json({ success: false, message: 'Student profile not found' });
    return res.json({ success: true, data: timetable });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


exports.getProfile = async (req, res) => {
  try {
    // Get student profile and populate user email for pre-fill
    const User = require('../models/User');
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);

    // Get user email to pre-fill if personalEmail not set
    const user = await User.findById(req.user._id).lean();
    const profileWithEmail = {
      ...student,
      userEmail: user?.email || '',
      // Provide fallback values for fields that might be missing in older documents
      section: student.section || 'N/A',
      session: academic.session,
      currentSemester: academic.semester,
      year: academic.year,
      term: academic.term,
    };

    res.json({ success: true, data: { student: profileWithEmail } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    // Editable by student: personal email, phone, address, gender, date of birth
    const allowed = ['personalEmail', 'phone', 'address', 'gender', 'dob'];
    const update = {};

    // Pick allowed fields from body
    allowed.forEach(k => {
      if (req.body[k] !== undefined) {
        // Handle date string conversion for dob
        if (k === 'dob' && req.body[k]) {
          update[k] = new Date(req.body[k]);
        } else {
          update[k] = req.body[k];
        }
      }
    });

    // Handle uploaded files (profilePhoto and signature)
    if (req.files) {
      if (req.files.profilePhoto && req.files.profilePhoto[0]) {
        update.profilePhotoUrl = await storeImageAsset(req.files.profilePhoto[0]);
      }
      if (req.files.signature && req.files.signature[0]) {
        update.signatureUrl = `/uploads/${req.files.signature[0].filename}`;
      }
    }

    // Prevent modification of admin-controlled fields even if provided
    const forbidden = ['enrollmentNo', 'year', 'admissionYear', 'fatherName', 'motherName', 'branch', 'currentSemester', 'section', 'session', 'firstName', 'lastName'];
    forbidden.forEach(f => { if (req.body[f] !== undefined) delete req.body[f]; });

    // Validate gender if provided
    if (update.gender && !['male', 'female', 'other'].includes(String(update.gender).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid gender value. Must be Male, Female, or Other.' });
    }

    // Validate email format if provided
    if (update.personalEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(update.personalEmail)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
      }

      // Check if email already in use
      const User = require('../models/User');
      const existing = await User.findOne({ email: update.personalEmail, _id: { $ne: req.user._id } });
      if (existing) return res.status(400).json({ success: false, message: 'Email already in use by another account' });
    }

    // Validate phone number if provided
    if (update.phone !== undefined && !isValidPhone(update.phone)) {
      return res.status(400).json({ success: false, message: PHONE_ERROR_MESSAGE });
    }

    // Validate DOB if provided
    if (update.dob) {
      const dobDate = new Date(update.dob);
      const age = (new Date() - dobDate) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 15 || age > 100) {
        return res.status(400).json({ success: false, message: 'Date of birth must represent a reasonable age (15-100 years)' });
      }
    }

    // Update Student document
    const student = await Student.findOneAndUpdate({ userId: req.user._id }, update, { new: true, runValidators: true });

    // If personalEmail provided, also sync with User document
    if (update.personalEmail) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.user._id, { email: update.personalEmail });
    }

    res.json({ success: true, data: { student } });
  } catch (err) {
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join('; ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const records = await Attendance.find({ 'records.studentId': student._id, session: academic.session, semester: academic.semester })
      .populate('subjectId', 'code name')
      .populate('labId', 'code name')
      .sort({ date: 1 })
      .lean();

    const grouped = {};
    for (const att of records) {
      const itemType = att.itemType === 'lab' || (!att.subjectId && att.labId) ? 'lab' : 'class';
      const item = itemType === 'lab' ? att.labId : att.subjectId;
      const itemId = item?._id?.toString();
      if (!itemId) continue;
      const batch = itemType === 'lab' ? (att.batch || '') : '';
      const key = `${itemType}:${itemId}`;
      if (!grouped[key]) {
        grouped[key] = {
          subject: item,
          itemType,
          batch,
          batches: [],
          total: 0,
          present: 0,
          dates: [],
        };
      }
      if (batch && !grouped[key].batches.includes(batch)) grouped[key].batches.push(batch);
      const record = att.records.find(r => r.studentId?.toString() === student._id.toString());
      if (record) {
        grouped[key].total++;
        if (record.status === 'present') grouped[key].present++;
        grouped[key].dates.push({ date: att.date, status: record.status, batch });
      }
    }

    // Older lab sheets were stored once per lab+date. Once a batch is assigned
    // the same date can exist in both the legacy sheet and the batch sheet,
    // so keep only the latest entry per date.
    const attendance = Object.values(grouped).map((entry) => {
      const byDate = new Map();
      entry.dates.forEach((d) => byDate.set(new Date(d.date).toISOString().slice(0, 10), d));
      const dates = Array.from(byDate.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
      const labelled = dates.filter(d => d.batch).map(d => d.batch);
      const batch = entry.batches.length === 1 ? entry.batches[0] : (labelled.length ? labelled[labelled.length - 1] : '');
      return {
        ...entry,
        batch,
        batches: entry.batches,
        dates: dates.map(({ date, status }) => ({ date, status })),
        total: dates.length,
        present: dates.filter(d => d.status === 'present').length,
      };
    });

    const buildSummary = (list) => {
      const total = list.reduce((sum, entry) => sum + entry.total, 0);
      const present = list.reduce((sum, entry) => sum + entry.present, 0);
      return {
        total,
        present,
        absent: total - present,
        percentage: total ? Math.round((present / total) * 100) : 0,
      };
    };

    const classSummary = buildSummary(attendance.filter(a => a.itemType !== 'lab'));
    const labSummary = buildSummary(attendance.filter(a => a.itemType === 'lab'));

    res.json({
      success: true,
      data: {
        attendance,
        summary: {
          class: classSummary,
          lab: labSummary,
          overall: buildSummary(attendance),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMySubjects = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const base = { session: academic.session, semester: academic.semester, term: academic.term };
    if (!academic.session) {
      return res.json({ success: true, data: { ...base, subjects: [], labs: [] } });
    }

    const filter = { session: academic.session, branch: student.branch, semester: academic.semester };
    const fields = 'code name type credits l t p theoryEndMax cwMax practicalEndMax swMax syllabusText syllabusFile semester branch session isCommon';
    const [subjects, labs] = await Promise.all([
      Subject.find(filter).select(fields).sort({ code: 1 }).lean(),
      Lab.find(filter).select(fields).sort({ code: 1 }).lean(),
    ]);

    // For Year 1 students (sem 1 or 2): also include isCommon subjects from any branch
    // These are the universally-shared first-year subjects
    if (academic.semester <= 2) {
      const existingSubjectCodes = new Set(subjects.map(s => s.code));
      const existingLabCodes = new Set(labs.map(l => l.code));
      const [commonSubs, commonLabs] = await Promise.all([
        Subject.find({ session: academic.session, semester: academic.semester, isCommon: true, code: { $nin: [...existingSubjectCodes] } })
          .select(fields).sort({ code: 1 }).lean(),
        Lab.find({ session: academic.session, semester: academic.semester, isCommon: true, code: { $nin: [...existingLabCodes] } })
          .select(fields).sort({ code: 1 }).lean(),
      ]);
      subjects.push(...commonSubs);
      labs.push(...commonLabs);
      subjects.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      labs.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    }

    const assignments = await FacultyTeachingAssignment.find({
      session: academic.session,
      $or: [
        { itemType: 'class', subjectId: { $in: subjects.map(s => s._id) } },
        { itemType: 'lab', labId: { $in: labs.map(l => l._id) } },
      ],
    }).populate('facultyId', 'firstName lastName department designation').lean();

    const facultyByItem = new Map();
    assignments.forEach(a => {
      const key = `${a.itemType === 'lab' ? 'lab' : 'class'}:${a.itemType === 'lab' ? a.labId : a.subjectId}`;
      if (!facultyByItem.has(key)) facultyByItem.set(key, []);
      const f = a.facultyId;
      if (f && f._id && !facultyByItem.get(key).some(x => String(x._id) === String(f._id))) {
        facultyByItem.get(key).push({
          _id: f._id,
          firstName: f.firstName,
          lastName: f.lastName,
          department: f.department,
          designation: f.designation,
        });
      }
    });

    // Find which batch this student belongs to for each lab
    const LabBatch = require('../models/LabBatch');
    const labIds = labs.map(l => l._id);
    const batchDocs = labIds.length
      ? await LabBatch.find({ labId: { $in: labIds }, session: academic.session }).lean()
      : [];

    const batchByLab = new Map();
    batchDocs.forEach(doc => {
      const batch = doc.batches.find(b =>
        b.studentIds.some(sid => String(sid) === String(student._id)),
      );
      if (batch) batchByLab.set(String(doc.labId), batch.batchName);
    });

    const attach = (items, itemType) => items.map(item => {
      const faculty = facultyByItem.get(`${itemType}:${item._id}`) || [];
      const extra = itemType === 'lab' ? { myBatch: batchByLab.get(String(item._id)) || null } : {};
      return {
        ...item,
        itemType,
        faculty,
        facultyNames: faculty.map(f => `${f.firstName || ''} ${f.lastName || ''}`.trim()).join(', '),
        ...extra,
      };
    });

    res.json({
      success: true,
      data: { ...base, subjects: attach(subjects, 'class'), labs: attach(labs, 'lab') },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getAssignments = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const assignments = await Assignment.find({ session: academic.session })
      .populate('subjectId', 'code name branch semester')
      .populate('labId', 'code name branch semester')
      .populate('facultyId', 'firstName lastName')
      .lean();

    const relevant = assignments
      .filter(a => {
        const item = a.itemType === 'lab' ? a.labId : a.subjectId;
        return item?.branch === student.branch && item?.semester === academic.semester;
      })
      .map(a => {
        const sub = a.submissions?.find(s => s.studentId?.toString() === student._id.toString());
        return { ...a, mySubmission: sub || null, submissions: undefined };
      });

    res.json({ success: true, data: { assignments: relevant } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitAssignment = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const assignment = await Assignment.findOne({ _id: req.params.id, session: academic.session })
      .populate('subjectId')
      .populate('labId');
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    // Verify student is enrolled in the subject's branch and semester
    const subject = assignment.itemType === 'lab' ? assignment.labId : assignment.subjectId;
    if (!subject || subject.branch !== student.branch || subject.semester !== academic.semester) {
      return res.status(403).json({ success: false, message: 'You are not authorized to submit assignments for this subject.' });
    }

    // Check if submissions are closed
    if (assignment.isClosed) {
      return res.status(400).json({ success: false, message: 'Submissions for this assignment have been closed.' });
    }

    const fileUrl = req.file ? `/uploads/${req.file.filename}` : req.body.fileUrl;
    if (!fileUrl) {
      return res.status(400).json({ success: false, message: 'Please upload a submission file.' });
    }

    // Check if the student has already submitted
    const existingIdx = assignment.submissions.findIndex(s => s.studentId?.toString() === student._id.toString());

    if (existingIdx >= 0) {
      const sub = assignment.submissions[existingIdx];
      if (sub.resubmissionRequested) {
        // Delete student's old file from disk if it exists
        if (sub.fileUrl) {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(__dirname, '..', sub.fileUrl);
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            console.error('Failed to delete old student submission file:', err);
          }
        }

        // Update the existing submission
        sub.fileUrl = fileUrl;
        sub.submittedAt = new Date();
        sub.resubmissionRequested = false;
        sub.marks = undefined;
        sub.feedback = undefined;
      } else {
        return res.status(400).json({ success: false, message: 'You have already submitted this assignment. Editing is not allowed.' });
      }
    } else {
      // Create new submission
      assignment.submissions.push({ studentId: student._id, fileUrl, submittedAt: new Date() });
    }

    await assignment.save();
    res.json({ success: true, message: 'Submitted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getNotices = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const noticeFilter = {
      audience: { $in: ['all', 'students'] },
      $and: [
        { session: academic.session },
        { $or: [{ term: academic.term }, { term: { $exists: false } }, { term: null }] },
      ],
      $or: [
        { targetStudentIds: { $exists: false } },
        { targetStudentIds: { $size: 0 } },
      ],
    };

    if (student?._id) {
      noticeFilter.$or.push({ targetStudentIds: student._id });
    }

    const notices = await Notice.find(noticeFilter)
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
    const student = await Student.findOne({ userId: req.user._id }).lean();
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory);
    const noticeFilter = {
      audience: { $in: ['all', 'students'] },
      $and: [
        { session: academic.session },
        { $or: [{ term: academic.term }, { term: { $exists: false } }, { term: null }] },
      ],
      $or: [
        { targetStudentIds: { $exists: false } },
        { targetStudentIds: { $size: 0 } },
      ],
    };

    if (student?._id) {
      noticeFilter.$or.push({ targetStudentIds: student._id });
    }

    if (Array.isArray(noticeIds) && noticeIds.length > 0) {
      noticeFilter._id = { $in: noticeIds };
    }

    await Notice.updateMany(noticeFilter, {
      $addToSet: { readBy: req.user._id },
    });

    res.json({ success: true, message: 'Notices marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getExamTimetable = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);

    const timetables = await ExamTimetable.find({
      session: academic.session,
      term: academic.term,
    })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      data: { timetables, session: academic.session, term: academic.term },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAdmitCard = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });

    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const card = await AdmitCard.findOne({
      studentId: student._id,
      session: academic.session,
      term: academic.term,
      examType: 'end-sem',
    }).lean();

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Admit card has not been issued yet. Please contact the examination office.',
      });
    }

    res.json({ success: true, data: { admitCard: serializeAdmitCard(card) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getResult = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const requestedSemester = Number(req.query.semester);
    const query = { studentId: student._id, isPublished: true, session: academic.session };
    query.semester = Number.isInteger(requestedSemester) && requestedSemester > 0
      ? requestedSemester
      : academic.semester;

    const results = await Result.find(query)
      .populate('studentId', 'firstName lastName enrollmentNo branch')
      .populate('subjectMarks.subjectId', 'code name credits')
      .populate('subjectMarks.labId', 'code name credits')
      .sort({ semester: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInternalMarks = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const requestedSemester = Number(req.query.semester);
    const filter = {
      studentId: student._id,
      session: req.query.session || academic.session,
      semester: Number.isInteger(requestedSemester) && requestedSemester > 0
        ? requestedSemester
        : academic.semester,
    };
    const results = await Result.find(filter)
      .populate('subjectMarks.subjectId', 'code name credits')
      .populate('subjectMarks.labId', 'code name credits')
      .sort({ semester: -1, updatedAt: -1 })
      .lean();
    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitRevaluation = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });

    // Look up the subject by its CODE (students enter code, not ObjectId). Codes are
    // only unique per session+branch+semester, so scope the lookup when possible.
    const code = String(req.body.subjectId || '').toUpperCase().trim();
    const scopedFilter = {
      code,
      branch: student.branch,
      semester: Number(req.body.semester),
    };
    const session = normalizeSession(req.body.session);
    if (session) scopedFilter.session = session;
    const subject = await Subject.findOne(scopedFilter) || await Subject.findOne({ code });
    if (!subject) return res.status(404).json({ success: false, message: 'Subject code not found' });

    // Check if the student actually has a result for this subject
    const result = await Result.findOne({
      studentId: student._id,
      semester: Number(req.body.semester),
      session: req.body.session,
      "subjectMarks.subjectId": subject._id
    });

    if (!result) {
      return res.status(400).json({
        success: false,
        message: `You are not enrolled in ${subject.code} for Sem ${req.body.semester}. No marks found.`
      });
    }

    const reval = await RevaluationRequest.create({
      studentId: student._id,
      ...req.body,
      subjectId: subject._id // use the actual ObjectId
    });
    res.status(201).json({ success: true, data: { reval } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRevaluationRequests = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const requests = await RevaluationRequest.find({ studentId: student._id })
      .populate('subjectId', 'code name')
      .sort({ requestedAt: -1 })
      .lean();

    res.json({ success: true, data: { requests } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFees = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const fees = await Fee.find({ studentId: student._id, session: academic.session }).lean();
    res.json({ success: true, data: { fees } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.payFee = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const fee = await Fee.findOne({ _id: req.params.id, studentId: student._id });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });
    if (fee.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

    fee.status = 'paid';
    fee.paidOn = new Date();
    fee.transactionId = `TXN-${uuidv4().slice(0, 8).toUpperCase()}`;
    fee.receiptNo = `RCP-${Date.now()}`;
    await fee.save();
    res.json({ success: true, data: { fee } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLibrary = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const issues = await LibraryIssue.find({ studentId: student._id })
      .populate('bookId')
      .lean();
    res.json({ success: true, data: { issues } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getClassSchedule = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const year = Math.ceil(Number(academic.semester) / 2);
    const { sectionDoc: section } = await resolveStudentSection({
      section: student.section,
      branch: student.branch,
      currentSemester: academic.semester,
      year,
    });
    const entries = section
      ? await TimetableEntry.find({ section: section._id, academicYear: academic.session, semester: academic.semester })
        .populate('subject', 'code name')
        .populate('faculty', 'firstName lastName email')
        .populate('room', 'name code')
        .lean()
      : [];
    res.json({ success: true, data: { schedule: entries } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitFeedback = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });
    const { subjectId, facultyId, ratings, comments } = req.body;
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const config = await resolveFeedbackConfig(academic.session, academic.term);
    if (!isFeedbackOpen(config)) return res.status(403).json({ success: false, message: 'Feedback is currently closed' });
    const subject = await Subject.findOne({ _id: subjectId, branch: student.branch, semester: academic.semester, session: academic.session }).lean();
    if (!subject || !facultyId) return res.status(400).json({ success: false, message: 'Select a valid subject and faculty' });
    const year = Math.ceil(Number(academic.semester) / 2);
    const { sectionDoc: section } = await resolveStudentSection({
      section: student.section,
      branch: student.branch,
      currentSemester: academic.semester,
      year,
    });
    const entries = section
      ? await TimetableEntry.find({ section: section._id, academicYear: academic.session, semester: academic.semester, subjectType: 'Subject', subject: subjectId })
        .populate('faculty', 'email')
        .lean()
      : [];
    const facultyUserIds = entries.map(entry => entry.faculty?._id).filter(Boolean);
    const facultyDocs = facultyUserIds.length
      ? await Faculty.find({ userId: { $in: facultyUserIds } }).select('_id').lean()
      : [];
    const pairIsValid = facultyDocs.some(item => String(item._id) === String(facultyId))
      || String(subject.facultyId || '') === String(facultyId);
    if (!pairIsValid) return res.status(400).json({ success: false, message: 'This faculty is not assigned to the selected subject for your class' });
    const session = academic.session;
    if (!session) return res.status(400).json({ success: false, message: 'Your academic session is not set' });
    const ratingKeys = ['knowledge', 'clarity', 'punctuality', 'interaction', 'doubtSolving', 'fairness'];
    if (!ratings || ratingKeys.some(key => !Number.isInteger(Number(ratings[key])) || Number(ratings[key]) < 1 || Number(ratings[key]) > 5)) {
      return res.status(400).json({ success: false, message: 'All ratings must be whole numbers from 1 to 5' });
    }
    const commentText = String(comments || '').trim();
    if (config?.requireCommentForLowRating && ratingKeys.some(key => Number(ratings[key]) <= 2) && commentText.length < 10) {
      return res.status(400).json({ success: false, message: 'Please add a constructive comment for ratings of 1 or 2' });
    }
    const existing = await Feedback.findOne({ studentId: student._id, subjectId, facultyId, session, term: academic.term });
    if (existing) return res.status(409).json({ success: false, message: 'You have already submitted feedback for this subject' });
    const feedback = await Feedback.create({
      studentId: student._id,
      subjectId: subject._id,
      facultyId,
      session,
      term: academic.term,
      semester: academic.semester,
      ratings,
      comments: commentText,
    });
    res.status(201).json({ success: true, data: { feedback } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'You have already submitted feedback for this subject' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateFeedback = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });
    const feedback = await Feedback.findOne({ _id: req.params.id, studentId: student._id });
    if (!feedback) return res.status(404).json({ success: false, message: 'Feedback not found' });
    if (feedback.status !== 'submitted') return res.status(403).json({ success: false, message: 'This feedback can no longer be edited' });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const config = await resolveFeedbackConfig(academic.session, academic.term);
    if (!isFeedbackOpen(config)) return res.status(403).json({ success: false, message: 'Feedback is currently closed' });
    const ratings = req.body.ratings;
    const ratingKeys = ['knowledge', 'clarity', 'punctuality', 'interaction', 'doubtSolving', 'fairness'];
    if (!ratings || ratingKeys.some(key => !Number.isInteger(Number(ratings[key])) || Number(ratings[key]) < 1 || Number(ratings[key]) > 5)) {
      return res.status(400).json({ success: false, message: 'All ratings must be whole numbers from 1 to 5' });
    }
    const comments = String(req.body.comments || '').trim();
    if (config?.requireCommentForLowRating && ratingKeys.some(key => Number(ratings[key]) <= 2) && comments.length < 10) {
      return res.status(400).json({ success: false, message: 'Please add a constructive comment for ratings of 1 or 2' });
    }
    feedback.ratings = ratings;
    feedback.comments = comments;
    await feedback.save();
    res.json({ success: true, data: { feedback } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFeedbackOptions = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const year = Math.ceil(Number(academic.semester) / 2);
    const { sectionDoc: section } = await resolveStudentSection({
      section: student.section,
      branch: student.branch,
      currentSemester: academic.semester,
      year,
    });
    const [subjects, entries, submitted] = await Promise.all([
      Subject.find({ branch: student.branch, semester: academic.semester, session: academic.session })
        .select('code name branch semester facultyId')
        .populate('facultyId', 'firstName lastName')
        .sort({ code: 1 })
        .lean(),
      section
        ? TimetableEntry.find({ section: section._id, academicYear: academic.session, semester: academic.semester, subjectType: 'Subject' })
          .populate('subject', 'code name')
          .populate('faculty', 'email')
          .lean()
        : [],
      Feedback.find({ studentId: student._id, session: academic.session, term: academic.term })
        .select('subjectId facultyId')
        .lean(),
    ]);
    const subjectById = new Map(subjects.map(subject => [String(subject._id), subject]));
    const facultyUserIds = [...new Set(entries.map(entry => String(entry.faculty?._id || '')).filter(Boolean))];
    const facultyDocs = facultyUserIds.length
      ? await Faculty.find({ userId: { $in: facultyUserIds } }).select('firstName lastName userId').lean()
      : [];
    const facultyByUserId = new Map(facultyDocs.map(item => [String(item.userId), item]));
    const pairs = new Map();
    entries.forEach(entry => {
      const subject = subjectById.get(String(entry.subject?._id));
      const faculty = entry.faculty ? facultyByUserId.get(String(entry.faculty._id)) : null;
      if (subject && faculty) {
        pairs.set(`${subject._id}:${faculty._id}`, { subject, facultyId: String(faculty._id), faculty });
      }
    });
    subjects.forEach(subject => {
      if (subject.facultyId?._id) {
        pairs.set(`${subject._id}:${subject.facultyId._id}`, { subject, facultyId: String(subject.facultyId._id), faculty: subject.facultyId });
      }
    });
    const submittedIds = new Set(submitted.map(item => `${item.subjectId}:${item.facultyId}`));
    const config = await resolveFeedbackConfig(academic.session, academic.term);
    const feedbackOpen = isFeedbackOpen(config);
    res.json({
      success: true,
      data: {
        feedbackOpen,
        feedbackConfig: config || { isOpen: false, requireCommentForLowRating: true },
        student: { session: academic.session, semester: academic.semester, branch: student.branch, section: student.section },
        subjects: [...pairs.values()].map(item => ({
          ...item.subject,
          facultyId: item.faculty,
          selectedFacultyId: item.facultyId,
          alreadySubmitted: submittedIds.has(`${item.subject._id}:${item.facultyId}`),
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyFeedback = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    const academic = getAcademicContext(student, req.academicSession, req.academicHistory, req.academicTerm);
    const feedback = await Feedback.find({ studentId: student._id, session: academic.session, term: academic.term })
      .populate('subjectId', 'code name')
      .populate('facultyId', 'firstName lastName')
      .lean();
    res.json({ success: true, data: { feedback } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFeeReceipt = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).lean();
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });

    const fee = await Fee.findOne({ _id: req.params.id, studentId: student._id }).lean();
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });
    if (fee.status !== 'paid') return res.status(400).json({ success: false, message: 'Fee not paid yet' });

    const receipt = {
      receiptNo: fee.receiptNo,
      transactionId: fee.transactionId,
      student: {
        name: `${student.firstName} ${student.lastName}`,
        enrollmentNo: student.enrollmentNo,
        branch: student.branch,
        semester: fee.semester,
        session: fee.session,
      },
      amount: fee.amount,
      paidOn: fee.paidOn,
      collegeName: 'College ERP Institution',
    };

    res.json({ success: true, data: { receipt } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
