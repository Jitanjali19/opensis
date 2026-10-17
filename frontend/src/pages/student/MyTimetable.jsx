import React, { useEffect, useState } from 'react';
import { CalendarDays, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import TimetableGrid from '../../components/TimetableGrid';
import { downloadTimetablePdf } from '../../utils/downloadTimetablePdf';

export default function MyTimetable() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/timetable/me/student')
      .then(({ data }) => setEntries(data.data.entries || []))
      .catch(() => toast.error('Failed to load timetable'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 p-3 text-primary-700"><CalendarDays className="h-6 w-6" /></div>
          <div>
          <h1 className="text-2xl font-bold text-slate-800">My Timetable</h1>
          <p className="mt-1 text-sm text-slate-500">Your weekly classes, including your assigned batch labs</p>
          </div>
        </div>
        <button type="button" onClick={() => downloadTimetablePdf().catch(() => toast.error('Failed to download timetable PDF'))} className="btn-secondary"><Download className="h-4 w-4" />Download PDF</button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <CalendarDays className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="font-medium text-slate-600">Timetable abhi publish nahi hua</p>
        </div>
      ) : (
        <TimetableGrid entries={entries} mode="student" />
      )}
    </div>
  );
}
