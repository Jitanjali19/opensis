import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Bell, CreditCard, CalendarCheck, ArrowRight, AlertCircle, AlertTriangle } from 'lucide-react';
import TodayClasses from '../../components/TodayClasses';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [notices, setNotices] = useState([]);
  const [fees, setFees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    api.get('/student/notices').then(r => setNotices(r.data.data.notices.slice(0, 3)));
    api.get('/student/fees').then(r => setFees(r.data.data.fees));
    api.get('/student/attendance').then(r => setAttendance(r.data.data.attendance));
    api.get('/student/assignments').then(r => setAssignments(r.data.data.assignments));
  }, []);

  const totalClasses = attendance.reduce((a, s) => a + s.total, 0);
  const presentClasses = attendance.reduce((a, s) => a + s.present, 0);
  const attendancePct = totalClasses ? Math.round((presentClasses / totalClasses) * 100) : 0;
  const unpaidFees = fees.filter(f => f.status === 'pending').length;
  const pendingAssignments = assignments.filter(a => !a.mySubmission || a.mySubmission.resubmissionRequested).length;
  const resubmitCount = assignments.filter(a => a.mySubmission?.resubmissionRequested).length;

  const overdueCount = assignments.filter(a => {
    if (a.mySubmission && !a.mySubmission.resubmissionRequested) return false;
    if (a.isClosed) return false;
    return new Date(a.dueDate) < new Date();
  }).length;

  const dueSoonCount = assignments.filter(a => {
    if (a.mySubmission && !a.mySubmission.resubmissionRequested) return false;
    if (a.isClosed) return false;
    const timeDiff = new Date(a.dueDate) - new Date();
    return timeDiff > 0 && timeDiff <= 3 * 24 * 60 * 60 * 1000;
  }).length;

  const newAssignments = assignments.filter(a => {
    if (a.mySubmission) return false;
    if (a.isClosed) return false;
    const isNew = (new Date() - new Date(a.createdAt)) <= 7 * 24 * 60 * 60 * 1000;
    return isNew;
  }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3);

  const getAttendanceColor = (pct) => {
    if (pct >= 75) return 'bg-green-500';
    if (pct >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const stats = [
    { label: 'Attendance', value: `${attendancePct}%`, icon: CalendarCheck, color: totalClasses ? getAttendanceColor(attendancePct) : 'bg-slate-500', link: '/student/attendance' },
    { label: 'Pending Assignments', value: pendingAssignments, icon: BookOpen, color: 'bg-amber-500', link: '/student/assignments' },
    { label: 'Unpaid Fees', value: unpaidFees, icon: CreditCard, color: 'bg-rose-500', link: '/student/fees' },
    { label: 'Notices', value: notices.length, icon: Bell, color: 'bg-indigo-500', link: '/student/notices' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          Welcome, {user?.profile?.firstName}! 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {user?.profile?.branch} · Semester {user?.profile?.currentSemester} · Section {user?.profile?.section}
        </p>
      </div>

      {/* Attendance Warning/Detention Banners */}
      {totalClasses > 0 && attendancePct < 60 && (
        <div className="p-4 rounded-lg mb-6 border border-red-200 bg-red-50 text-red-800 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5.5 h-5.5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-950 text-sm">Attendance Detention Alert</h4>
            <p className="text-xs mt-0.5 font-medium">
              Your overall attendance is <span className="font-bold text-red-700">{attendancePct}%</span>, which is below the required 60% threshold. You have been detained and will not be allowed to appear in exams.
            </p>
            <Link to="/student/attendance" className="text-xs font-semibold text-red-950 underline mt-1.5 inline-block hover:text-red-900">
              View Attendance Breakdown →
            </Link>
          </div>
        </div>
      )}

      {totalClasses > 0 && attendancePct >= 60 && attendancePct < 75 && (
        <div className="p-4 rounded-lg mb-6 border border-amber-200 bg-amber-50 text-amber-800 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5.5 h-5.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-950 text-sm">Attendance Warning</h4>
            <p className="text-xs mt-0.5 font-medium">
              Your overall attendance is <span className="font-bold text-amber-700">{attendancePct}%</span>, which is below the 75% requirement. Please maintain your attendance to avoid detention.
            </p>
            <Link to="/student/attendance" className="text-xs font-semibold text-amber-950 underline mt-1.5 inline-block hover:text-amber-900">
              View Attendance Breakdown →
            </Link>
          </div>
        </div>
      )}

      {/* Resubmission Alert Banner */}
      {resubmitCount > 0 && (
        <div className="p-4 rounded-lg mb-6 border border-amber-200 bg-amber-50 text-amber-800 flex items-start gap-3 shadow-sm animate-pulse">
          <AlertTriangle className="w-5.5 h-5.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-900 text-sm">Resubmission Requested</h4>
            <p className="text-xs mt-0.5">
              Faculty has requested a revision for <span className="font-bold">{resubmitCount} assignment(s)</span>. Please review feedback and resubmit your files.
            </p>
            <Link to="/student/assignments" className="text-xs font-semibold text-amber-950 underline mt-1.5 inline-block hover:text-amber-900">
              Go to Assignments to Resubmit →
            </Link>
          </div>
        </div>
      )}

      {/* Overdue Alert Banner */}
      {overdueCount > 0 && (
        <div className="p-4 rounded-lg mb-6 border border-rose-200 bg-rose-50 text-rose-800 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5.5 h-5.5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-rose-900 text-sm">Overdue Assignments Warning</h4>
            <p className="text-xs mt-0.5">
              You have <span className="font-bold">{overdueCount} overdue assignment(s)</span> that need your attention. Please submit them immediately.
            </p>
            <Link to="/student/assignments" className="text-xs font-semibold text-rose-950 underline mt-1.5 inline-block hover:text-rose-900">
              Go to Assignments →
            </Link>
          </div>
        </div>
      )}

      {/* Upcoming Deadlines Banner */}
      {dueSoonCount > 0 && (
        <div className="p-4 rounded-lg mb-6 border border-amber-200 bg-amber-50 text-amber-800 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5.5 h-5.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-900 text-sm">Upcoming Deadlines</h4>
            <p className="text-xs mt-0.5">
              You have <span className="font-bold">{dueSoonCount} assignment(s)</span> due within the next 3 days. Don't forget to submit before the deadline!
            </p>
            <Link to="/student/assignments" className="text-xs font-semibold text-amber-950 underline mt-1.5 inline-block hover:text-amber-900">
              Submit Assignments →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary-600 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Today's Classes */}
      <div className="mb-6">
        <TodayClasses role="student" timetablePath="/student/timetable" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Notices Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Recent Notices</h2>
            <Link to="/student/notices" className="text-sm text-primary-600 hover:underline">View all →</Link>
          </div>
          {notices.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No notices</p>
          ) : (
            <div className="space-y-3">
              {notices.map(n => (
                <div key={n._id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New Assignments Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Bell className="w-4.5 h-4.5 text-primary-600" /> New Assignments
            </h2>
            <Link to="/student/assignments" className="text-sm text-primary-600 hover:underline">View all →</Link>
          </div>
          {newAssignments.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">No new assignments in the last 7 days</p>
          ) : (
            <div className="space-y-4">
              {['class', 'lab'].map(type => {
                const typeAssignments = newAssignments.filter(a => (a.itemType || 'class') === type);
                if (!typeAssignments.length) return null;
                return (
                  <div key={type}>
                    <h3 className={`text-xs font-bold uppercase tracking-wide mb-2 ${type === 'lab' ? 'text-amber-700' : 'text-primary-700'}`}>
                      {type === 'lab' ? 'Lab Assignments' : 'Class Assignments'}
                    </h3>
                    <div className="space-y-2">
                      {typeAssignments.map(a => (
                        <Link key={a._id} to="/student/assignments" className="block p-3 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100 rounded-lg group shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-800 group-hover:text-primary-600 transition-colors">{a.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{type === 'lab' ? a.labId?.code : a.subjectId?.code} — {type === 'lab' ? a.labId?.name : a.subjectId?.name}</p>
                            </div>
                            <span className="text-[10px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded border border-primary-100 font-semibold self-start flex-shrink-0">New</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2 font-medium">Due: {new Date(a.dueDate).toLocaleDateString()}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
