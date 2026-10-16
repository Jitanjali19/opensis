import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Pencil, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import TimetableGrid from '../../components/TimetableGrid';

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
const currentYear = new Date().getFullYear();
const defaultAcademicYear = `${currentYear}-${currentYear + 1}`;

const emptyForm = (day = 1, startSlot = 1) => ({
  subject: '',
  faculty: '',
  room: '',
  batch: '',
  days: [day],
  daySlots: { [day]: startSlot },
});

export default function ManageTimetable() {
  const [options, setOptions] = useState({ sections: [], subjects: [], rooms: [], faculty: [] });
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [semester, setSemester] = useState(5);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState([]);

  const selectedSection = options.sections.find(section => section._id === sectionId);
  const selectedSubject = options.subjects.find(subject => subject._id === form.subject);
  const isLab = selectedSubject?.type === 'lab';

  const filteredSubjects = useMemo(() => options.subjects.filter(subject => {
    if (!selectedSection) return true;
    return (!subject.branch || subject.branch === selectedSection.department) && (!subject.semester || subject.semester === Number(semester));
  }), [options.subjects, selectedSection, semester]);

  const departments = [...new Set(options.sections.map(section => section.department))].sort();
  const years = [...new Set(options.sections.filter(section => !department || section.department === department).map(section => section.year))].sort((a, b) => a - b);
  const visibleSections = options.sections.filter(section => (!department || section.department === department) && (!year || String(section.year) === String(year)));
  const academicYears = Array.from({ length: 5 }, (_, index) => `${currentYear - 2 + index}-${currentYear - 1 + index}`);

  const loadEntries = async () => {
    if (!sectionId) return;
    const { data } = await api.get(`/timetable/section/${sectionId}`, { params: { academicYear, semester } });
    setEntries(data.data.entries || []);
  };

  useEffect(() => {
    api.get('/timetable/options').then(({ data }) => {
      const next = data.data;
      setOptions(next);
      if (next.sections?.[0]) {
        setDepartment(next.sections[0].department);
        setYear(String(next.sections[0].year));
        setSectionId(next.sections[0]._id);
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (sectionId) loadEntries().catch(() => toast.error('Failed to load timetable'));
  }, [sectionId, academicYear, semester]);

  useEffect(() => {
    if (!visibleSections.some(section => section._id === sectionId)) setSectionId(visibleSections[0]?._id || '');
  }, [department, year, options.sections]);

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
      room: entry.room?._id || entry.room,
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

  const handleSubjectChange = subject => setForm(current => ({ ...current, subject, batch: '' }));

  const handleSave = async event => {
    event.preventDefault();
    setConflicts([]);
    const days = editingEntry ? [editingEntry.day] : form.days;
    const payloadEntries = days.map(day => ({
      section: sectionId,
      subject: form.subject,
      faculty: form.faculty,
      room: form.room,
      batch: isLab ? (form.batch || null) : null,
      day,
      startSlot: Number(form.daySlots[day]),
      slotCount: isLab ? 2 : 1,
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
          <h1 className="mt-1 text-2xl font-bold text-slate-800">Manage Timetable</h1>
        </div>
        <button type="button" onClick={() => openCreate()} className="btn-primary"><Plus className="h-4 w-4" />Add class</button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <label className="label">Department<select className="input mt-1" value={department} onChange={event => { setDepartment(event.target.value); setYear(''); }}><option value="">All departments</option>{departments.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="label">Year<select className="input mt-1" value={year} onChange={event => setYear(event.target.value)}><option value="">All years</option>{years.map(value => <option key={value} value={value}>Year {value}</option>)}</select></label>
        <label className="label">Section<select className="input mt-1" value={sectionId} onChange={event => setSectionId(event.target.value)}>{visibleSections.map(section => <option key={section._id} value={section._id}>{section.sectionName}</option>)}</select></label>
        <label className="label">Academic Year<select className="input mt-1" value={academicYear} onChange={event => setAcademicYear(event.target.value)}>{academicYears.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="label">Semester<select className="input mt-1" value={semester} onChange={event => setSemester(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6, 7, 8].map(value => <option key={value} value={value}>Semester {value}</option>)}</select></label>
        <div className="flex items-end text-sm text-slate-500">{entries.length} scheduled {entries.length === 1 ? 'class' : 'classes'}</div>
      </div>

      <TimetableGrid entries={entries} mode="admin" onEmptyCell={openCreate} onEntryClick={openEdit} />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSave} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold text-slate-800">{editingEntry ? 'Edit timetable entry' : 'Add timetable class'}</h2><p className="mt-1 text-sm text-slate-500">{selectedSection?.department} · {selectedSection?.sectionName} · Semester {semester}</p></div><button type="button" onClick={closeModal} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>

            {conflicts.length > 0 && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><p className="font-semibold">Could not save timetable:</p>{conflicts.map((message, index) => <p key={`${message}-${index}`} className="mt-1">{message}</p>)}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="label sm:col-span-2">Subject<select required className="input mt-1" value={form.subject} onChange={event => handleSubjectChange(event.target.value)}><option value="">Select subject</option>{filteredSubjects.map(subject => <option key={subject._id} value={subject._id}>{subject.code} · {subject.name} ({subject.type})</option>)}</select></label>
              <label className="label">Faculty<select required className="input mt-1" value={form.faculty} onChange={event => setForm(current => ({ ...current, faculty: event.target.value }))}><option value="">Select faculty</option>{options.faculty.map(faculty => <option key={faculty._id} value={faculty._id}>{faculty.name}</option>)}</select></label>
              <label className="label">Room<select required className="input mt-1" value={form.room} onChange={event => setForm(current => ({ ...current, room: event.target.value }))}><option value="">Select room</option>{options.rooms.filter(room => !selectedSubject || room.type === (isLab ? 'lab' : 'classroom')).map(room => <option key={room._id} value={room._id}>{room.name} ({room.type})</option>)}</select></label>
              <label className="label">Batch<select className="input mt-1" value={isLab ? form.batch : ''} disabled={!isLab} required={isLab} onChange={event => setForm(current => ({ ...current, batch: event.target.value }))}><option value="">{isLab ? 'Select batch' : 'All students'}</option>{isLab && selectedSection?.batches.map(batch => <option key={batch} value={batch}>{batch}</option>)}</select></label>
              <div className="label">Duration<div className="input mt-1 bg-slate-100">{isLab ? '2 consecutive slots (lab)' : '1 slot (theory)'}</div></div>
            </div>

            {!editingEntry && <fieldset className="mt-5 rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-semibold text-slate-700">Repeat on days</legend><div className="grid gap-2 sm:grid-cols-5">{DAYS.map(day => <label key={day.value} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.days.includes(day.value)} onChange={() => toggleDay(day.value)} />{day.label.slice(0, 3)}</label>)}</div></fieldset>}

            <div className="mt-4 space-y-3">{(editingEntry ? [editingEntry.day] : form.days).map(day => <label key={day} className="label flex items-center justify-between gap-4"><span>{DAYS.find(item => item.value === Number(day))?.label} time</span><select className="input max-w-xs" value={form.daySlots[day] || 1} onChange={event => setDaySlot(day, event.target.value)}>{SLOT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}{isLab && value === 3 ? ' (not valid for lab)' : ''}</option>)}</select></label>)}</div>

            <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>{editingEntry && <button type="button" onClick={handleDelete} disabled={saving} className="btn-danger"><Trash2 className="h-4 w-4" />Delete</button>}<button type="submit" disabled={saving || !form.subject} className="btn-primary">{saving ? 'Saving...' : <><Pencil className="h-4 w-4" />Save</>}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
