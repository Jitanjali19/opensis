import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Bell, GraduationCap, UserCheck, ArrowRight, Upload, BarChart3, MessageSquare, RefreshCw } from 'lucide-react';

function StatCard({ title, value, icon: Icon, color, link }) {
  return (
    <Link to={link || '#'} className="card hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value ?? '—'}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs text-slate-500 group-hover:text-primary-600">
        Open {title.toLowerCase()} <ArrowRight className="w-3 h-3" />
      </div>
    </Link>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats').then(r => setStats(r.data.data)),
      api.get('/admin/notices').then(r => setNotices(r.data.data.notices.slice(0, 5))),
    ]).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Welcome, {user?.profile?.firstName} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">See important counts, open common admin tasks, and review recent notices.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total students" value={loading ? '…' : stats?.students} icon={GraduationCap} color="bg-indigo-500" link="/admin/students" />
        <StatCard title="Faculty members" value={loading ? '…' : stats?.faculty} icon={UserCheck} color="bg-emerald-500" link="/admin/faculty" />
        <StatCard title="Subjects" value={loading ? '…' : stats?.subjects} icon={BookOpen} color="bg-amber-500" link="/admin/subjects" />
        <StatCard title="Notices" value={loading ? '…' : stats?.notices} icon={Bell} color="bg-rose-500" link="/admin/notices" />
      </div>

      {loadError && <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><RefreshCw className="mt-0.5 h-4 w-4 flex-shrink-0" /><div><p className="font-semibold">Some dashboard information could not be loaded.</p><p className="mt-1 text-xs">Please refresh the page and try again.</p></div></div>}

      <div className="card mb-6">
        <div className="mb-4"><h2 className="font-semibold text-slate-800">Common admin tasks</h2><p className="mt-1 text-xs text-slate-500">Choose what you want to do next.</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['/admin/bulk-upload-students', 'Upload students', 'Add many student records from Excel.', Upload],
            ['/admin/results', 'Manage results', 'Check submissions and publish results.', BarChart3],
            ['/admin/feedback', 'Review feedback', 'See student feedback and analytics.', MessageSquare],
            ['/admin/notices', 'Create notice', 'Share an important update.', Bell],
          ].map(([link, title, description, Icon]) => <Link key={link} to={link} className="flex min-h-[108px] flex-col rounded-xl border border-slate-200 p-4 transition hover:border-primary-300 hover:bg-primary-50/50"><Icon className="mb-3 h-5 w-5 text-primary-600" /><span className="text-sm font-semibold text-slate-800">{title}</span><span className="mt-1 text-xs text-slate-500">{description}</span></Link>)}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div><h2 className="font-semibold text-slate-800">Recent notices</h2><p className="mt-1 text-xs text-slate-500">The latest messages shared with your institution.</p></div>
          <Link to="/admin/notices" className="min-h-[44px] px-2 pt-3 text-sm text-primary-600 hover:underline">View all</Link>
        </div>
        {notices.length === 0 ? (
          <div className="py-8 text-center"><Bell className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p className="font-medium text-slate-700">No notices yet</p><p className="mt-1 text-sm text-slate-500">Create a notice when you need to share an update.</p></div>
        ) : (
          <div className="space-y-3">
            {notices.map(n => (
              <div key={n._id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                <Bell className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(n.createdAt).toLocaleDateString()} · <span className="capitalize">{n.audience}</span></p>
                </div>
                {n.isPinned && <span className="badge-indigo ml-auto flex-shrink-0">Pinned</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
