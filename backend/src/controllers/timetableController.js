const mongoose = require('mongoose');
const TimetableEntry = require('../models/TimetableEntry');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Lab = require('../models/Lab');
const Room = require('../models/Room');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const { validateEntry, duplicateKeyMessage } = require('../services/timetableValidator');
const { getStudentTimetable, getFacultyTimetable, getTodayTimetable } = require('../services/timetableData');
const { createTimetablePdf, cleanFilenamePart } = require('../utils/timetablePdf');

const populateEntry = query => query
  .populate('section', 'department year sectionName batches')
  .populate('subject', 'code name type subjectType branch semester facultyId')
  .populate('room', 'name building roomNo type')
  .populate('faculty', 'email role');

const addFacultyNames = async entries => {
  const list = Array.isArray(entries) ? entries : [entries];
  const subjectIds = list.map(entry => entry.subject?._id || entry.subject).filter(Boolean);
  const [subjectDocs, labDocs] = await Promise.all([
    Subject.find({ _id: { $in: subjectIds } }).select('code name type').lean(),
    Lab.find({ _id: { $in: subjectIds } }).select('code name').lean(),
  ]);
  const subjectMap = new Map(subjectDocs.map(subject => [subject._id.toString(), subject]));
  labDocs.forEach(lab => subjectMap.set(lab._id.toString(), { ...lab, type: 'lab' }));
  const facultyIds = list.map(entry => entry.faculty?._id || entry.faculty).filter(Boolean);
  const profiles = await Faculty.find({ userId: { $in: facultyIds } }).select('userId firstName lastName').lean();
  const names = new Map(profiles.map(profile => [profile.userId.toString(), `${profile.firstName} ${profile.lastName}`.trim()]));
  return list.map(entry => ({
    ...entry,
    subject: entry.subject
      ? { ...(subjectMap.get((entry.subject?._id || entry.subject)?.toString()) || entry.subject), type: entry.subjectType === 'Lab' ? 'lab' : (entry.subject.type || subjectMap.get((entry.subject?._id || entry.subject)?.toString())?.type) }
      : entry.subject,
    facultyName: names.get((entry.faculty?._id || entry.faculty)?.toString()) || entry.faculty?.email || '',
  }));
};

const normalizeEntries = body => {
  if (Array.isArray(body.entries)) return body.entries;
  return [{ ...body, entries: undefined }];
};

const withCalculatedSlots = (entry, validation) => ({
  ...entry,
  slotCount: validation.slotCount,
  slots: validation.slots,
});

const conflictResponse = (res, validationResults) => {
  const errors = validationResults.flatMap(({ day, errors }) => errors.map(message => ({ day, message })));
  const badRequestErrors = validationResults.flatMap(result => result.badRequestErrors || []);
  if (badRequestErrors.length) {
    return res.status(400).json({ success: false, message: badRequestErrors.join(' '), errors: badRequestErrors.map(message => ({ message })) });
  }
  return res.status(409).json({
    success: false,
    message: errors.map(error => `Day ${error.day}: ${error.message}`).join(' '),
    errors,
  });
};

