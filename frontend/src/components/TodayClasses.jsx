import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Sunset,
} from 'lucide-react';
import api from '../api/axios';
import slotConfig from '../../../shared/timetableSlots.json';
import { TIMETABLE_MESSAGES } from '../constants/timetableMessages';
import { useAuth } from '../context/AuthContext';

// ─── Slot helpers ─────────────────────────────────────────────────────────────
const SLOTS = slotConfig.slots;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toMin = (hhmm) => {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

const fmt12 = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
};

const entryTimes = (entry) => {
  const startSlot = Number(entry.startSlot || entry.slots?.[0]);
  const slotCount = Number(entry.slotCount || entry.slots?.length || 1);
  const endSlot = startSlot + slotCount - 1;
  const start = SLOTS[startSlot]?.start || '';
  const end = SLOTS[endSlot]?.end || '';
  return { start, end, startMin: toMin(start), endMin: toMin(end) };
};

const timeRange = (entry) => {
  const { start, end } = entryTimes(entry);
  return `${fmt12(start)} \u2013 ${fmt12(end)}`;
};

const nowIST = () => {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ist.getHours() * 60 + ist.getMinutes();
};

const classStatus = (entry, isFirst) => {
  const { startMin, endMin } = entryTimes(entry);
  const now = nowIST();
  if (now >= startMin && now < endMin) return 'ongoing';
  if (now >= endMin) return 'done';
  if (isFirst) return 'next';
  return 'upcoming';
};

const sectionLabel = (section) => {
  if (!section) return '';
  const yrs = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  return `${section.department || ''} ${yrs[section.year] || section.year || ''} Yr - ${section.sectionName || ''}`.trim();
};

const nextClassMsg = (nextClass) => {
  if (!nextClass) return null;
  const { start } = entryTimes(nextClass);
  return TIMETABLE_MESSAGES.NEXT_CLASS(DAYS[nextClass.day] || '', fmt12(start));
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ongoing: {
    badge: 'Ongoing',
    badgeCls: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    rowCls: 'bg-emerald-50 border-l-4 border-l-emerald-500',
    timeCls: 'text-emerald-700 font-bold',
  },
  done: {
    badge: 'Done',
    badgeCls: 'bg-slate-100 text-slate-400 border border-slate-200',
    rowCls: 'opacity-50',
    timeCls: 'text-slate-400 font-medium',
  },
  next: {
    badge: 'Next',
    badgeCls: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    rowCls: 'border-l-4 border-l-indigo-400',
    timeCls: 'text-indigo-700 font-semibold',
  },
  upcoming: {
    badge: null,
    badgeCls: '',
    rowCls: '',
    timeCls: 'text-slate-600 font-medium',
  },
};

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 py-3 px-4 animate-pulse">
      <div className="h-4 w-28 rounded bg-slate-200 flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="h-3 w-24 rounded bg-slate-100" />
      </div>
      <div className="h-5 w-16 rounded-full bg-slate-200 flex-shrink-0" />
    </div>
  );
}

