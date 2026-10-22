import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { ClipboardList, TrendingUp, TrendingDown, FlaskConical, BookOpen } from 'lucide-react';

const pctOf = (entry) => (entry.total ? Math.round((entry.present / entry.total) * 100) : 0);

const pctColor = (pct) => (
  pct >= 75
    ? { text: 'text-green-600', bar: 'bg-green-500' }
    : pct >= 60
      ? { text: 'text-amber-600', bar: 'bg-amber-500' }
      : { text: 'text-red-600', bar: 'bg-red-500' }
);

function SummaryCard({ title, summary }) {
  const pct = summary.percentage;
  const colors = pctColor(pct);
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title} Attendance</p>
          <p className={`text-3xl font-bold mt-1 ${colors.text}`}>{pct}%</p>
          <p className="text-xs text-slate-400 mt-1">{summary.present} / {summary.total} sessions attended</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${pct >= 75 ? 'bg-green-100 text-green-600' : pct >= 60 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
          {pct >= 75 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
        </div>
      </div>
      {summary.total > 0 && pct < 75 && (
        <div className={`mt-3 p-3 rounded-lg border ${pct < 60 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-xs font-semibold ${pct < 60 ? 'text-red-600' : 'text-amber-700'}`}>
            {pct < 60
              ? '❌ You are detained due to low attendance. You will not be allowed to appear in exams.'
              : `⚠️ Your attendance is below 75% (${pct}%). Please improve and maintain your attendance to avoid detention.`}
          </p>
        </div>
      )}
    </div>
  );
}

function SubjectList({ items, emptyText }) {
  if (!items.length) {
    return (
      <div className="card text-center py-10">
        <p className="text-slate-500">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {items.map(a => {
        const pct = pctOf(a);
        const colors = pctColor(pct);
        return (
          <div key={`${a.itemType || 'class'}:${a.subject?._id}`} className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-800">{a.subject?.name}</h3>
                <p className="text-xs text-slate-500">
                  {a.itemType === 'lab' ? 'LAB' : 'CLASS'} · {a.subject?.code}
                  {a.batch ? ` · Batch ${a.batch}` : ''}
                </p>
              </div>
              <span className={`text-lg font-bold ${colors.text}`}>{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
              <div className={`h-2.5 rounded-full transition-all ${colors.bar}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Present: {a.present}</span>
              <span>Absent: {a.total - a.present}</span>
              <span>Total: {a.total}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StudentAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/attendance').then(r => {
      setAttendance(r.data.data.attendance || []);
      setSummary(r.data.data.summary || null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  const classItems = attendance.filter(a => a.itemType !== 'lab');
  const labItems = attendance.filter(a => a.itemType === 'lab');
  const fallback = { total: 0, present: 0, absent: 0, percentage: 0 };
  const classSummary = summary?.class || fallback;
  const labSummary = summary?.lab || fallback;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">Subject-wise attendance breakdown</p>
      </div>

      {/* Theory vs Practical summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <SummaryCard title="Theory (Class)" summary={classSummary} />
        <SummaryCard title="Practical (Lab)" summary={labSummary} />
      </div>

      {attendance.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No attendance records yet</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800 mb-3">
              <BookOpen className="w-5 h-5 text-primary-600" /> Theory Classes
            </h2>
            <SubjectList items={classItems} emptyText="No theory attendance recorded yet" />
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800 mb-3">
              <FlaskConical className="w-5 h-5 text-primary-600" /> Practical Labs
            </h2>
            <SubjectList items={labItems} emptyText="No lab attendance recorded yet" />
          </div>
        </div>
      )}
    </div>
  );
}
