import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Bell } from 'lucide-react';

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
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{subjects.length}</p>
              <p className="text-xs text-slate-500">My Subjects</p>
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
              <p className="text-xs text-slate-500">Recent Notices</p>
            </div>
          </div>
        </div>
      </div>

      {/* My Subjects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> My Subjects
          </h2>
          {subjects.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No subjects assigned</p>
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
