import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import TimetableGrid from '../../components/TimetableGrid';
import { TIMETABLE_SLOTS } from '../../constants/timetableSlots';
import { downloadTimetablePdf } from '../../utils/downloadTimetablePdf';

const dayNumber = new Date().getDay();
const formatTime = value => value || '';
const sectionLabel = section => {
  const years = ['', 'I', 'II', 'III', 'IV'];
  if (!section) return 'Section unavailable';
  return `${section.department || ''} ${years[section.year] || section.year || ''}-${section.sectionName || ''}`.trim();
};

function todayLabel(entry) {
  const start = Number(entry.startSlot || entry.slots?.[0]);
  const end = start + Number(entry.slotCount || entry.slots?.length || 1) - 1;
  return `${formatTime(TIMETABLE_SLOTS[start]?.start)}-${formatTime(TIMETABLE_SLOTS[end]?.end)}`;
}

export default function FacultyTimetable() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/timetable/me/faculty')
      .then(({ data }) => setEntries(data.data.entries || []))
      .catch(() => toast.error('Failed to load timetable'))
      .finally(() => setLoading(false));
  }, []);

  const todayEntries = useMemo(() => {
    if (dayNumber === 0 || dayNumber === 6) return [];
    return entries.filter(entry => Number(entry.day) === dayNumber).sort((a, b) => Number(a.startSlot) - Number(b.startSlot));
  }, [entries]);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-50 p-3 text-primary-700"><CalendarDays className="h-6 w-6" /></div>
          <div>
          <h1 className="text-2xl font-bold text-slate-800">My Timetable</h1>
          <p className="mt-1 text-sm text-slate-500">Your assigned classes for the week</p>
          </div>
        </div>
        <button type="button" onClick={() => downloadTimetablePdf().catch(() => toast.error('Failed to download timetable PDF'))} className="btn-secondary"><Download className="h-4 w-4" />Download PDF</button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Aaj ki classes</h2>
        {todayEntries.length ? (
          <div className="divide-y divide-slate-100">
            {todayEntries.map(entry => (
              <div key={entry._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm text-slate-700">
                <span className="font-semibold text-primary-700">{todayLabel(entry)}</span>
                <span>|</span>
                <span className="font-semibold">{entry.subject?.code || entry.subject?.name}</span>
                <span>|</span>
                <span>{sectionLabel(entry.section)}</span>
                {entry.batch && <><span>|</span><span>{entry.batch}</span></>}
                <span>|</span>
                <span>{entry.room?.name || 'Room unavailable'}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">Aaj class nahi hai</p>}
      </section>

      <TimetableGrid entries={entries} mode="faculty" />
    </div>
  );
}
