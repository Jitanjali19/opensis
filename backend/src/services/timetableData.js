const mongoose = require('mongoose');
const Student = require('../models/Student');
const TimetableEntry = require('../models/TimetableEntry');
const Section = require('../models/Section');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const academicConfig = require('../../../shared/academicConfig.json');
const slotConfig = require('../../../shared/timetableSlots.json');

const getCurrentAcademicYear = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 6 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const sortAcademicYears = years => [...new Set(years.filter(Boolean))].sort((a, b) => {
  const aStart = Number(String(a).match(/^\d{4}/)?.[0] || 0);
  const bStart = Number(String(b).match(/^\d{4}/)?.[0] || 0);
  return bStart - aStart || String(b).localeCompare(String(a));
});

const getStudentSemester = student => {
  const validSemesters = academicConfig.SEMESTERS_BY_YEAR[String(student.year)] || [];
  const currentSemester = Number(student.currentSemester);
  return validSemesters.includes(currentSemester) ? currentSemester : null;
};

const getStudentSectionSelection = student => ({
  department: String(student.branch || student.section?.department || '').trim(),
  year: Number(student.year || student.section?.year),
  sectionName: String(
    typeof student.section === 'string' ? student.section : student.section?.sectionName || '',
  ).trim().toUpperCase(),
});

const populateEntries = query => query
  .sort({ day: 1, startSlot: 1, _id: 1 })
  .populate('subject', 'code name type subjectType')
  .populate('faculty', 'email role')
  .populate('room', 'name building roomNo type')
  .populate('section', 'department year sectionName batches');

async function addFacultyNames(entries) {
  const subjectIds = entries.map(entry => entry.subject?._id || entry.subject).filter(Boolean);
  const [subjectDocs, labDocs] = await Promise.all([
    Subject.find({ _id: { $in: subjectIds } }).select('code name type').lean(),
    Lab.find({ _id: { $in: subjectIds } }).select('code name').lean(),
  ]);
  const subjectMap = new Map(subjectDocs.map(subject => [subject._id.toString(), subject]));
  labDocs.forEach(lab => subjectMap.set(lab._id.toString(), { ...lab, type: 'lab' }));
  const facultyIds = entries.map(entry => entry.faculty?._id).filter(Boolean);
  const profiles = await Faculty.find({ userId: { $in: facultyIds } }).select('userId firstName lastName').lean();
  const names = new Map(profiles.map(profile => [profile.userId.toString(), `${profile.firstName} ${profile.lastName}`.trim()]));
  return entries.map(entry => ({
    ...entry,
    subject: entry.subject
      ? { ...(subjectMap.get((entry.subject?._id || entry.subject)?.toString()) || entry.subject), type: entry.subjectType === 'Lab' ? 'lab' : (entry.subject.type || subjectMap.get((entry.subject?._id || entry.subject)?.toString())?.type) }
      : entry.subject,
    facultyName: names.get(entry.faculty?._id?.toString()) || entry.faculty?.email || '',
  }));
}

async function getAvailableAcademicYears(filter) {
  return sortAcademicYears(await TimetableEntry.distinct('academicYear', filter));
}

function chooseAcademicYear(availableAcademicYears, requestedAcademicYear, preferredAcademicYear) {
  if (requestedAcademicYear) return String(requestedAcademicYear).trim();
  if (preferredAcademicYear && availableAcademicYears.includes(preferredAcademicYear)) return preferredAcademicYear;
  const current = getCurrentAcademicYear();
  return availableAcademicYears.includes(current) ? current : availableAcademicYears[0] || current;
}

async function getStudentTimetable(userId, filters = {}) {
  const student = await Student.findOne({ userId })
    .select('firstName lastName branch section batch session year currentSemester')
    .lean();
  if (!student) return null;

  let sectionDetails = student.section && typeof student.section === 'object' ? student.section : null;
  if (!sectionDetails && mongoose.isValidObjectId(student.section)) {
    sectionDetails = await Section.findById(student.section).select('department year sectionName batches').lean();
  }
  const selection = getStudentSectionSelection({ ...student, section: sectionDetails || student.section });
  const matchingSections = selection.department && selection.year && selection.sectionName
    ? await Section.find({
      department: selection.department,
      year: selection.year,
      sectionName: selection.sectionName,
    }).select('_id department year sectionName batches').lean()
    : [];
  const matchingSectionIds = matchingSections.map(section => section._id);
  const responseStudent = { ...student, section: matchingSections[0] || sectionDetails || student.section || null };
  const baseFilter = matchingSectionIds.length ? { section: { $in: matchingSectionIds } } : { section: null };
  const availableAcademicYears = await getAvailableAcademicYears(baseFilter);
  const selectedAcademicYear = chooseAcademicYear(availableAcademicYears, filters.academicYear, student.session);
  const yearFilter = { ...baseFilter, academicYear: selectedAcademicYear };
  const availableSemesters = (await TimetableEntry.distinct('semester', yearFilter)).sort((a, b) => a - b);
  const requestedSemester = filters.semester ? Number(filters.semester) : null;
  const profileSemester = getStudentSemester(student);
  const selectedSemester = filters.semester === undefined
    ? (availableSemesters.includes(profileSemester) ? profileSemester : null)
    : requestedSemester;

  if (!matchingSectionIds.length) {
    return {
      student: responseStudent,
      entries: [],
      availableAcademicYears,
      availableSemesters,
      selectedAcademicYear,
      selectedSemester,
      studentSection: selection,
    };
  }

  const entryFilter = { ...yearFilter };
  if (selectedSemester) entryFilter.semester = selectedSemester;
  const entries = await populateEntries(TimetableEntry.find(entryFilter)).lean();
  return {
    student: responseStudent,
    entries: await addFacultyNames(entries),
    availableAcademicYears,
    availableSemesters,
    selectedAcademicYear,
    selectedSemester,
    studentSection: selection,
  };
}

