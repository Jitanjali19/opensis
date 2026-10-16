import React from 'react';
import { TIMETABLE_SLOTS } from '../constants/timetableSlots';

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
];

const ROWS = [
  { key: 1, label: TIMETABLE_SLOTS[1].label },
  { key: 2, label: TIMETABLE_SLOTS[2].label },
  { key: 3, label: TIMETABLE_SLOTS[3].label },
  { key: 'lunch', label: '12:00 PM - 1:00 PM' },
  { key: 4, label: TIMETABLE_SLOTS[4].label },
  { key: 5, label: TIMETABLE_SLOTS[5].label },
  { key: 6, label: TIMETABLE_SLOTS[6].label },
  { key: 7, label: TIMETABLE_SLOTS[7].label },
];

const entryStart = entry => Number(entry.startSlot || entry.slots?.[0]);
const entryEnd = entry => entryStart(entry) + Number(entry.slotCount || entry.slots?.length || 1) - 1;
const YEAR_LABELS = ['', 'I', 'II', 'III', 'IV'];

const sectionLabel = section => {
  if (!section) return 'Section unavailable';
  return `${section.department || ''} ${YEAR_LABELS[section.year] || section.year || ''}-${section.sectionName || ''}`.trim();
};
const roomLabel = room => room?.displayName || room?.name || (room?.building && room?.roomNo ? `${room.building}-${room.roomNo}` : 'Room unavailable');

function EntryCard({ entry, mode, onClick }) {
  const faculty = entry.facultyName || entry.faculty?.email || 'Faculty unavailable';
  const room = roomLabel(entry.room);
  const subject = entry.subject?.code || entry.subject?.name || 'Subject';
  const batch = entry.batch || (mode === 'faculty' ? '' : 'All students');
  return (
    <button type="button" onClick={onClick} className="min-w-0 flex-1 rounded-lg border border-primary-100 bg-primary-50 px-2 py-2 text-left hover:border-primary-300 hover:bg-primary-100">
      <span className="block truncate text-xs font-bold text-primary-800">{subject}</span>
      <span className="block truncate text-[11px] text-slate-600">{mode === 'faculty' ? sectionLabel(entry.section) : faculty}</span>
      {batch && <span className="block truncate text-[11px] text-slate-500">{batch}</span>}
      <span className="block truncate text-[11px] text-slate-500">{room}</span>
    </button>
  );
}

export default function TimetableGrid({ entries = [], mode = 'student', onEmptyCell, onEntryClick }) {
  const byDay = DAYS.reduce((result, day) => {
    result[day.value] = entries.filter(entry => Number(entry.day) === day.value);
    return result;
  }, {});

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[980px] w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="w-40 px-4 py-3 text-left font-semibold">Time</th>
            {DAYS.map(day => <th key={day.value} className="px-3 py-3 text-left font-semibold">{day.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(row => {
            if (row.key === 'lunch') {
              return (
                <tr key={row.key} className="bg-slate-100 text-slate-500">
                  <th className="border-t border-slate-200 px-4 py-4 text-left text-xs font-semibold">{row.label}</th>
                  <td colSpan={5} className="border-t border-slate-200 px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider">Lunch · No classes</td>
                </tr>
              );
            }

            return (
              <tr key={row.key} className="align-top">
                <th className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-medium text-slate-600">{row.label}</th>
                {DAYS.map(day => {
                  const dayEntries = byDay[day.value];
                  const startsHere = dayEntries.filter(entry => entryStart(entry) === row.key);
                  const coveredByPrevious = dayEntries.some(entry => entryStart(entry) < row.key && entryEnd(entry) >= row.key);
                  if (coveredByPrevious) return null;

                  const rowSpan = Math.max(1, ...startsHere.map(entry => Number(entry.slotCount || entry.slots?.length || 1)));
                  return (
                    <td key={day.value} rowSpan={rowSpan} className="border-l border-t border-slate-200 p-2">
                      {startsHere.length ? (
                        <div className="flex min-h-20 gap-1">
                          {startsHere.map(entry => <EntryCard key={entry._id} entry={entry} mode={mode} onClick={() => onEntryClick?.(entry)} />)}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={mode !== 'admin'}
                          onClick={() => onEmptyCell?.(day.value, row.key)}
                          className={`min-h-20 w-full rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 ${mode === 'admin' ? 'hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600' : 'cursor-default'}`}
                        >
                          {mode === 'admin' ? 'Add class' : 'Free'}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
