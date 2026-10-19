import React, { useEffect, useState } from 'react';
import { CalendarDays, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import TimetableGrid from '../../components/TimetableGrid';
import { downloadTimetablePdf } from '../../utils/downloadTimetablePdf';
import { TIMETABLE_MESSAGES } from '../../constants/timetableMessages';

export default function MyTimetable() {
  const [entries, setEntries] = useState([]);
  const [availableAcademicYears, setAvailableAcademicYears] = useState([]);
  const [availableSemesters, setAvailableSemesters] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [studentBatch, setStudentBatch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTimetable = async (academicYear = selectedAcademicYear, semester = selectedSemester) => {
    const params = {};
    if (academicYear) params.academicYear = academicYear;
    if (semester) params.semester = semester;
    const { data } = await api.get('/timetable/me/student', { params });
    const timetable = data.data;
    setEntries(timetable.entries || []);
    setAvailableAcademicYears(timetable.availableAcademicYears || []);
    setAvailableSemesters(timetable.availableSemesters || []);
    setSelectedAcademicYear(timetable.selectedAcademicYear || '');
    setSelectedSemester(timetable.selectedSemester ? String(timetable.selectedSemester) : '');
    setStudentBatch(timetable.student?.batch || '');
  };

  useEffect(() => {
    loadTimetable().catch(() => toast.error('Failed to load timetable')).finally(() => setLoading(false));
  }, []);

  const changeYear = year => {
    setSelectedAcademicYear(year);
    setSelectedSemester('');
    loadTimetable(year, '').catch(() => toast.error('Failed to load timetable'));
  };
  const changeSemester = semester => {
    setSelectedSemester(semester);
    loadTimetable(selectedAcademicYear, semester).catch(() => toast.error('Failed to load timetable'));
  };
  const alternateYear = availableAcademicYears.find(year => year !== selectedAcademicYear);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-primary-50 p-3 text-primary-700"><CalendarDays className="h-6 w-6" /></div><div><h1 className="text-2xl font-bold text-slate-800">My Timetable</h1><p className="mt-1 text-sm text-slate-500">Your weekly classes and all labs for your section</p></div></div>
        <button type="button" onClick={() => downloadTimetablePdf({ academicYear: selectedAcademicYear, semester: selectedSemester }).catch(() => toast.error('Failed to download timetable PDF'))} className="btn-secondary"><Download className="h-4 w-4" />Download PDF</button>
      </div>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <label className="label">Academic Year<select className="input mt-1" value={selectedAcademicYear} onChange={event => changeYear(event.target.value)}><option value="">Select academic year</option>{availableAcademicYears.map(year => <option key={year} value={year}>{year}</option>)}</select></label>
        <label className="label">Semester<select className="input mt-1" value={selectedSemester} onChange={event => changeSemester(event.target.value)}><option value="">All semesters</option>{availableSemesters.map(semester => <option key={semester} value={semester}>Semester {semester}</option>)}</select></label>
      </div>
      {!entries.length && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{TIMETABLE_MESSAGES.NO_CLASSES_ASSIGNED}{alternateYear && TIMETABLE_MESSAGES.CLASSES_IN_ALTERNATE_YEAR(alternateYear)}</div>}
      {!studentBatch && <p className="text-xs text-slate-500">{TIMETABLE_MESSAGES.BATCH_MISSING_NOTICE}</p>}
      <TimetableGrid entries={entries} mode="student" studentBatch={studentBatch} />
    </div>
  );
}