async function getFacultyTimetable(userId, filters = {}) {
  const baseFilter = { faculty: userId };
  const availableAcademicYears = await getAvailableAcademicYears(baseFilter);
  const selectedAcademicYear = chooseAcademicYear(availableAcademicYears, filters.academicYear);
  const yearFilter = { ...baseFilter, academicYear: selectedAcademicYear };
  const availableSemesters = (await TimetableEntry.distinct('semester', yearFilter)).sort((a, b) => a - b);
  const selectedSemester = filters.semester ? Number(filters.semester) : null;
  const entryFilter = { ...yearFilter };
  if (selectedSemester) entryFilter.semester = selectedSemester;
  const entries = await populateEntries(TimetableEntry.find(entryFilter)).lean();
  const [profile, user] = await Promise.all([
    Faculty.findOne({ userId }).select('firstName lastName').lean(),
    User.findById(userId).select('email').lean(),
  ]);
  return {
    entries: await addFacultyNames(entries),
    facultyName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : user?.email || 'Faculty',
    availableAcademicYears,
    availableSemesters,
    selectedAcademicYear,
    selectedSemester,
  };
}

const getIndiaDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const weekdayNumber = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(values.weekday);
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    dayName: values.weekday,
    day: weekdayNumber,
    isWeekend: weekdayNumber === 0 || weekdayNumber === 6,
  };
};

const getNextEntry = entries => [...entries]
  .sort((a, b) => Number(a.day) - Number(b.day) || Number(a.startSlot) - Number(b.startSlot))
  .shift() || null;

async function getTodayTimetable(userId, role, now = new Date()) {
  const today = getIndiaDateParts(now);
  if (role === 'faculty') {
    const baseFilter = { faculty: userId };
    const availableAcademicYears = await getAvailableAcademicYears(baseFilter);
    const selectedAcademicYear = chooseAcademicYear(availableAcademicYears);
    const yearFilter = { ...baseFilter, academicYear: selectedAcademicYear };
    const availableSemesters = (await TimetableEntry.distinct('semester', yearFilter)).sort((a, b) => a - b);
    const allEntries = await populateEntries(TimetableEntry.find(yearFilter)).lean();
    const entries = today.isWeekend ? [] : allEntries.filter(entry => Number(entry.day) === today.day);
    return {
      ...today,
      entries: await addFacultyNames(entries),
      nextClass: getNextEntry(allEntries),
      selectedAcademicYear,
      semester: null,
      availableSemesters,
    };
  }

  const student = await Student.findOne({ userId })
    .select('firstName lastName branch section batch session year currentSemester')
    .lean();
  if (!student) return null;
  let sectionDetails = student.section && typeof student.section === 'object' ? student.section : null;
  if (!sectionDetails && mongoose.isValidObjectId(student.section)) {
    sectionDetails = await Section.findById(student.section).select('department year sectionName batches').lean();
  }
  const selection = getStudentSectionSelection({ ...student, section: sectionDetails || student.section });
  const matchingSections = selection.department && selection.year && selection.sectionName
    ? await Section.find({ department: selection.department, year: selection.year, sectionName: selection.sectionName })
      .select('_id department year sectionName batches').lean()
    : [];
  const baseFilter = matchingSections.length
    ? { section: { $in: matchingSections.map(section => section._id) } }
    : { section: null };
  const availableAcademicYears = await getAvailableAcademicYears(baseFilter);
  const selectedAcademicYear = chooseAcademicYear(availableAcademicYears, undefined, student.session);
  const yearFilter = { ...baseFilter, academicYear: selectedAcademicYear };
  const availableSemesters = (await TimetableEntry.distinct('semester', yearFilter)).sort((a, b) => a - b);
  const profileSemester = getStudentSemester(student);
  const selectedSemester = availableSemesters.includes(profileSemester) ? profileSemester : null;
  const entryFilter = { ...yearFilter };
  if (selectedSemester) entryFilter.semester = selectedSemester;
  if (student.batch) entryFilter.$or = [{ batch: null }, { batch: student.batch }];
  else entryFilter.$or = [{ batch: null }, { batch: { $ne: null } }];
  const allEntries = matchingSections.length
    ? await populateEntries(TimetableEntry.find(entryFilter)).lean()
    : [];
  const entries = today.isWeekend ? [] : allEntries.filter(entry => Number(entry.day) === today.day);
  return {
    ...today,
    entries: await addFacultyNames(entries),
    nextClass: getNextEntry(allEntries),
    selectedAcademicYear,
    semester: selectedSemester,
    batchMissing: !student.batch,
    student: { firstName: student.firstName, lastName: student.lastName, batch: student.batch || null },
    studentSection: selection,
    availableSemesters,
  };
}

module.exports = {
  getCurrentAcademicYear,
  getStudentSectionSelection,
  getStudentTimetable,
  getFacultyTimetable,
  getTodayTimetable,
  getIndiaDateParts,
};
