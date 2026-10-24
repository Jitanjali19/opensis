import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Calendar, Download, Eye, FileText, Pencil, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveAssetUrl, resolveAssetDownloadUrl } from '../../utils/assetUrl';

const SESSION_OPTIONS = Array.from({ length: 6 }, (_, index) => {
  const start = new Date().getFullYear() - index;
  return `${start}-${start + 1}`;
});

const currentSession = () => {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
};

const currentTerm = () => (new Date().getMonth() >= 6 ? 'july-december' : 'january-june');

const TERM_LABELS = {
  'july-december': 'July-December',
  'january-june': 'January-June',
};

const EXAM_TYPES = [
  { value: 'end-sem', label: 'End Semester' },
  { value: 'mid-sem-1', label: 'Mid Semester 1' },
  { value: 'mid-sem-2', label: 'Mid Semester 2' },
];

const EXAM_TYPE_LABELS = Object.fromEntries(EXAM_TYPES.map(item => [item.value, item.label]));

export default function AdminExamSchedule() {
  const { selectedSession, selectedTerm } = useAuth();
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ session: selectedSession || currentSession(), term: selectedTerm || currentTerm(), examType: 'end-sem', title: '' });
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterSession, setFilterSession] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterExamType, setFilterExamType] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    if (!selectedSession) return;
    setForm(prev => (editing ? prev : { ...prev, session: selectedSession, term: selectedTerm || prev.term }));
  }, [selectedSession, selectedTerm, editing]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const load = () => api.get('/admin/exam-timetables')
    .then(response => setTimetables(response.data.data.timetables || []))
    .catch(() => {})
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => timetables.filter(item => (
    (!filterSession || item.session === filterSession)
    && (!filterTerm || item.term === filterTerm)
    && (!filterExamType || item.examType === filterExamType)
  )), [timetables, filterSession, filterTerm, filterExamType]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      toast.error('Please choose a timetable file');
      return;
    }
    setUploading(true);
    try {
      const payload = new FormData();
      payload.append('session', form.session);
      payload.append('term', form.term);
      payload.append('examType', form.examType);
      payload.append('title', form.title);
      payload.append('timetableFile', file);
      await api.post('/admin/exam-timetables', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(editing ? 'Exam timetable updated' : 'Exam timetable uploaded');
      setEditing(null);
      setFile(null);
      setForm(prev => (editing
        ? { session: currentSession(), term: currentTerm(), examType: 'end-sem', title: '' }
        : { ...prev, title: '' }));
      setFileKey(key => key + 1);
      await load();
    } finally {
      setUploading(false);
    }
  };

  const handleStartUpdate = (item) => {
    setEditing(item);
    setForm({
      session: item.session,
      term: item.term,
      examType: item.examType || 'end-sem',
      title: item.title || '',
    });
    setFile(null);
    setFileKey(key => key + 1);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancelUpdate = () => {
    setEditing(null);
    setFile(null);
    setFileKey(key => key + 1);
    setForm({ session: currentSession(), term: currentTerm(), examType: 'end-sem', title: '' });
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this exam timetable?')) return;
    await api.delete(`/admin/exam-timetables/${id}`);
    toast.success('Exam timetable deleted');
    setTimetables(prev => prev.filter(item => item._id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Exam Timetable</h1>
          <p className="text-slate-500 text-sm">
            Upload the exam timetable file for a session, term and exam type. Students can view and download it.
          </p>
        </div>
      </div>

      <div className="card mb-6" ref={formRef}>
        <h2 className="font-semibold text-slate-700 mb-4">{editing ? 'Update Timetable' : 'Upload Timetable'}</h2>
        {editing && (
          <p className="text-sm text-slate-500 mb-4">
            Updating <span className="font-medium text-slate-700">{editing.title || 'Exam Time Table'}</span>
            {` (${EXAM_TYPE_LABELS[editing.examType] || editing.examType})`}. Choose a new file to replace the current one.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-40">
              <label className="label">Academic Session *</label>
              <select className="input disabled:bg-slate-100" value={form.session} onChange={e => set('session', e.target.value)} disabled={Boolean(editing)} required>
                {SESSION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-40">
              <label className="label">Term *</label>
              <select className="input disabled:bg-slate-100" value={form.term} onChange={e => set('term', e.target.value)} disabled={Boolean(editing)} required>
                <option value="july-december">July-December</option>
                <option value="january-june">January-June</option>
              </select>
            </div>
            <div className="flex-1 min-w-40">
              <label className="label">Exam Type *</label>
              <select className="input disabled:bg-slate-100" value={form.examType} onChange={e => set('examType', e.target.value)} disabled={Boolean(editing)} required>
                {EXAM_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-48">
              <label className="label">Title</label>
              <input
                className="input"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Exam Time Table"
              />
            </div>
          </div>

          <div>
            <label className="label">Timetable File *</label>
            <input
              key={fileKey}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="input py-2 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-600"
              required
            />
            <p className="text-xs text-slate-400 mt-1">Allowed: PDF, DOC, DOCX, JPG, PNG (max 10 MB)</p>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={uploading} className="btn-primary">
              {editing ? <Pencil className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Saving...' : editing ? 'Update Timetable' : 'Upload Timetable'}
            </button>
            {editing && (
              <button type="button" onClick={handleCancelUpdate} className="btn-secondary">
                Cancel Update
              </button>
            )}
          </div>
        </form>
        <p className="text-xs text-slate-400 mt-3">
          Uploading again for the same session, term and exam type replaces the existing file.
        </p>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-semibold text-slate-700">Uploaded Timetables</h2>
        <div className="flex gap-3 flex-wrap">
          <select className="input w-auto" value={filterSession} onChange={e => setFilterSession(e.target.value)}>
            <option value="">All sessions</option>
            {SESSION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <select className="input w-auto" value={filterTerm} onChange={e => setFilterTerm(e.target.value)}>
            <option value="">All terms</option>
            <option value="july-december">July-December</option>
            <option value="january-june">January-June</option>
          </select>
          <select className="input w-auto" value={filterExamType} onChange={e => setFilterExamType(e.target.value)}>
            <option value="">All exam types</option>
            {EXAM_TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          [...Array(2)].map((_, index) => <div key={index} className="card h-20 animate-pulse bg-slate-100" />)
        ) : filtered.length === 0 ? (
          <div className="card text-center py-10 text-slate-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            No exam timetable uploaded yet
          </div>
        ) : (
          filtered.map(item => (
            <div key={item._id} className={`card flex items-start gap-4 ${editing?._id === item._id ? 'ring-2 ring-indigo-200' : ''}`}>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-slate-800">{item.title || 'Exam Time Table'}</h3>
                  <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{item.session}</span>
                  <span className="text-xs rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-600">
                    {TERM_LABELS[item.term] || item.term}
                  </span>
                  <span className="text-xs rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                    {EXAM_TYPE_LABELS[item.examType] || item.examType}
                  </span>
                </div>
                <p className="text-sm text-slate-600 truncate">{item.originalName}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Uploaded {new Date(item.updatedAt || item.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={resolveAssetUrl(item.fileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                  title="View timetable"
                >
                  <Eye className="w-4 h-4" />
                  View
                </a>
                <a
                  href={resolveAssetDownloadUrl(item.fileUrl)}
                  className="btn-secondary"
                  title="Download timetable"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
                <button
                  onClick={() => handleStartUpdate(item)}
                  className="btn-secondary"
                  title="Update timetable"
                >
                  <Pencil className="w-4 h-4" />
                  Update
                </button>
                <button
                  onClick={() => handleDelete(item._id)}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                  title="Delete timetable"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
