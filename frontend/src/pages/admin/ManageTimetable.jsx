import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import TimetableGrid from '../../components/TimetableGrid';
import { useAuth } from '../../context/AuthContext';
import academicConfig from '../../../../shared/academicConfig.json';
import roomConfig from '../../../../shared/roomConfig.json';
import { TIMETABLE_MESSAGES } from '../../constants/timetableMessages';

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
];
const SLOT_OPTIONS = [
  [1, '9:00 AM - 10:00 AM'], [2, '10:00 AM - 11:00 AM'], [3, '11:00 AM - 12:00 PM'],
  [4, '1:00 PM - 2:00 PM'], [5, '2:00 PM - 3:00 PM'], [6, '3:00 PM - 4:00 PM'], [7, '4:00 PM - 5:00 PM'],
];
const LAB_START_SLOTS = [1, 2, 4, 5, 6];
const slotLabel = slot => SLOT_OPTIONS.find(([value]) => value === Number(slot))?.[1] || '';
const emptyForm = (day = 1, startSlot = 1) => ({
  subject: '',
  faculty: '',
  building: '',
  roomNo: '',
  batch: '',
  days: [day],
  daySlots: { [day]: startSlot },
});

const roomIdentity = room => {
  if (!room) return { building: '', roomNo: '' };
  if (room.building && room.roomNo) return { building: room.building, roomNo: room.roomNo };
  const match = String(room.name || '').match(/^(ATC|LT)[-_ ]?(\d{3})$/i);
  return match ? { building: match[1].toUpperCase(), roomNo: match[2] } : { building: '', roomNo: '' };
};

