const mongoose = require('mongoose');
const Student = require('../models/Student');
const TimetableEntry = require('../models/TimetableEntry');
const Section = require('../models/Section');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const LabBatch = require('../models/LabBatch');
const academicConfig = require('../../../shared/academicConfig.json');
const slotConfig = require('../../../shared/timetableSlots.json');

/**
 * Resolve the batch a student belongs to for each of their labs.
 * The faculty-managed LabBatch collection is the source of truth; returns a
 * Map of labId (string) -> batchName for the labs the student is assigned to.
 */
async function resolveStudentLabBatches(studentId, labIds, session) {
  if (!labIds.length || !session) return new Map();
  const docs = await LabBatch.find({ labId: { $in: labIds }, session }).lean();
  const map = new Map();
  docs.forEach((doc) => {
    const entry = (doc.batches || []).find((b) =>
      (b.studentIds || []).some((sid) => String(sid) === String(studentId)),
    );
    if (entry) map.set(String(doc.labId), entry.batchName);
  });
  return map;
}

// Given a student's lab-batch map, return the batch name to display. The
// explicit student.batch wins; otherwise the first assigned lab batch is used.
const pickEffectiveBatch = (studentBatch, labBatches) => {
  if (studentBatch) return studentBatch;
  if (!labBatches.size) return null;
  return [...labBatches.values()][0];
};

// All lab ids for the student's branch/semester/session — used to resolve the
// student's lab batches even when the timetable doesn't list that lab yet.
const getStudentLabIds = async (student) => {
  if (!student?.branch || !student?.currentSemester || !student?.session) return [];
  const labs = await Lab.find({
    branch: student.branch,
    semester: student.currentSemester,
    session: student.session,
  }).select('_id').lean();
  return labs.map((lab) => lab._id);
};

// Only filter the timetable by batch when the batch is one the section actually
// uses (student.batch is always trusted). Free-form lab batch names that don't
// match a section batch must not hide the student's classes.
const isValidSectionBatch = (batchName, sectionBatches) =>
  Boolean(batchName) && sectionBatches.has(String(batchName));

const filterEntriesByBatch = (entries, batchName) =>
  entries.filter((entry) => !entry.batch || String(entry.batch) === String(batchName));

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

// Jul-Dec = odd semesters (1/3/5/7), Jan-Jun = even semesters (2/4/6/8).
const semesterForTerm = (currentSemester, term) => {
  const current = Number(currentSemester);
  if (!Number.isInteger(current) || current < 1) return null;
  if (term === 'july-december') return current % 2 === 1 ? current : Math.max(1, current - 1);
  if (term === 'january-june') return current % 2 === 0 ? current : Math.min(8, current + 1);
  return current;
};

const termSemesterFilter = term => {
  if (term === 'july-december') return { $in: [1, 3, 5, 7] };
  if (term === 'january-june') return { $in: [2, 4, 6, 8] };
  return null;
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
  const selectedAcademicYear = filters.session
    ? String(filters.session).trim()
    : chooseAcademicYear(availableAcademicYears, filters.academicYear, student.session);
  const yearFilter = { ...baseFilter, academicYear: selectedAcademicYear };
  const availableSemesters = (await TimetableEntry.distinct('semester', yearFilter)).sort((a, b) => a - b);
  const profileSemester = getStudentSemester(student);
  const requestedSemester = filters.semester !== undefined && filters.semester !== null && filters.semester !== ''
    ? Number(filters.semester)
    : null;
  const selectedSemester = requestedSemester || semesterForTerm(profileSemester, filters.term);

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
  const enriched = await addFacultyNames(entries);

  // Faculty-managed lab batches are the source of truth for a student's batch.
  // The full timetable is returned so students can see every batch; the frontend
  // highlights the student's own batch using student.batch.
  const labIds = await getStudentLabIds(student);
  const labBatches = await resolveStudentLabBatches(student._id, labIds, student.session);
  const effectiveBatch = pickEffectiveBatch(student.batch, labBatches);

  return {
    student: { ...responseStudent, batch: effectiveBatch },
    entries: enriched,
    availableAcademicYears,
    availableSemesters,
    selectedAcademicYear,
    selectedSemester,
    studentSection: selection,
  };
};

