import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Plus, Trash2, Bell, Pin } from 'lucide-react';

const SESSION_OPTIONS = Array.from({ length: 6 }, (_, index) => {
  const start = new Date().getFullYear() - index;
  return `${start}-${start + 1}`;
});

export default function AdminNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', session: SESSION_OPTIONS[0], term: '', isPinned: false });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const load = () => api.get('/admin/notices').then(r => setNotices(r.data.data.notices)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/notices', form);
      toast.success('Notice posted!');
      setShowForm(false);
      setForm({ title: '', body: '', audience: 'all', session: SESSION_OPTIONS[0], term: '', isPinned: false });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this notice?')) return;
    await api.delete(`/admin/notices/${id}`);
    toast.success('Notice deleted');
    setNotices(n => n.filter(x => x._id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notices</h1>
          <p className="text-slate-500 text-sm">{notices.length} total</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary"><Plus className="w-4 h-4" />Post Notice</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold text-slate-700 mb-4">New Notice</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="label">Title *</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} required /></div>
            <div><label className="label">Body *</label><textarea className="input resize-none h-24" value={form.body} onChange={e => set('body', e.target.value)} required /></div>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-40"><label className="label">Audience</label>
                <select className="input" value={form.audience} onChange={e => set('audience', e.target.value)}>
                  <option value="all">All</option>
                  <option value="students">Students Only</option>
                  <option value="faculty">Faculty Only</option>
                </select>
              </div>
              <div className="flex-1 min-w-40"><label className="label">Academic Session *</label>
                <select className="input" value={form.session} onChange={e => set('session', e.target.value)} required>
                  {SESSION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-40"><label className="label">Term</label>
                <select className="input" value={form.term} onChange={e => set('term', e.target.value)}>
                  <option value="">Entire session</option>
                  <option value="july-december">July-December</option>
                  <option value="january-june">January-June</option>
                </select>
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isPinned} onChange={e => set('isPinned', e.target.checked)} className="w-4 h-4 rounded" />
                  <span className="text-sm text-slate-700">Pin this notice</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Posting...' : 'Post Notice'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-slate-100" />)
        ) : notices.length === 0 ? (
          <div className="card text-center py-10 text-slate-400">
            <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            No notices yet
          </div>
        ) : (
          notices.map(n => (
            <div key={n._id} className="card flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${n.isPinned ? 'bg-amber-100' : 'bg-slate-100'}`}>
                {n.isPinned ? <Pin className="w-5 h-5 text-amber-500" /> : <Bell className="w-5 h-5 text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-800">{n.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${n.audience === 'all' ? 'bg-blue-100 text-blue-700' : n.audience === 'students' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{n.audience}</span>
                  {n.session && <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{n.session}</span>}
                  {n.term && <span className="text-xs rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-600">{n.term === 'july-december' ? 'Jul-Dec' : 'Jan-Jun'}</span>}
                </div>
                <p className="text-sm text-slate-600">{n.body}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <button onClick={() => handleDelete(n._id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
