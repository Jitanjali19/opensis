import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Bell, FlaskConical, ChevronRight } from 'lucide-react';
import TodayClasses from '../../components/TodayClasses';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [labs, setLabs]       = useState([]);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    api.get('/faculty/subjects')
      .then(r => {
        setClasses(r.data.data.classes || []);
        setLabs(r.data.data.labs || []);
      })
      .catch(() => {});
    api.get('/faculty/notices')
      .then(r => setNotices(r.data.data.notices.slice(0, 3)))
      .catch(() => {});
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
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{classes.length}</p>
            <p className="text-xs text-slate-500">Theory Subjects</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{labs.length}</p>
            <p className="text-xs text-slate-500">Labs</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{notices.length}</p>
            <p className="text-xs text-slate-500">Recent Notices</p>
          </div>
        </div>
      </div>

      {/* Today's Classes */}
      <div className="mb-6">
        <TodayClasses role="faculty" timetablePath="/faculty/timetable" />
      </div>

      {/* My Subjects preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> My Subjects
            </h2>
            <Link to="/faculty/subjects" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {classes.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No theory subjects assigned</p>
          ) : (
            <div className="space-y-2">
              {classes.slice(0, 5).map(s => (
                <div key={s._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{s.code} · {s.branch} · {s.semester === 1 ? 'Sem A' : s.semester === 2 ? 'Sem B' : `Sem ${s.semester}`}</p>
                  </div>
                  <span className="badge-blue ml-2 flex-shrink-0">{s.credits} Cr</span>
                </div>
              ))}
              {classes.length > 5 && (
                <Link to="/faculty/subjects" className="block text-center text-xs text-primary-600 hover:underline pt-1">
                  +{classes.length - 5} more
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-emerald-600" /> My Labs
            </h2>
            <Link to="/faculty/subjects" className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium">
              Manage Batches <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {labs.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No labs assigned</p>
          ) : (
            <div className="space-y-2">
              {labs.map(l => (
                <div key={l._id} className="flex items-center justify-between p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{l.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{l.code} · {l.branch} · {l.semester === 1 ? 'Sem A' : l.semester === 2 ? 'Sem B' : `Sem ${l.semester}`}</p>
                  </div>
                  <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 ml-2 flex-shrink-0">{l.credits} Cr</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Notices */}
      <div className="card">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Recent Notices
        </h2>
        {notices.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">No notices</p>
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