async function getFacultyTimetable(userId, filters = {}) {
  const baseFilter = { faculty: userId };
  const availableAcademicYears = await getAvailableAcademicYears(baseFilter);
  const selectedAcademicYear = filters.session
    ? String(filters.session).trim()
    : chooseAcademicYear(availableAcademicYears, filters.academicYear);
  const yearFilter = { ...baseFilter, academicYear: selectedAcademicYear };
  const availableSemesters = (await TimetableEntry.distinct('semester', yearFilter)).sort((a, b) => a - b);
  const selectedSemester = filters.semester ? Number(filters.semester) : null;
  const entryFilter = { ...yearFilter };
  if (selectedSemester) entryFilter.semester = selectedSemester;
  else {
    const termFilter = termSemesterFilter(filters.term);
    if (termFilter) entryFilter.semester = termFilter;
  }
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

const getNextEntry = (allEntries, today) => {
  if (!allEntries.length) return null;
  // Prefer the next upcoming entry on a future day, or the soonest one on today
  const todayDay = today ? today.day : -1;
  const sorted = [...allEntries].sort(
    (a, b) => Number(a.day) - Number(b.day) || Number(a.startSlot) - Number(b.startSlot),
  );
  // Entries strictly after today
  const afterToday = sorted.filter(e => Number(e.day) > todayDay);
  if (afterToday.length) return afterToday[0];
  // Wrap around to next week (day <= todayDay)
  return sorted[0] || null;
};

async function getTodayTimetable(userId, role, now = new Date(), filters = {}) {
  const today = getIndiaDateParts(now);
  if (role === 'faculty') {
    const baseFilter = { faculty: userId };
    const availableAcademicYears = await getAvailableAcademicYears(baseFilter);
    const selectedAcademicYear = filters.session
      ? String(filters.session).trim()
      : chooseAcademicYear(availableAcademicYears);
    const yearFilter = { ...baseFilter, academicYear: selectedAcademicYear };
    const availableSemesters = (await TimetableEntry.distinct('semester', yearFilter)).sort((a, b) => a - b);
    const entryFilter = { ...yearFilter };
    const termFilter = termSemesterFilter(filters.term);
    if (termFilter) entryFilter.semester = termFilter;
    const allEntries = await populateEntries(TimetableEntry.find(entryFilter)).lean();
    const entries = today.isWeekend ? [] : allEntries.filter(entry => Number(entry.day) === today.day);
    return {
      ...today,
      entries: await addFacultyNames(entries),
      nextClass: getNextEntry(allEntries, today),
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
  const selectedAcademicYear = filters.session
    ? String(filters.session).trim()
    : chooseAcademicYear(availableAcademicYears, undefined, student.session);
  const yearFilter = { ...baseFilter, academicYear: selectedAcademicYear };
  const availableSemesters = (await TimetableEntry.distinct('semester', yearFilter)).sort((a, b) => a - b);
  const profileSemester = getStudentSemester(student);
  const requestedSemester = filters.semester !== undefined && filters.semester !== null && filters.semester !== ''
    ? Number(filters.semester)
    : null;
  const selectedSemester = requestedSemester || semesterForTerm(profileSemester, filters.term);
  const entryFilter = { ...yearFilter };
  if (selectedSemester) entryFilter.semester = selectedSemester;
  const allEntries = matchingSections.length
    ? await populateEntries(TimetableEntry.find(entryFilter)).lean()
    : [];
  const enriched = await addFacultyNames(allEntries);

  // Faculty-managed lab batches are the source of truth for a student's batch.
  const labIds = await getStudentLabIds(student);
  const labBatches = await resolveStudentLabBatches(student._id, labIds, student.session);
  const effectiveBatch = pickEffectiveBatch(student.batch, labBatches);
  const sectionBatches = new Set(matchingSections.flatMap((section) => section.batches || []));
  const validBatch = student.batch || (isValidSectionBatch(effectiveBatch, sectionBatches) ? effectiveBatch : null);
  const visibleEntries = validBatch ? filterEntriesByBatch(enriched, validBatch) : enriched;
  const entries = today.isWeekend ? [] : visibleEntries.filter(entry => Number(entry.day) === today.day);
  return {
    ...today,
    entries,
    nextClass: getNextEntry(visibleEntries, today),
    selectedAcademicYear,
    semester: selectedSemester,
    batchMissing: !effectiveBatch,
    student: { firstName: student.firstName, lastName: student.lastName, batch: effectiveBatch },
    studentSection: selection,
    availableSemesters,
  };
};

module.exports = {
  getCurrentAcademicYear,
  getStudentSectionSelection,
  getStudentTimetable,
  getFacultyTimetable,
  getTodayTimetable,
  getIndiaDateParts,
};
