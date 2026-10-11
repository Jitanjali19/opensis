import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { ClipboardList, TrendingUp, TrendingDown } from 'lucide-react';

export default function StudentAttendance() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/attendance').then(r => {
      setAttendance(r.data.data.attendance);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  const totalClasses = attendance.reduce((a, s) => a + s.total, 0);
  const totalPresent = attendance.reduce((a, s) => a + s.present, 0);
  const overallPct = totalClasses ? Math.round((totalPresent / totalClasses) * 100) : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">Subject-wise attendance breakdown</p>
      </div>

      {/* Overall */}
      <div className="card mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Overall Attendance</p>
            <p className="text-4xl font-bold text-slate-800 mt-1">{overallPct}%</p>
            <p className="text-xs text-slate-400 mt-1">{totalPresent} / {totalClasses} sessions attended</p>
          </div>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            overallPct >= 75 ? 'bg-green-100 text-green-600' : overallPct >= 60 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
          }`}>
            {overallPct >= 75 ? <TrendingUp className="w-8 h-8" /> : <TrendingDown className="w-8 h-8" />}
          </div>
        </div>

        {totalClasses > 0 && overallPct < 60 && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600 font-semibold">❌ You are detained due to low attendance ({overallPct}%). You will not be allowed to appear in exams.</p>
          </div>
        )}

        {totalClasses > 0 && overallPct >= 60 && overallPct < 75 && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700 font-semibold">⚠️ Your attendance is below 75% ({overallPct}%). Please improve and maintain your attendance to avoid detention.</p>
          </div>
        )}
      </div>

      {/* Class and lab-wise */}
      {attendance.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No attendance records yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {attendance.map(a => {
            const pct = a.total ? Math.round((a.present / a.total) * 100) : 0;
            const colors = pct >= 75 
              ? { text: 'text-green-600', bar: 'bg-green-500' }
              : pct >= 60 
                ? { text: 'text-amber-600', bar: 'bg-amber-500' }
                : { text: 'text-red-600', bar: 'bg-red-500' };

            return (
              <div key={`${a.itemType || 'class'}:${a.subject?._id}`} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">{a.subject?.name}</h3>
                    <p className="text-xs text-slate-500">
                      {a.itemType === 'lab' ? 'LAB' : 'CLASS'} · {a.subject?.code}
                    </p>
                  </div>
                  <span className={`text-lg font-bold ${colors.text}`}>{pct}%</span>
                </div>
                {/* Progress bar */}
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
      )}
    </div>
  );
}
