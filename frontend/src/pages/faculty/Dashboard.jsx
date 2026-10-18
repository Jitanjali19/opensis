import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Bell, ClipboardCheck, FileText, BarChart3, ArrowRight } from 'lucide-react';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    api.get('/faculty/subjects').then(r => setSubjects(r.data.data.subjects)).catch(() => {});
    api.get('/faculty/notices').then(r => setNotices(r.data.data.notices.slice(0, 3))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          Welcome, Prof. {user?.profile?.firstName}! 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {user?.profile?.department} Department · {user?.profile?.designation}
        </p>
        <p className="mt-3 max-w-2xl rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-xs text-primary-800">Use the shortcuts below to complete your daily teaching work quickly.</p>
      </div>

      <section className="mb-8">
        <div className="mb-3"><h2 className="font-semibold text-slate-800">What do I need to do today?</h2><p className="mt-1 text-xs text-slate-500">Open the task you want to complete.</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ['/faculty/marks', 'Upload marks', 'Enter or upload marks for your subjects.', BarChart3],
            ['/faculty/attendance', 'Mark attendance', 'Record attendance for today’s class.', ClipboardCheck],
            ['/faculty/assignments', 'Check assignments', 'Create assignments and review submissions.', FileText],
          ].map(([link, title, description, Icon]) => <Link key={link} to={link} className="group flex min-h-[120px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary-300 hover:bg-primary-50/50"><Icon className="mb-3 h-5 w-5 text-primary-600" /><span className="flex items-center justify-between text-sm font-semibold text-slate-800">{title}<ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary-600" /></span><span className="mt-1 text-xs text-slate-500">{description}</span></Link>)}
        </div>
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 mb-8 sm:grid-cols-2">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{subjects.length}</p>
              <p className="text-xs text-slate-500">Subjects assigned to me</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-500 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{notices.length}</p>
              <p className="text-xs text-slate-500">Recent notices</p>
            </div>
          </div>
        </div>
      </div>

      {/* My Subjects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> My Subjects
          </h2>
          <p className="mb-4 text-xs text-slate-500">Subjects currently assigned to you.</p>
          {subjects.length === 0 ? (
            <div className="py-6 text-center"><BookOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="font-medium text-slate-700">No subjects assigned</p><p className="mt-1 text-sm text-slate-500">Your assigned subjects will appear here.</p></div>
          ) : (
            <div className="space-y-3">
              {subjects.map(s => (
                <div key={s._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.code} · {s.branch} · Sem {s.semester}</p>
                  </div>
                  <span className="badge-blue">{s.credits} Cr</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Recent Notices */}
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Recent Notices
        </h2>
        <p className="mb-4 text-xs text-slate-500">Important updates from the institution.</p>
        {notices.length === 0 ? (
          <div className="py-6 text-center"><Bell className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="font-medium text-slate-700">No notices right now</p><p className="mt-1 text-sm text-slate-500">New notices will appear here.</p></div>
        ) : (
          <div className="space-y-3">
            {notices.map(n => (
              <div key={n._id} className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-slate-800">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{n.body?.slice(0, 100)}{n.body?.length > 100 ? '...' : ''}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
