const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Admin = require('../models/Admin');
const ClassSchedule = require('../models/ClassSchedule');
const ExamSchedule = require('../models/ExamSchedule');
const Result = require('../models/Result');
const Feedback = require('../models/Feedback');
const StudentAcademicHistory = require('../models/StudentAcademicHistory');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');
const { signAccess, signRefresh } = require('../utils/jwt');
const { getAcademicContext } = require('../utils/academicSession');

const normalizeSession = value => {
  const session = String(value || '').trim();
  const full = session.match(/^(\d{4})-(\d{4})$/);
  if (full) return session;
  const short = session.match(/^(\d{4})-(\d{2})$/);
  return short ? `${short[1]}-${Number(short[1]) + 1}` : session;
};

const getProfile = async (userId, role) => {
  if (role === 'student') return Student.findOne({ userId }).lean();
  if (role === 'faculty') return Faculty.findOne({ userId }).lean();
  if (role === 'admin') return Admin.findOne({ userId }).lean();
  return null;
};

exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Validate input
    if (!email || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, password, and role are required' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found. Please contact admin' 
      });
    }

    // Check if user role matches the selected role
    if (user.role !== role) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found. Please contact admin' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been deactivated. Please contact admin' 
      });
    }

    // Verify password
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Incorrect password' 
      });
    }

    // Check enrollment for student and faculty roles
    if (role === 'student' || role === 'faculty') {
      const ModelClass = role === 'student' ? Student : Faculty;
      const profile = await ModelClass.findOne({ userId: user._id });
      
      if (!profile) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found. Please contact admin' 
        });
      }
    }

    // Generate tokens
    const accessToken = signAccess(user._id, user.role);
    const refreshToken = signRefresh(user._id);
    const profile = await getProfile(user._id, user.role);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { id: user._id, email: user.email, role: user.role, profile },
      },
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};

exports.me = async (req, res) => {
  try {
    const profile = await getProfile(req.user._id, req.user.role);
    res.json({ success: true, data: { user: { id: req.user._id, email: req.user.email, role: req.user.role, profile } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sessions = async (req, res) => {
  try {
    const [students, studentHistorySessions, schedules, exams, results, feedback, teachingAssignments] = await Promise.all([
      Student.distinct('session'),
      StudentAcademicHistory.distinct('session'),
      ClassSchedule.distinct('session'),
      ExamSchedule.distinct('session'),
      Result.distinct('session'),
      Feedback.distinct('session'),
      FacultyTeachingAssignment.find(req.user.role === 'faculty' ? {} : { _id: null })
        .select('session term')
        .lean(),
    ]);
    const sessions = [...new Set([...students, ...studentHistorySessions, ...schedules, ...exams, ...results, ...feedback, ...teachingAssignments.map(item => item.session)]
      .map(normalizeSession)
      .filter(Boolean))].sort().reverse();
    const profile = await getProfile(req.user._id, req.user.role);
    const currentSession = normalizeSession(profile?.session) || sessions[0] || '';
    const profileYear = Number(profile?.year);
    const currentStartYear = Number(currentSession.slice(0, 4));
    if (Number.isInteger(profileYear) && profileYear > 0 && Number.isInteger(currentStartYear)) {
      for (let year = 0; year < profileYear; year += 1) {
        const startYear = currentStartYear - year;
        const session = `${startYear}-${startYear + 1}`;
        if (!sessions.includes(session)) sessions.push(session);
      }
      sessions.sort().reverse();
    }
    if (currentSession && !sessions.includes(currentSession)) sessions.unshift(currentSession);
    const history = req.user.role === 'student'
      ? await StudentAcademicHistory.find({ studentId: profile?._id })
        .select('session semester year term branch section status')
        .sort({ session: -1 })
        .lean()
      : [];
    const details = sessions.map(session => {
      const record = history.find(item => normalizeSession(item.session) === session);
      const facultyTerm = teachingAssignments.find(item => normalizeSession(item.session) === session)?.term;
      const fallback = req.user.role === 'student' ? getAcademicContext(profile, session) : { term: facultyTerm };
      if (record) {
        return {
          ...record,
          session,
          term: record.term || (Number(record.semester) % 2 === 0 ? 'january-june' : 'july-december'),
        };
      }
      return {
        session,
        semester: fallback.semester || null,
        year: fallback.year || null,
        term: fallback.term || (fallback.semester ? (Number(fallback.semester) % 2 === 0 ? 'january-june' : 'july-december') : null),
        branch: profile?.branch,
        section: profile?.section,
        status: session === currentSession ? 'current' : 'historical',
      };
    });
    res.json({ success: true, data: { sessions, currentSession, details } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Invalid token' });
    const accessToken = signAccess(user._id, user.role);
    res.json({ success: true, data: { accessToken } });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: true, message: 'If that email exists, a reset link was sent' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    res.json({ success: true, message: 'Reset token generated', resetToken: token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: new Date() } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Public student registration
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, branch, currentSemester, section, session, dob, gender, phone, fatherName, motherName, address } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Email, password, first name and last name are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, role: 'student' });

    // Create student profile with minimal fields; admin may later fill enrollmentNo, year, etc.
    const student = await Student.create({
      userId: user._id,
      firstName,
      lastName,
      branch: branch || 'IT',
      currentSemester: currentSemester || 1,
      section: section || 'A',
      session: session || '',
      dob,
      gender,
      phone,
      fatherName,
      motherName,
      address,
    });

    res.status(201).json({ success: true, data: { userId: user._id, studentId: student._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