exports.getOptions = async (req, res) => {
  try {
    const [subjects, labs, rooms, faculty] = await Promise.all([
      Subject.find().sort({ code: 1 }).select('code name type branch semester facultyId').lean(),
      Lab.find().sort({ code: 1 }).select('code name branch semester facultyId').lean(),
      Room.find().sort({ name: 1 }).lean(),
      User.find({ role: 'faculty', isActive: true }).select('email role').sort({ email: 1 }).lean(),
    ]);
    const profiles = await Faculty.find({ userId: { $in: faculty.map(item => item._id) } })
      .select('userId firstName lastName').lean();
    const names = new Map(profiles.map(profile => [profile.userId.toString(), `${profile.firstName} ${profile.lastName}`.trim()]));
    const labSubjects = labs.map(lab => ({ ...lab, type: 'lab', subjectType: 'Lab' }));
    res.json({ success: true, data: {
      subjects: [...subjects.map(subject => ({ ...subject, subjectType: 'Subject' })), ...labSubjects].sort((a, b) => a.code.localeCompare(b.code)),
      rooms,
      faculty: faculty.map(item => ({
        ...item,
        facultyProfileId: profiles.find(profile => profile.userId.toString() === item._id.toString())?._id || null,
        name: names.get(item._id.toString()) || item.email,
      })),
    } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getToday = async (req, res) => {
  try {
    const data = await getTodayTimetable(req.user._id, req.user.role);
    if (!data) return res.status(404).json({ success: false, message: 'Student profile not found' });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSectionEntries = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.sectionId)) {
      return res.status(400).json({ success: false, message: 'Invalid section id' });
    }
    const filter = { section: req.params.sectionId };
    if (req.query.academicYear) filter.academicYear = String(req.query.academicYear).trim();
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const entries = await populateEntry(TimetableEntry.find(filter).sort({ day: 1, startSlot: 1 })).lean();
    res.json({ success: true, data: { entries: await addFacultyNames(entries) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createEntries = async (req, res) => {
  try {
    const entries = normalizeEntries(req.body);
    if (!entries.length) return res.status(400).json({ success: false, message: 'At least one timetable entry is required' });

    const results = await Promise.all(entries.map(async entry => ({
      day: entry.day,
      ...(await validateEntry(entry)),
    })));
    if (results.some(result => result.errors.length)) return conflictResponse(res, results);

    const created = await TimetableEntry.insertMany(entries.map((entry, index) => withCalculatedSlots(entry, results[index])), { ordered: true });
    const populated = await populateEntry(TimetableEntry.find({ _id: { $in: created.map(entry => entry._id) } }).sort({ day: 1, startSlot: 1 })).lean();
    return res.status(201).json({ success: true, data: { entries: await addFacultyNames(populated) } });
  } catch (error) {
    const message = duplicateKeyMessage(error);
    if (message) return res.status(409).json({ success: false, message, errors: [{ message }] });
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateEntry = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid timetable entry id' });
    const existing = await TimetableEntry.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    const data = { ...existing, ...req.body, _id: undefined };
    const validation = await validateEntry(data, req.params.id);
    if (!validation.valid) return conflictResponse(res, [{ day: data.day, ...validation }]);

    const updatePayload = withCalculatedSlots({ ...existing, ...req.body }, validation);
    delete updatePayload._id;
    delete updatePayload.createdAt;
    delete updatePayload.updatedAt;
    delete updatePayload.__v;
    const updated = await TimetableEntry.findByIdAndUpdate(req.params.id, updatePayload, { new: true, runValidators: true });
    const populated = await populateEntry(TimetableEntry.findById(updated._id)).lean();
    return res.json({ success: true, data: { entry: (await addFacultyNames([populated]))[0] } });
  } catch (error) {
    const message = duplicateKeyMessage(error);
    if (message) return res.status(409).json({ success: false, message, errors: [{ message }] });
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteEntry = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid timetable entry id' });
    const deleted = await TimetableEntry.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    return res.json({ success: true, message: 'Timetable entry deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyFacultyEntries = async (req, res) => {
  try {
    const timetable = await getFacultyTimetable(req.user._id, {
      academicYear: req.query.academicYear,
      semester: req.query.semester,
    });
    res.json({ success: true, data: timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.diagnoseFacultyIds = async (req, res) => {
  try {
    const entries = await TimetableEntry.find()
      .select('_id faculty academicYear semester section subject')
      .populate('section', 'department year sectionName')
      .populate('subject', 'code name')
      .lean();
    const facultyIds = [...new Set(entries.map(entry => entry.faculty?.toString()).filter(Boolean))];
    const [users, profiles] = await Promise.all([
      User.find({ _id: { $in: facultyIds } }).select('_id email role isActive').lean(),
      Faculty.find({ userId: { $in: facultyIds } }).select('userId firstName lastName employeeId').lean(),
    ]);
    const usersById = new Map(users.map(user => [user._id.toString(), user]));
    const profilesByUserId = new Map(profiles.map(profile => [profile.userId.toString(), profile]));
    const report = entries.map(entry => {
      const facultyId = entry.faculty?.toString();
      const user = usersById.get(facultyId);
      const profile = profilesByUserId.get(facultyId);
      return {
        entryId: entry._id,
        facultyId,
        academicYear: entry.academicYear,
        semester: entry.semester,
        section: entry.section,
        subject: entry.subject,
        facultyUser: user || null,
        facultyProfile: profile || null,
        status: user?.role === 'faculty' && user.isActive && profile ? 'valid' : 'orphan-or-mismatched',
      };
    });
    return res.json({
      success: true,
      data: {
        total: report.length,
        valid: report.filter(item => item.status === 'valid').length,
        invalid: report.filter(item => item.status !== 'valid').length,
        entries: report,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadMyPdf = async (req, res) => {
  try {
    const role = req.user.role;
    const filters = { academicYear: req.query.academicYear, semester: req.query.semester };
    const data = role === 'student'
      ? await getStudentTimetable(req.user._id, filters)
      : await getFacultyTimetable(req.user._id, filters);
    if (!data) return res.status(404).json({ success: false, message: `${role} profile not found` });

    const entries = data.entries || [];
    const academicYear = data.selectedAcademicYear;
    const headerName = role === 'student'
      ? `${data.student.firstName} ${data.student.lastName}`.trim()
      : data.facultyName;
    const filename = `Timetable_${cleanFilenamePart(headerName)}_${cleanFilenamePart(academicYear)}.pdf`;

    return createTimetablePdf(res, {
      entries,
      role,
      headerName,
      section: data.student?.section,
      studentBatch: data.student?.batch,
      academicYear,
      filename,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFilteredEntries = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.query.section)) {
      return res.status(400).json({ success: false, message: 'A valid section filter is required' });
    }
    const filter = { section: req.query.section };
    if (req.query.academicYear) filter.academicYear = String(req.query.academicYear).trim();
    if (req.query.semester) filter.semester = Number(req.query.semester);
    const entries = await populateEntry(TimetableEntry.find(filter)).sort({ day: 1, startSlot: 1 }).lean();
    res.json({ success: true, data: { entries: await addFacultyNames(entries) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};