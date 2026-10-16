const Student = require('../models/Student');
const TimetableEntry = require('../models/TimetableEntry');
const Faculty = require('../models/Faculty');
const User = require('../models/User');

const populateEntries = query => query
  .sort({ day: 1, startSlot: 1 })
  .populate('subject', 'code name type')
  .populate('faculty', 'email role')
  .populate('room', 'name type')
  .populate('section', 'department year sectionName batches');

async function addFacultyNames(entries) {
  const facultyIds = entries.map(entry => entry.faculty?._id).filter(Boolean);
  const profiles = await Faculty.find({ userId: { $in: facultyIds } }).select('userId firstName lastName').lean();
  const names = new Map(profiles.map(profile => [profile.userId.toString(), `${profile.firstName} ${profile.lastName}`.trim()]));
  return entries.map(entry => ({
    ...entry,
    facultyName: names.get(entry.faculty?._id?.toString()) || entry.faculty?.email || '',
  }));
}

async function getStudentTimetable(userId) {
  const student = await Student.findOne({ userId }).select('firstName lastName section batch session').populate('section', 'department year sectionName batches').lean();
  if (!student) return null;
  if (!student.section) return { student, entries: [] };

  const batchFilter = student.batch ? [{ batch: null }, { batch: student.batch }] : [{ batch: null }];
  const entries = await populateEntries(TimetableEntry.find({ section: student.section._id, $or: batchFilter })).lean();
  return { student, entries: await addFacultyNames(entries) };
}

async function getFacultyTimetable(userId) {
  const [entries, profile, user] = await Promise.all([
    populateEntries(TimetableEntry.find({ faculty: userId })).lean(),
    Faculty.findOne({ userId }).select('firstName lastName').lean(),
    User.findById(userId).select('email').lean(),
  ]);
  return {
    entries,
    facultyName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : user?.email || 'Faculty',
  };
}

module.exports = { getStudentTimetable, getFacultyTimetable };