export default function TodayClasses({ role = 'faculty', timetablePath = '/faculty/timetable' }) {
  const { selectedSession, selectedTerm } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setTick] = useState(0);
  const timerRef = useRef(null);

  const fetchToday = useCallback(async () => {
    setError(null);
    try {
      const { data: res } = await api.get('/timetable/me/today');
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || TIMETABLE_MESSAGES.LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchToday();
  }, [fetchToday, selectedSession, selectedTerm]);

  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timerRef.current);
  }, []);

  const dateHeader = (() => {
    if (!data) return '';
    try {
      const d = new Date(data.date + 'T00:00:00+05:30');
      return d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return data.dayName || '';
    }
  })();

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary-600" />
            <span className="font-semibold text-slate-800 text-sm">{TIMETABLE_MESSAGES.TODAY_CLASSES}</span>
          </div>
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 shadow-sm p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">{TIMETABLE_MESSAGES.LOAD_FAILED_HEADING}</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <button
              type="button"
              onClick={() => { setLoading(true); fetchToday(); }}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {TIMETABLE_MESSAGES.RETRY}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { dayName, isWeekend, entries = [], batchMissing, nextClass } = data;

  if (isWeekend) {
    const nextMsg = nextClassMsg(nextClass);
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary-600" />
            <span className="font-semibold text-slate-800 text-sm">{TIMETABLE_MESSAGES.TODAY_CLASSES}</span>
          </div>
          <span className="text-xs text-slate-400">{dateHeader}</span>
        </div>
        <div className="flex flex-col items-center justify-center py-10 px-5 text-center gap-3">
          <Sunset className="w-10 h-10 text-amber-400" />
          <div>
            <p className="font-semibold text-slate-700">{TIMETABLE_MESSAGES.TODAY_HOLIDAY}</p>
            {nextMsg ? (
              <p className="text-xs text-slate-500 mt-1">{nextMsg}</p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">{TIMETABLE_MESSAGES.NO_CLASSES_WEEKEND(dayName)}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!entries.length) {
    const nextMsg = nextClassMsg(nextClass);
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary-600" />
            <span className="font-semibold text-slate-800 text-sm">{TIMETABLE_MESSAGES.TODAY_CLASSES}</span>
          </div>
          <span className="text-xs text-slate-400">{dateHeader}</span>
        </div>
        <div className="flex flex-col items-center justify-center py-10 px-5 text-center gap-2">
          <Clock className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">{TIMETABLE_MESSAGES.NO_CLASSES_TODAY}</p>
          {nextMsg && <p className="text-xs text-slate-400">{nextMsg}</p>}
        </div>
        <div className="px-5 pb-4 text-right">
          <Link to={timetablePath} className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1">
            {TIMETABLE_MESSAGES.VIEW_FULL_TIMETABLE} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const upcomingEntries = entries
    .filter((e) => classStatus(e, false) !== 'done')
    .sort((a, b) => entryTimes(a).startMin - entryTimes(b).startMin);
  const firstUpcoming = upcomingEntries[0] || null;

  const enriched = entries.map((entry) => {
    const isFirst = firstUpcoming && entry._id === firstUpcoming._id;
    return { entry, status: classStatus(entry, isFirst) };
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary-600" />
          <span className="font-semibold text-slate-800 text-sm">
            {TIMETABLE_MESSAGES.TODAY_CLASSES}
            <span className="text-slate-400 font-normal ml-1.5 hidden sm:inline">
              &mdash; {dateHeader}
            </span>
          </span>
        </div>
        <span className="text-xs text-slate-400 sm:hidden">{dateHeader}</span>
      </div>

      {batchMissing && (
        <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
          <span>{TIMETABLE_MESSAGES.BATCH_MISSING_NOTICE}</span>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {enriched.map(({ entry, status }) => {
          const cfg = STATUS_CONFIG[status];
          const isLab = entry.subjectType === 'Lab' || entry.subject?.type === 'lab';
          const subjectCode = entry.subject?.code || '';
          const subjectName = entry.subject?.name || '';
          const roomLabel = entry.room
            ? `${entry.room.building || ''}-${entry.room.roomNo || entry.room.name || ''}`.replace(/^-/, '')
            : '';

          return (
            <div
              key={entry._id}
              className={`flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 px-4 py-3 transition-colors ${cfg.rowCls}`}
            >
              <span className={`text-xs flex-shrink-0 w-full sm:w-36 ${cfg.timeCls}`}>
                {timeRange(entry)}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {isLab && (
                    <span className="inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                      LAB
                    </span>
                  )}
                  <span className={`text-sm font-semibold ${status === 'done' ? 'text-slate-400' : 'text-slate-800'}`}>
                    {subjectCode}{subjectName && subjectCode && ' \u00b7 '}{subjectName}
                  </span>
                  {isLab && entry.batch && (
                    <span className="text-xs text-slate-500">&middot; Batch {entry.batch}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  {role === 'faculty' && entry.section && (
                    <span className="text-xs text-slate-500">{sectionLabel(entry.section)}</span>
                  )}
                  {role === 'student' && entry.facultyName && (
                    <span className="text-xs text-slate-500">{entry.facultyName}</span>
                  )}
                  {roomLabel && (
                    <span className="text-xs text-slate-400">{roomLabel}</span>
                  )}
                </div>
              </div>

              {cfg.badge && (
                <span className={`self-start sm:self-center inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold flex-shrink-0 ${cfg.badgeCls}`}>
                  {status === 'ongoing' && (
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                  {cfg.badge}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100">
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Auto-updates every minute
        </span>
        <Link
          to={timetablePath}
          className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1 font-medium"
        >
          {TIMETABLE_MESSAGES.VIEW_FULL_TIMETABLE} <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
