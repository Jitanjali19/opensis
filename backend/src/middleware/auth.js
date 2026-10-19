const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const StudentAcademicHistory = require('../models/StudentAcademicHistory');
const { normalizeSession } = require('../utils/academicSession');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive account' });
    }
    req.user = user;
    req.academicSession = normalizeSession(req.headers['x-academic-session']);
    req.academicTerm = ['july-december', 'january-june'].includes(req.headers['x-academic-term'])
      ? req.headers['x-academic-term']
      : (new Date().getMonth() >= 6 ? 'july-december' : 'january-june');
    if (user.role === 'student' && req.academicSession) {
      const student = await Student.findOne({ userId: user._id }).select('_id session currentSemester year branch section').lean();
      req.studentProfileSession = normalizeSession(student?.session);
      req.academicHistory = student
        ? await StudentAcademicHistory.findOne({ studentId: student._id, session: req.academicSession, term: req.academicTerm }).lean()
        : null;
    }
    req.isHistoricalSession = Boolean(
      user.role === 'student'
      && req.academicSession
      && req.studentProfileSession
      && req.academicSession !== req.studentProfileSession
    );
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || err.name === 'NotBeforeError') {
      return res.status(401).json({ success: false, message: 'Token invalid or expired' });
    }
    console.error('Authentication data lookup failed:', err);
    return res.status(500).json({ success: false, message: 'Unable to load authentication context' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
};

const currentAcademicSessionOnly = (req, res, next) => {
  if (req.isHistoricalSession) {
    return res.status(409).json({ success: false, message: 'This session is read-only. Switch to your current session to perform this action.' });
  }
  next();
};

module.exports = { authenticate, authorize, currentAcademicSessionOnly };
