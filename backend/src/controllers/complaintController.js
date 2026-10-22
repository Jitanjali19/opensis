const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const TimetableEntry = require('../models/TimetableEntry');
const { determineHandler } = require('../services/complaintAssignmentService');
const { resolveStudentSection } = require('../utils/sectionResolver');

const VALID_CATEGORIES = ['faculty', 'student', 'subject', 'college', 'website', 'other', 'class_discipline', 'administration'];
const VALID_STATUSES = ['pending', 'in_review', 'resolved', 'rejected'];

/**
 * Remove any trace of submitter identity from output object
 */
const sanitizeComplaint = (doc) => {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete obj.student;
  delete obj.submitter;
  delete obj.__v;
  return obj;
};

/**
 * SUBMIT: Submit a new complaint (Students & Faculty)
 * POST /api/complaints
 */
exports.createComplaint = async (req, res) => {
  try {
    const {
      category,
      faculty,
      targetStudent,
      targetSubject,
      subject,
      description,
    } = req.body;

    const submitterRole = req.user.role;
    if (!['student', 'faculty'].includes(submitterRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only students and faculty members can submit complaints',
      });
    }

    // 1. Validate Category
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    // 2. Validate Subject (Title)
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required',
      });
    }
    const trimmedSubject = subject.trim();
    if (trimmedSubject.length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Subject cannot exceed 120 characters',
      });
    }

    // 3. Validate Description
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Description is required',
      });
    }
    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Description cannot exceed 2000 characters',
      });
    }

    // 4. Rate Limiting / Spam Control: Max 5 complaints per day per user
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const countToday = await Complaint.countDocuments({
      student: req.user._id,
      createdAt: { $gte: startOfToday },
    });

    if (countToday >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Daily complaint limit reached. You can submit up to 5 complaints per day.',
      });
    }

    // 5. Category-Specific Target Validations
    let targetFacultyId = null;
    let targetStudentId = null;
    let targetSubjectId = null;

    if (category === 'faculty') {
      if (!faculty) {
        return res.status(400).json({
          success: false,
          message: 'Faculty member must be specified for faculty complaints',
        });
      }

      if (!mongoose.Types.ObjectId.isValid(faculty)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid faculty ID provided',
        });
      }

      const facultyUser = await User.findOne({
        _id: faculty,
        role: 'faculty',
        isActive: true,
      }).lean();

      if (!facultyUser) {
        return res.status(400).json({
          success: false,
          message: 'Selected faculty does not exist or is inactive',
        });
      }

      if (submitterRole === 'faculty' && facultyUser._id.toString() === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'You cannot file a complaint against yourself',
        });
      }

      // Department check for student submitting against faculty
      if (submitterRole === 'student') {
        const studentProfile = await Student.findOne({ userId: req.user._id }).lean();
        const facultyProfile = await Faculty.findOne({ userId: faculty }).lean();

        if (!studentProfile) {
          return res.status(404).json({ success: false, message: 'Student profile not found' });
        }
        if (!facultyProfile) {
          return res.status(400).json({ success: false, message: 'Faculty profile details not found' });
        }

        const studentDept = (studentProfile.branch || '').trim().toLowerCase();
        const facultyDept = (facultyProfile.department || '').trim().toLowerCase();

        if (studentDept !== facultyDept) {
          return res.status(400).json({
            success: false,
            message: 'Selected faculty does not belong to your department',
          });
        }
      }

      targetFacultyId = faculty;
    } else if (category === 'student') {
      if (targetStudent) {
        if (!mongoose.Types.ObjectId.isValid(targetStudent)) {
          return res.status(400).json({ success: false, message: 'Invalid target student ID provided' });
        }
        const studentUser = await User.findOne({ _id: targetStudent, role: 'student', isActive: true }).lean();
        if (!studentUser) {
          return res.status(400).json({ success: false, message: 'Selected target student does not exist or is inactive' });
        }
        if (studentUser._id.toString() === req.user._id.toString()) {
          return res.status(400).json({ success: false, message: 'You cannot file a complaint against yourself' });
        }
        targetStudentId = targetStudent;
      }
    } else if (category === 'subject') {
      if (submitterRole === 'student' && !targetSubject) {
        return res.status(400).json({
          success: false,
          message: 'Academic subject is required for subject complaints',
        });
      }
    }

    // Validate targetSubject for subject, class_discipline, or student complaints
    if (targetSubject) {
      if (!mongoose.Types.ObjectId.isValid(targetSubject)) {
        return res.status(400).json({ success: false, message: 'Invalid subject ID provided' });
      }
      const subjectDoc = await Subject.findById(targetSubject).lean();
      if (!subjectDoc) {
        return res.status(400).json({ success: false, message: 'Selected subject does not exist' });
      }

      if (submitterRole === 'student') {
        const studentProfile = await Student.findOne({ userId: req.user._id }).lean();
        if (studentProfile) {
          const studentBranch = (studentProfile.branch || '').trim().toUpperCase();
          const subjectBranch = (subjectDoc.branch || '').trim().toUpperCase();
          const isCommonYear1 = subjectDoc.isCommon && Number(studentProfile.currentSemester) <= 2;

          let subjectMatchesStudent = (studentBranch === subjectBranch && Number(studentProfile.currentSemester) === Number(subjectDoc.semester)) || isCommonYear1;

          if (!subjectMatchesStudent) {
            const { sectionId } = await resolveStudentSection(studentProfile);
            if (sectionId) {
              const entry = await TimetableEntry.findOne({
                section: sectionId,
                subject: subjectDoc._id,
              }).lean();
              if (entry) subjectMatchesStudent = true;
            }
          }

          if (!subjectMatchesStudent) {
            return res.status(400).json({
              success: false,
              message: 'Selected subject does not belong to your branch, semester, or academic session',
            });
          }
          if (studentProfile.session && subjectDoc.session && studentProfile.session.trim() !== subjectDoc.session.trim()) {
            return res.status(400).json({
              success: false,
              message: 'Selected subject does not belong to your branch, semester, or academic session',
            });
          }
        }
      }
      targetSubjectId = targetSubject;
    }

    // 6. Centralized Handler Routing
    const handler = await determineHandler({
      submitterRole,
      submitterId: req.user._id,
      category,
      targetFacultyId,
      targetStudentId,
      targetSubjectId,
    });

    // 7. Save Complaint with explainable assignment reason
    const complaint = await Complaint.create({
      category,
      faculty: targetFacultyId,
      targetStudent: targetStudentId,
      targetSubject: targetSubjectId,
      subject: trimmedSubject,
      description: trimmedDescription,
      submitterRole,
      assignedTo: handler.assignedTo,
      assignedRole: handler.assignedRole,
      assignmentReason: handler.assignmentReason,
      student: req.user._id,
    });

    const result = sanitizeComplaint(await Complaint.findById(complaint._id).select('-student').lean());

    return res.status(201).json({
      success: true,
      message: 'Your complaint has been submitted. Your identity is not shared with the administrator.',
      data: { complaint: result },
    });
  } catch (error) {
    console.error('Error creating complaint:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * MY COMPLAINTS: View complaints submitted by the authenticated user
 * GET /api/complaints/mine
 */
exports.getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ student: req.user._id })
      .select('-student')
      .sort({ createdAt: -1 })
      .lean();

    const facultyUserIds = complaints.map(c => c.faculty).filter(Boolean);
    const assignedUserIds = complaints.map(c => c.assignedTo).filter(Boolean);
    const targetStudentUserIds = complaints.map(c => c.targetStudent).filter(Boolean);
    const targetSubjectIds = complaints.map(c => c.targetSubject).filter(Boolean);

    const allFacultyUserIds = [...new Set([...facultyUserIds, ...assignedUserIds])];

    const [facultyProfiles, studentProfiles, subjectDocs] = await Promise.all([
      allFacultyUserIds.length
        ? Faculty.find({ userId: { $in: allFacultyUserIds } }).select('userId firstName lastName department employeeId').lean()
        : [],
      targetStudentUserIds.length
        ? Student.find({ userId: { $in: targetStudentUserIds } }).select('userId firstName lastName enrollmentNo branch section').lean()
        : [],
      targetSubjectIds.length
        ? Subject.find({ _id: { $in: targetSubjectIds } }).select('code name branch semester').lean()
        : [],
    ]);

    const facultyMap = new Map(facultyProfiles.map(p => [p.userId.toString(), p]));
    const studentMap = new Map(studentProfiles.map(p => [p.userId.toString(), p]));
    const subjectMap = new Map(subjectDocs.map(s => [s._id.toString(), s]));

    const formatted = complaints.map(c => {
      const sanitized = sanitizeComplaint(c);
      const facProfile = sanitized.faculty ? facultyMap.get(sanitized.faculty.toString()) : null;
      const stuProfile = sanitized.targetStudent ? studentMap.get(sanitized.targetStudent.toString()) : null;
      const subDoc = sanitized.targetSubject ? subjectMap.get(sanitized.targetSubject.toString()) : null;
      const assignedFac = sanitized.assignedTo ? facultyMap.get(sanitized.assignedTo.toString()) : null;

      return {
        ...sanitized,
        faculty: facProfile ? {
          _id: sanitized.faculty,
          name: `${facProfile.firstName} ${facProfile.lastName}`.trim(),
          department: facProfile.department || '',
        } : (sanitized.faculty ? { _id: sanitized.faculty, name: 'Faculty Member', department: '' } : null),
        targetStudent: stuProfile ? {
          _id: sanitized.targetStudent,
          name: `${stuProfile.firstName} ${stuProfile.lastName}`.trim(),
          enrollmentNo: stuProfile.enrollmentNo || '',
          branch: stuProfile.branch || '',
        } : null,
        targetSubject: subDoc ? {
          _id: sanitized.targetSubject,
          code: subDoc.code,
          name: subDoc.name,
        } : null,
        assignedHandler: assignedFac ? {
          name: `${assignedFac.firstName} ${assignedFac.lastName}`.trim(),
          department: assignedFac.department || '',
        } : (sanitized.assignedRole === 'admin' ? { name: 'Institutional Administration' } : null),
        assignmentReason: sanitized.assignmentReason || '',
      };
    });

    return res.json({
      success: true,
      data: { complaints: formatted },
    });
  } catch (error) {
    console.error('Error fetching my complaints:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * ASSIGNED COMPLAINTS: View complaints assigned to the authenticated faculty member
 * GET /api/complaints/assigned
 */
exports.getAssignedComplaints = async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Only complaints assigned to this faculty member. Never complaints against faculty members.
    const complaints = await Complaint.find({
      assignedTo: req.user._id,
      category: { $ne: 'faculty' },
    })
      .select('-student')
      .sort({ createdAt: -1 })
      .lean();

    const targetStudentUserIds = complaints.map(c => c.targetStudent).filter(Boolean);
    const targetSubjectIds = complaints.map(c => c.targetSubject).filter(Boolean);

    const [studentProfiles, subjectDocs] = await Promise.all([
      targetStudentUserIds.length
        ? Student.find({ userId: { $in: targetStudentUserIds } }).select('userId firstName lastName enrollmentNo branch section').lean()
        : [],
      targetSubjectIds.length
        ? Subject.find({ _id: { $in: targetSubjectIds } }).select('code name branch semester').lean()
        : [],
    ]);

    const studentMap = new Map(studentProfiles.map(p => [p.userId.toString(), p]));
    const subjectMap = new Map(subjectDocs.map(s => [s._id.toString(), s]));

    const formatted = complaints.map(c => {
      const sanitized = sanitizeComplaint(c);
      const stuProfile = sanitized.targetStudent ? studentMap.get(sanitized.targetStudent.toString()) : null;
      const subDoc = sanitized.targetSubject ? subjectMap.get(sanitized.targetSubject.toString()) : null;

      return {
        ...sanitized,
        targetStudent: stuProfile ? {
          _id: sanitized.targetStudent,
          name: `${stuProfile.firstName} ${stuProfile.lastName}`.trim(),
          enrollmentNo: stuProfile.enrollmentNo || '',
          branch: stuProfile.branch || '',
        } : null,
        targetSubject: subDoc ? {
          _id: sanitized.targetSubject,
          code: subDoc.code,
          name: subDoc.name,
        } : null,
        assignmentReason: sanitized.assignmentReason || '',
      };
    });

    return res.json({
      success: true,
      data: { complaints: formatted },
    });
  } catch (error) {
    console.error('Error fetching assigned complaints:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * UPDATE ASSIGNED COMPLAINT: Faculty handler updates status & response
 * PATCH /api/complaints/assigned/:id
 */
exports.updateAssignedComplaint = async (req, res) => {
  try {
    if (req.user.role !== 'faculty') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID' });
    }

    const { status, adminResponse } = req.body;

    const complaint = await Complaint.findOne({
      _id: req.params.id,
      assignedTo: req.user._id,
      category: { $ne: 'faculty' },
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Assigned complaint not found or you are not authorized to handle it',
      });
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }
      complaint.status = status;
    }

    if (adminResponse !== undefined) {
      complaint.adminResponse = String(adminResponse).trim();
      complaint.respondedAt = new Date();
      complaint.respondedBy = req.user._id;
    }

    await complaint.save();

    const sanitized = sanitizeComplaint(complaint.toObject());

    return res.json({
      success: true,
      message: 'Resolution update saved successfully',
      data: { complaint: sanitized },
    });
  } catch (error) {
    console.error('Error updating assigned complaint:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * FACULTY OPTIONS: List active faculty members for dropdown
 * GET /api/complaints/faculty-options
 */
exports.getFacultyOptions = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user._id }).lean();
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found' });
      }
      filter.department = new RegExp(`^${student.branch}$`, 'i');
    }

    const facultyProfiles = await Faculty.find(filter)
      .select('userId firstName lastName department employeeId')
      .lean();

    const userIds = facultyProfiles.map(f => f.userId).filter(Boolean);
    const activeUsers = await User.find({
      _id: { $in: userIds },
      role: 'faculty',
      isActive: true,
    }).select('_id').lean();

    const activeUserSet = new Set(activeUsers.map(u => u._id.toString()));

    const facultyList = facultyProfiles
      .filter(f => f.userId && activeUserSet.has(f.userId.toString()) && f.userId.toString() !== req.user._id.toString())
      .map(f => ({
        id: f.userId.toString(),
        name: `${f.firstName} ${f.lastName}`.trim(),
        department: f.department,
        employeeId: f.employeeId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      success: true,
      data: { faculty: facultyList },
    });
  } catch (error) {
    console.error('Error fetching faculty options:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * STUDENT OPTIONS: List peers/students for reporting student discipline
 * GET /api/complaints/student-options
 */
exports.getStudentOptions = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'student') {
      const student = await Student.findOne({ userId: req.user._id }).lean();
      if (student?.branch) {
        filter.branch = student.branch;
        if (student.currentSemester) filter.currentSemester = student.currentSemester;
      }
    }

    const studentDocs = await Student.find(filter)
      .select('userId firstName lastName enrollmentNo branch section')
      .limit(100)
      .lean();

    const userIds = studentDocs.map(s => s.userId).filter(Boolean);
    const activeUsers = await User.find({
      _id: { $in: userIds },
      role: 'student',
      isActive: true,
    }).select('_id').lean();

    const activeUserSet = new Set(activeUsers.map(u => u._id.toString()));

    const studentList = studentDocs
      .filter(s => s.userId && activeUserSet.has(s.userId.toString()) && s.userId.toString() !== req.user._id.toString())
      .map(s => ({
        id: s.userId.toString(),
        name: `${s.firstName} ${s.lastName}`.trim(),
        enrollmentNo: s.enrollmentNo,
        branch: s.branch,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      success: true,
      data: { students: studentList },
    });
  } catch (error) {
    console.error('Error fetching student options:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * GET SUBJECT OPTIONS: Academic subjects mapped to authenticated user
 * GET /api/complaints/subject-options
 */
exports.getSubjectOptions = async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const studentProfile = await Student.findOne({ userId: req.user._id }).lean();
      if (!studentProfile) {
        return res.status(404).json({ success: false, message: 'Student profile not found' });
      }

      const branch = (studentProfile.branch || '').trim();
      const semester = Number(studentProfile.currentSemester);
      const session = studentProfile.session;

      const filter = {
        semester,
      };

      if (semester <= 2) {
        filter.$or = [
          { branch: new RegExp(`^${branch}$`, 'i') },
          { isCommon: true },
        ];
      } else {
        filter.branch = new RegExp(`^${branch}$`, 'i');
      }

      if (session) {
        const sessionFilter = [
          { session },
          { session: '' },
          { session: null },
          { session: { $exists: false } },
        ];
        if (filter.$or) {
          filter.$and = [
            { $or: filter.$or },
            { $or: sessionFilter },
          ];
          delete filter.$or;
        } else {
          filter.$or = sessionFilter;
        }
      }

      let subjects = await Subject.find(filter)
        .select('_id code name type branch semester session')
        .sort({ code: 1 })
        .lean();

      // Check timetable entries for this student's resolved section
      const { sectionId } = await resolveStudentSection(studentProfile);
      if (sectionId) {
        const timetableEntries = await TimetableEntry.find({
          section: sectionId,
          semester,
        }).select('subject').lean();

        const timetableSubjectIds = timetableEntries
          .map(e => e.subject)
          .filter(Boolean);

        if (timetableSubjectIds.length > 0) {
          const additionalSubjects = await Subject.find({
            _id: { $in: timetableSubjectIds },
          }).select('_id code name type branch semester session').lean();

          const existingIds = new Set(subjects.map(s => s._id.toString()));
          for (const s of additionalSubjects) {
            if (!existingIds.has(s._id.toString())) {
              subjects.push(s);
              existingIds.add(s._id.toString());
            }
          }
        }
      }

      const subjectList = subjects.map(s => ({
        id: s._id.toString(),
        code: s.code,
        name: s.name,
        type: s.type || 'theory',
      }));

      return res.json({
        success: true,
        data: { subjects: subjectList },
      });
    }

    if (req.user.role === 'faculty') {
      const facultyProfile = await Faculty.findOne({ userId: req.user._id }).lean();
      const department = facultyProfile?.department || '';

      const filter = {};
      if (department) {
        filter.branch = new RegExp(`^${department}$`, 'i');
      }

      const subjects = await Subject.find(filter)
        .select('_id code name type branch semester session')
        .sort({ code: 1 })
        .limit(100)
        .lean();

      const subjectList = subjects.map(s => ({
        id: s._id.toString(),
        code: s.code,
        name: s.name,
        type: s.type || 'theory',
      }));

      return res.json({
        success: true,
        data: { subjects: subjectList },
      });
    }

    return res.status(403).json({ success: false, message: 'Forbidden' });
  } catch (error) {
    console.error('Error fetching subject options:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * ADMIN: Get faculty handlers available for complaint assignment
 * GET /api/admin/complaints/faculty-handlers
 */
exports.getFacultyHandlers = async (req, res) => {
  try {
    const activeFacultyUsers = await User.find({ role: 'faculty', isActive: true }).select('_id email').lean();
    const userIds = activeFacultyUsers.map(u => u._id);

    const facultyProfiles = await Faculty.find({ userId: { $in: userIds } })
      .select('userId firstName lastName department employeeId')
      .lean();

    const profileMap = new Map(facultyProfiles.map(p => [p.userId.toString(), p]));

    const handlers = activeFacultyUsers.map(u => {
      const profile = profileMap.get(u._id.toString());
      return {
        id: u._id.toString(),
        name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : u.email,
        department: profile?.department || '',
        employeeId: profile?.employeeId || '',
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      success: true,
      data: { handlers },
    });
  } catch (error) {
    console.error('Error fetching faculty handlers:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * ADMIN: Get complaints list with filters and pagination
 * GET /api/admin/complaints
 */
exports.getAdminComplaints = async (req, res) => {
  try {
    const {
      category,
      status,
      faculty,
      assignedTo,
      from,
      to,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    if (category && VALID_CATEGORIES.includes(category)) {
      query.category = category;
    }

    if (status && VALID_STATUSES.includes(status)) {
      query.status = status;
    }

    if (faculty && mongoose.Types.ObjectId.isValid(faculty)) {
      query.faculty = faculty;
    }

    if (assignedTo) {
      if (assignedTo === 'admin' || assignedTo === 'unassigned') {
        query.assignedRole = 'admin';
      } else if (mongoose.Types.ObjectId.isValid(assignedTo)) {
        query.assignedTo = assignedTo;
      }
    }

    const dateStart = from || startDate;
    const dateEnd = to || endDate;
    if (dateStart || dateEnd) {
      query.createdAt = {};
      if (dateStart) query.createdAt.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim();
      query.$or = [
        { subject: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, rawComplaints] = await Promise.all([
      Complaint.countDocuments(query),
      Complaint.find(query)
        .select('-student')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const targetFacultyIds = rawComplaints.map(c => c.faculty).filter(Boolean);
    const assignedUserIds = rawComplaints.map(c => c.assignedTo).filter(Boolean);
    const targetStudentUserIds = rawComplaints.map(c => c.targetStudent).filter(Boolean);
    const targetSubjectIds = rawComplaints.map(c => c.targetSubject).filter(Boolean);
    const allFacultyUserIds = [...new Set([...targetFacultyIds, ...assignedUserIds])];

    const [facultyProfiles, studentProfiles, subjectDocs] = await Promise.all([
      allFacultyUserIds.length
        ? Faculty.find({ userId: { $in: allFacultyUserIds } }).select('userId firstName lastName department employeeId').lean()
        : [],
      targetStudentUserIds.length
        ? Student.find({ userId: { $in: targetStudentUserIds } }).select('userId firstName lastName enrollmentNo branch').lean()
        : [],
      targetSubjectIds.length
        ? Subject.find({ _id: { $in: targetSubjectIds } }).select('code name branch semester').lean()
        : [],
    ]);

    const facultyMap = new Map(facultyProfiles.map(p => [p.userId.toString(), p]));
    const studentMap = new Map(studentProfiles.map(p => [p.userId.toString(), p]));
    const subjectMap = new Map(subjectDocs.map(s => [s._id.toString(), s]));

    const formatted = rawComplaints.map(c => {
      const sanitized = sanitizeComplaint(c);
      const facProfile = sanitized.faculty ? facultyMap.get(sanitized.faculty.toString()) : null;
      const assignedFac = sanitized.assignedTo ? facultyMap.get(sanitized.assignedTo.toString()) : null;
      const stuProfile = sanitized.targetStudent ? studentMap.get(sanitized.targetStudent.toString()) : null;
      const subDoc = sanitized.targetSubject ? subjectMap.get(sanitized.targetSubject.toString()) : null;

      return {
        ...sanitized,
        faculty: facProfile ? {
          _id: sanitized.faculty,
          name: `${facProfile.firstName} ${facProfile.lastName}`.trim(),
          department: facProfile.department || '',
          employeeId: facProfile.employeeId || '',
        } : (sanitized.faculty ? { _id: sanitized.faculty, name: 'Faculty Member', department: '' } : null),
        targetStudent: stuProfile ? {
          _id: sanitized.targetStudent,
          name: `${stuProfile.firstName} ${stuProfile.lastName}`.trim(),
          enrollmentNo: stuProfile.enrollmentNo || '',
          branch: stuProfile.branch || '',
        } : null,
        targetSubject: subDoc ? {
          _id: sanitized.targetSubject,
          code: subDoc.code,
          name: subDoc.name,
        } : null,
        assignedHandler: assignedFac ? {
          id: sanitized.assignedTo,
          name: `${assignedFac.firstName} ${assignedFac.lastName}`.trim(),
          department: assignedFac.department || '',
        } : { id: null, name: 'Institutional Administration (Admin Queue)' },
        assignmentReason: sanitized.assignmentReason || '',
      };
    });

    return res.json({
      success: true,
      data: {
        complaints: formatted,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching admin complaints:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * ADMIN: Get complaint details by ID
 * GET /api/admin/complaints/:id
 */
exports.getAdminComplaintById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID' });
    }

    const complaint = await Complaint.findById(req.params.id).select('-student').lean();
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const sanitized = sanitizeComplaint(complaint);
    let facultyData = null;
    let assignedData = null;
    let studentData = null;

    if (sanitized.faculty) {
      const profile = await Faculty.findOne({ userId: sanitized.faculty }).select('userId firstName lastName department employeeId').lean();
      facultyData = profile ? {
        _id: sanitized.faculty,
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        department: profile.department || '',
        employeeId: profile.employeeId || '',
      } : { _id: sanitized.faculty, name: 'Faculty Member', department: '' };
    }

    if (sanitized.assignedTo) {
      const profile = await Faculty.findOne({ userId: sanitized.assignedTo }).select('userId firstName lastName department employeeId').lean();
      assignedData = profile ? {
        id: sanitized.assignedTo,
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        department: profile.department || '',
      } : null;
    }

    if (sanitized.targetStudent) {
      const profile = await Student.findOne({ userId: sanitized.targetStudent }).select('userId firstName lastName enrollmentNo branch').lean();
      studentData = profile ? {
        _id: sanitized.targetStudent,
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        enrollmentNo: profile.enrollmentNo || '',
        branch: profile.branch || '',
      } : null;
    }

    let subjectData = null;
    if (sanitized.targetSubject) {
      const subDoc = await Subject.findById(sanitized.targetSubject).select('code name branch semester').lean();
      subjectData = subDoc ? {
        _id: sanitized.targetSubject,
        code: subDoc.code,
        name: subDoc.name,
      } : null;
    }

    return res.json({
      success: true,
      data: {
        complaint: {
          ...sanitized,
          faculty: facultyData,
          assignedHandler: assignedData || { id: null, name: 'Institutional Administration (Admin Queue)' },
          targetStudent: studentData,
          targetSubject: subjectData,
          assignmentReason: sanitized.assignmentReason || '',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * ADMIN: Update complaint status, admin response, or assign/reassign to faculty
 * PATCH /api/admin/complaints/:id
 */
exports.updateAdminComplaint = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID' });
    }

    const { status, adminResponse, assignedTo, assignmentReason } = req.body;
    const update = {};

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }
      update.status = status;
    }

    if (adminResponse !== undefined) {
      update.adminResponse = String(adminResponse).trim();
      update.respondedAt = new Date();
      update.respondedBy = req.user._id;
    }

    // Assignment / Reassignment handling with full validation
    if (assignedTo !== undefined) {
      const currentComplaint = await Complaint.findById(req.params.id).lean();
      if (!currentComplaint) {
        return res.status(404).json({ success: false, message: 'Complaint not found' });
      }

      if (!assignedTo || assignedTo === 'admin' || assignedTo === 'unassigned') {
        update.assignedTo = null;
        update.assignedRole = 'admin';
        update.assignmentReason = assignmentReason?.trim() || 'Reassigned to Admin Queue by Administrator';
      } else {
        if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
          return res.status(400).json({ success: false, message: 'Invalid faculty handler ID' });
        }

        const facultyUser = await User.findOne({ _id: assignedTo, role: 'faculty', isActive: true }).lean();
        if (!facultyUser) {
          return res.status(400).json({ success: false, message: 'Target handler must be an active faculty member' });
        }

        // Rule 6: Never assign a faculty-related complaint to the faculty member being complained about
        if (currentComplaint.faculty && currentComplaint.faculty.toString() === facultyUser._id.toString()) {
          return res.status(400).json({
            success: false,
            message: 'Cannot assign a complaint to the faculty member who is the subject of the complaint',
          });
        }

        // Rule C: Complaints against faculty members are strictly restricted to admin
        if (currentComplaint.category === 'faculty') {
          return res.status(400).json({
            success: false,
            message: 'Complaints against faculty members are strictly restricted to Institutional Administration and cannot be assigned to faculty',
          });
        }

        const profile = await Faculty.findOne({ userId: facultyUser._id }).select('firstName lastName department').lean();
        const facName = profile ? `Prof. ${profile.firstName} ${profile.lastName}` : 'Faculty Member';
        const deptLabel = profile?.department ? ` (${profile.department})` : '';

        update.assignedTo = facultyUser._id;
        update.assignedRole = 'faculty';
        update.assignmentReason = assignmentReason?.trim() || `Manually assigned by Administrator to ${facName}${deptLabel}`;
      }
    } else if (assignmentReason !== undefined) {
      update.assignmentReason = String(assignmentReason).trim();
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide status, adminResponse, or assignedTo to update',
      });
    }

    const updated = await Complaint.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    ).select('-student').lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    const sanitized = sanitizeComplaint(updated);
    let assignedData = null;
    if (sanitized.assignedTo) {
      const profile = await Faculty.findOne({ userId: sanitized.assignedTo }).select('userId firstName lastName department').lean();
      assignedData = profile ? {
        id: sanitized.assignedTo,
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        department: profile.department || '',
      } : null;
    }

    return res.json({
      success: true,
      message: 'Complaint updated successfully',
      data: {
        complaint: {
          ...sanitized,
          assignedHandler: assignedData || { id: null, name: 'Institutional Administration (Admin Queue)' },
          assignmentReason: sanitized.assignmentReason || '',
        },
      },
    });
  } catch (error) {
    console.error('Error updating complaint:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

/**
 * ADMIN: Get summary analytics
 * GET /api/admin/complaints/summary
 */
exports.getAdminSummary = async (req, res) => {
  try {
    const [total, pending, inReview, resolved, rejected, adminQueueCount, facultyAssignedCount] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: 'pending' }),
      Complaint.countDocuments({ status: 'in_review' }),
      Complaint.countDocuments({ status: 'resolved' }),
      Complaint.countDocuments({ status: 'rejected' }),
      Complaint.countDocuments({ assignedRole: 'admin' }),
      Complaint.countDocuments({ assignedRole: 'faculty' }),
    ]);

    const categoryAgg = await Complaint.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const categoryCounts = {
      faculty: 0,
      student: 0,
      subject: 0,
      college: 0,
      website: 0,
      other: 0,
      class_discipline: 0,
      administration: 0,
    };
    categoryAgg.forEach(item => {
      if (item._id && categoryCounts.hasOwnProperty(item._id)) {
        categoryCounts[item._id] = item.count;
      }
    });

    const facultyAgg = await Complaint.aggregate([
      { $match: { category: 'faculty', faculty: { $ne: null } } },
      { $group: { _id: '$faculty', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const facultyUserIds = facultyAgg.map(item => item._id);
    const facultyProfiles = facultyUserIds.length
      ? await Faculty.find({ userId: { $in: facultyUserIds } }).select('userId firstName lastName department').lean()
      : [];

    const profileMap = new Map(facultyProfiles.map(p => [p.userId.toString(), p]));

    const facultyCounts = facultyAgg.map(item => {
      const profile = profileMap.get(item._id.toString());
      return {
        facultyId: item._id,
        name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Unknown Faculty',
        department: profile?.department || '',
        count: item.count,
      };
    });

    return res.json({
      success: true,
      data: {
        overview: {
          total,
          pending,
          inReview,
          resolved,
          rejected,
          adminQueueCount,
          facultyAssignedCount,
        },
        categoryCounts,
        facultyCounts,
      },
    });
  } catch (error) {
    console.error('Error generating complaints summary:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};
