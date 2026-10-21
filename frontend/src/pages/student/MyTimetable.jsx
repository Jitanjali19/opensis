import React, { useEffect, useState } from 'react';
import { CalendarDays, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import TimetableGrid from '../../components/TimetableGrid';
import { downloadTimetablePdf } from '../../utils/downloadTimetablePdf';
import { TIMETABLE_MESSAGES } from '../../constants/timetableMessages';
import { useAuth } from '../../context/AuthContext';

export default function MyTimetable() {
  const { selectedSession, selectedTerm } = useAuth();
  const [entries, setEntries] = useState([]);
  const [studentBatch, setStudentBatch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get('/timetable/me/student')
      .then(({ data }) => {
        if (!active) return;
        setEntries(data.data.entries || []);
        setStudentBatch(data.data.student?.batch || '');
      })
      .catch(() => { if (active) toast.error('Failed to load timetable'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedSession, selectedTerm]);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-primary-50 p-3 text-primary-700"><CalendarDays className="h-6 w-6" /></div><div><h1 className="text-2xl font-bold text-slate-800">My Timetable</h1><p className="mt-1 text-sm text-slate-500">Your weekly classes and all labs for your section</p></div></div>
        <button type="button" onClick={() => downloadTimetablePdf().catch(() => toast.error('Failed to download timetable PDF'))} className="btn-secondary"><Download className="h-4 w-4" />Download PDF</button>
      </div>
      {!entries.length && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{TIMETABLE_MESSAGES.NO_CLASSES_ASSIGNED}</div>}
      {!studentBatch && <p className="text-xs text-slate-500">{TIMETABLE_MESSAGES.BATCH_MISSING_NOTICE}</p>}
      <TimetableGrid entries={entries} mode="student" studentBatch={studentBatch} />
    </div>
  );
}