export default function ManageTimetable() {
  const { selectedSession, selectedTerm } = useAuth();
  const [options, setOptions] = useState({ subjects: [], rooms: [], faculty: [] });
  const [academicYear, setAcademicYear] = useState(selectedSession || '');
  const [term, setTerm] = useState(selectedTerm || (new Date().getMonth() >= 6 ? 'july-december' : 'january-june'));
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [section, setSection] = useState(null);
  const [sectionBatches, setSectionBatches] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [batchDraft, setBatchDraft] = useState('');
  const [showAllFaculty, setShowAllFaculty] = useState(false);

  const selectedSection = section;
  const selectedSubject = options.subjects.find(subject => subject._id === form.subject);
  const isLab = selectedSubject?.type === 'lab';
  const roomOptions = options.rooms.filter(room => !isLab || room.type === 'lab' || roomConfig.ROOM_TYPES[`${room.building}-${room.roomNo}`] === 'lab');
  const roomNumbers = form.building ? roomConfig.ROOMS_BY_BUILDING[form.building] || [] : [];
  const selectedRoom = roomOptions.find(room => room.building === form.building && room.roomNo === form.roomNo);

  const filteredSubjects = useMemo(() => options.subjects.filter(subject => {
    if (!selectedSection) return true;
    return (!subject.branch || subject.branch === selectedSection.department) && (!subject.semester || subject.semester === Number(semester));
  }), [options.subjects, selectedSection, semester]);
  const assignedFaculty = selectedSubject?.facultyId
    ? options.faculty.filter(faculty => String(faculty.facultyProfileId) === String(selectedSubject.facultyId))
    : [];
  const facultyChoices = showAllFaculty ? options.faculty : assignedFaculty;

  const departments = academicConfig.DEPARTMENTS;
  const years = academicConfig.YEARS;
  const semesters = useMemo(() => {
    const list = year ? academicConfig.SEMESTERS_BY_YEAR[String(year)] || [] : [];
    const parity = term === 'july-december' ? 1 : 0;
    return list.filter(value => value % 2 === parity);
  }, [year, term]);
  const sections = year ? academicConfig.SECTIONS_BY_YEAR[String(year)] || [] : [];
  const academicYears = useMemo(
    () => Array.from(new Set([...academicConfig.ACADEMIC_YEARS, selectedSession].filter(Boolean))).sort(),
    [selectedSession]
  );
  const filterSelectionComplete = Boolean(academicYear && department && year && semester && sectionName);
  const filtersReady = Boolean(filterSelectionComplete && section?._id);

  const loadEntries = async () => {
    if (!filtersReady) {
      setEntries([]);
      return;
    }
    const { data } = await api.get('/timetable', { params: { academicYear, section: section._id, semester } });
    setEntries(data.data.entries || []);
  };

  useEffect(() => {
    api.get('/timetable/options').then(({ data }) => {
      const next = data.data;
      setOptions(next);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadEntries().catch(() => toast.error('Failed to load timetable'));
  }, [filtersReady, section?._id, academicYear, semester]);

  useEffect(() => {
    if (!filterSelectionComplete) return undefined;
    let cancelled = false;
    api.post('/sections/resolve', { department, year: Number(year), sectionName })
      .then(({ data }) => {
        if (!cancelled) {
          setSection(data.data.section);
          setSectionBatches(data.data.section.batches || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSection(null);
          toast.error('Section resolve failed');
        }
      });
    return () => { cancelled = true; };
  }, [filterSelectionComplete, academicYear, department, year, semester, sectionName]);

  useEffect(() => {
    if (!selectedTerm) return;
    setTerm(selectedTerm);
    setSemester('');
    setSectionName('');
    setSection(null);
    setSectionBatches([]);
  }, [selectedTerm]);

  const resetFromAcademicYear = value => {
    setAcademicYear(value);
    setDepartment('');
    setYear('');
    setSemester('');
    setSectionName('');
    setSection(null);
    setSectionBatches([]);
  };

  const resetFromDepartment = value => {
    setDepartment(value);
    setYear('');
    setSemester('');
    setSectionName('');
    setSection(null);
    setSectionBatches([]);
  };

  const resetFromYear = value => {
    setYear(value);
    setSemester('');
    setSectionName('');
    setSection(null);
    setSectionBatches([]);
  };

  const resetFromTerm = value => {
    setTerm(value);
    setSemester('');
    setSectionName('');
    setSection(null);
    setSectionBatches([]);
  };

  const resetFromSemester = value => {
    setSemester(value);
    setSectionName('');
    setSection(null);
    setSectionBatches([]);
  };

  const resolveSelectedSection = value => {
    setSectionName(value);
    setSection(null);
    setSectionBatches([]);
  };

  const openCreate = (day = 1, startSlot = 1) => {
    setEditingEntry(null);
    setConflicts([]);
    setForm(emptyForm(day, startSlot));
    setShowModal(true);
  };

  const openEdit = entry => {
    setEditingEntry(entry);
    setConflicts([]);
    setForm({
      subject: entry.subject?._id || entry.subject,
      faculty: entry.faculty?._id || entry.faculty,
      ...roomIdentity(entry.room),
      batch: entry.batch || '',
      days: [Number(entry.day)],
      daySlots: { [entry.day]: Number(entry.startSlot || entry.slots?.[0]) },
    });
    setShowModal(true);
  };

  const closeModal = () => {
    if (!saving) setShowModal(false);
  };

  const setDaySlot = (day, value) => setForm(current => ({ ...current, daySlots: { ...current.daySlots, [day]: Number(value) } }));

  const toggleDay = day => setForm(current => {
    const days = current.days.includes(day) ? current.days.filter(value => value !== day) : [...current.days, day].sort();
    return { ...current, days: days.length ? days : [day], daySlots: { ...current.daySlots, [day]: current.daySlots[current.days[0]] || 1 } };
  });

  const handleSubjectChange = subject => {
    const nextSubject = options.subjects.find(item => item._id === subject);
    const mapped = nextSubject?.facultyId
      ? options.faculty.find(faculty => String(faculty.facultyProfileId) === String(nextSubject.facultyId))
      : null;
    setShowAllFaculty(false);
    setForm(current => ({ ...current, subject, faculty: mapped?._id || '', batch: '' }));
  };
  const handleBuildingChange = building => setForm(current => ({ ...current, building, roomNo: '' }));

  const persistBatches = async nextBatches => {
    if (!section?._id) return;
    const { data } = await api.patch(`/sections/${section._id}/batches`, { batches: nextBatches });
    setSection(data.data.section);
    setSectionBatches(data.data.section.batches || []);
  };

  const addBatch = async () => {
    const batch = batchDraft.trim();
    if (!batch || sectionBatches.includes(batch)) return;
    try {
      await persistBatches([...sectionBatches, batch]);
      setBatchDraft('');
    } catch {
      toast.error('Batch save failed');
    }
  };

  const removeBatch = async batch => {
    try {
      await persistBatches(sectionBatches.filter(value => value !== batch));
      setForm(current => ({ ...current, batch: current.batch === batch ? '' : current.batch }));
    } catch {
      toast.error('Batch update failed');
    }
  };

  const handleSave = async event => {
    event.preventDefault();
    setConflicts([]);
    const days = editingEntry ? [editingEntry.day] : form.days;
    if (!selectedRoom?._id) {
      setConflicts(['Please select a valid building and room number.']);
      return;
    }
    const payloadEntries = days.map(day => ({
      section: section._id,
      subject: form.subject,
      faculty: form.faculty,
      subjectType: selectedSubject?.subjectType || 'Subject',
      showAllFaculty,
      room: selectedRoom._id,
      batch: isLab ? (form.batch || null) : null,
      day,
      startSlot: Number(form.daySlots[day]),
      academicYear,
      semester: Number(semester),
    }));

    setSaving(true);
    try {
      if (editingEntry) await api.put(`/timetable/${editingEntry._id}`, payloadEntries[0]);
      else await api.post('/timetable', { entries: payloadEntries });
      toast.success(editingEntry ? 'Timetable entry updated' : 'Timetable entries saved');
      setShowModal(false);
      await loadEntries();
    } catch (error) {
      if (error.response?.status === 409) {
        const serverErrors = error.response.data.errors || [{ message: error.response.data.message }];
        setConflicts(serverErrors.map(item => item.day ? `Day ${item.day}: ${item.message}` : item.message));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEntry || !window.confirm('Delete this timetable entry?')) return;
    setSaving(true);
    try {
      await api.delete(`/timetable/${editingEntry._id}`);
      toast.success('Timetable entry deleted');
      setShowModal(false);
      await loadEntries();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-700"><Calendar className="h-5 w-5" /><span className="text-sm font-semibold">Academic planning</span></div>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">Class Timetable</h1>
        </div>
        {filtersReady && <button type="button" onClick={() => openCreate()} className="btn-primary"><Plus className="h-4 w-4" />{TIMETABLE_MESSAGES.ADD_CLASS}</button>}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <label className="label">Session<select className="input mt-1" value={academicYear} onChange={event => resetFromAcademicYear(event.target.value)}><option value="">Select session</option>{academicYears.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="label">Department<select className="input mt-1" value={department} disabled={!academicYear} onChange={event => resetFromDepartment(event.target.value)}><option value="">Select department</option>{departments.map(value => <option key={value} value={value}>{academicConfig.DEPARTMENT_LABELS[value] || value}</option>)}</select></label>
        <label className="label">Year<select className="input mt-1" value={year} disabled={!department} onChange={event => resetFromYear(event.target.value)}><option value="">Select year</option>{years.map(value => <option key={value} value={value}>{value === 1 ? '1st Year' : value === 2 ? '2nd Year' : value === 3 ? '3rd Year' : '4th Year'}</option>)}</select></label>
        <label className="label">Term<select className="input mt-1" value={term} disabled={!year} onChange={event => resetFromTerm(event.target.value)}><option value="july-december">July-December</option><option value="january-june">January-June</option></select></label>
          <label className="label">Semester<select className="input mt-1" value={semester} disabled={!year} onChange={event => resetFromSemester(event.target.value)}><option value="">Select semester</option>{semesters.map(value => <option key={value} value={value}>Semester {value}</option>)}</select></label>
          <label className="label">Section<select className="input mt-1" value={sectionName} disabled={!semester} onChange={event => resolveSelectedSection(event.target.value)}><option value="">Select section</option>{sections.map(value => <option key={value} value={value}>Section {value}</option>)}</select></label>
        <div className="flex items-end text-sm text-slate-500">{entries.length} scheduled {entries.length === 1 ? 'class' : 'classes'}</div>
      </div>

      {filtersReady ? <TimetableGrid entries={entries} mode="admin" onEmptyCell={openCreate} onEntryClick={openEdit} /> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm text-slate-500">{TIMETABLE_MESSAGES.SELECT_ALL_FILTERS}</div>}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSave} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold text-slate-800">{editingEntry ? TIMETABLE_MESSAGES.EDIT_TIMETABLE_ENTRY : TIMETABLE_MESSAGES.ADD_TIMETABLE_CLASS}</h2><p className="mt-1 text-sm text-slate-500">{selectedSection?.department} · {selectedSection?.sectionName} · Semester {semester}</p></div><button type="button" onClick={closeModal} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>

            {conflicts.length > 0 && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><p className="font-semibold">Could not save timetable:</p>{conflicts.map((message, index) => <p key={`${message}-${index}`} className="mt-1">{message}</p>)}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="label sm:col-span-2">Subject<select required className="input mt-1" value={form.subject} onChange={event => handleSubjectChange(event.target.value)}><option value="">Select subject</option>{filteredSubjects.map(subject => <option key={`${subject.subjectType}-${subject._id}`} value={subject._id}>{subject.type === 'lab' ? '[LAB] ' : ''}{subject.code} · {subject.name} {subject.type === 'lab' ? '' : '(THEORY)'}</option>)}</select>{!filteredSubjects.length && <p className="mt-1 text-xs text-amber-700">{TIMETABLE_MESSAGES.NO_SUBJECTS_AVAILABLE}</p>}</label>
              <label className="label">Faculty<select required disabled={!form.subject} className="input mt-1" value={form.faculty} onChange={event => setForm(current => ({ ...current, faculty: event.target.value }))}><option value="">Select faculty</option>{facultyChoices.map(faculty => <option key={faculty._id} value={faculty._id}>{faculty.name}</option>)}</select>{form.subject && !assignedFaculty.length && <><p className="mt-1 text-xs text-amber-700">{TIMETABLE_MESSAGES.NO_FACULTY_ASSIGNED}</p><label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={showAllFaculty} onChange={event => { setShowAllFaculty(event.target.checked); setForm(current => ({ ...current, faculty: '' })); }} />Show all faculty</label></>}</label>
              <label className="label">Building<select required className="input mt-1" value={form.building} onChange={event => handleBuildingChange(event.target.value)}><option value="">Select building</option>{roomConfig.BUILDINGS.filter(building => roomOptions.some(room => room.building === building)).map(building => <option key={building} value={building}>{building}</option>)}</select></label>
              <label className="label">Room No.<select required className="input mt-1" value={form.roomNo} disabled={!form.building} onChange={event => setForm(current => ({ ...current, roomNo: event.target.value }))}><option value="">Select room no.</option>{roomNumbers.filter(roomNo => roomOptions.some(room => room.building === form.building && room.roomNo === roomNo)).map(roomNo => <option key={roomNo} value={roomNo}>{form.building}-{roomNo}</option>)}</select></label>
              <div className="label">Batch<select className="input mt-1" value={isLab ? form.batch : ''} disabled={!isLab} required={isLab} onChange={event => setForm(current => ({ ...current, batch: event.target.value }))}><option value="">{isLab ? 'Select batch' : 'All students'}</option>{isLab && sectionBatches.map(batch => <option key={batch} value={batch}>{batch}</option>)}</select>{isLab && <div className="mt-2 flex gap-2"><input className="input" value={batchDraft} onChange={event => setBatchDraft(event.target.value)} placeholder="Add batch" /><button type="button" onClick={addBatch} className="btn-secondary whitespace-nowrap">Add</button></div>}{isLab && <div className="mt-2 flex flex-wrap gap-1">{sectionBatches.map(batch => <button type="button" key={batch} onClick={() => removeBatch(batch)} className="badge-blue" title={`Remove ${batch}`}>{batch} ×</button>)}</div>}</div>
              <div className="label">Duration<div className="input mt-1 bg-slate-100">{isLab ? TIMETABLE_MESSAGES.DURATION_LAB : TIMETABLE_MESSAGES.DURATION_THEORY}</div></div>
            </div>

            {!editingEntry && <fieldset className="mt-5 rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-semibold text-slate-700">Repeat on days</legend><div className="grid gap-2 sm:grid-cols-5">{DAYS.map(day => <label key={day.value} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.days.includes(day.value)} onChange={() => toggleDay(day.value)} />{day.label.slice(0, 3)}</label>)}</div></fieldset>}

            <div className="mt-4 space-y-3">{(editingEntry ? [editingEntry.day] : form.days).map(day => <label key={day} className="label flex items-center justify-between gap-4"><span>{DAYS.find(item => item.value === Number(day))?.label} time</span><select className="input max-w-xs" value={form.daySlots[day] || 1} onChange={event => setDaySlot(day, event.target.value)}>{SLOT_OPTIONS.filter(([value]) => !isLab || LAB_START_SLOTS.includes(value)).map(([value, label]) => <option key={value} value={value}>{isLab ? `${slotLabel(value).split(' - ')[0]} - ${slotLabel(value + 1).split(' - ')[1]}` : label}</option>)}</select></label>)}</div>

            <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>{editingEntry && <button type="button" onClick={handleDelete} disabled={saving} className="btn-danger"><Trash2 className="h-4 w-4" />Delete</button>}<button type="submit" disabled={saving || !form.subject} className="btn-primary">{saving ? 'Saving...' : <><Pencil className="h-4 w-4" />Save</>}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
