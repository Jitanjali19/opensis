import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Copy, FileText, X } from 'lucide-react';
import academicConfig from '../../../../shared/academicConfig.json';

const BRANCHES = academicConfig.DEPARTMENTS;
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const SESSIONS = academicConfig.ACADEMIC_YEARS;
const CATEGORIES = ['PCC', 'OEC', 'PEC', 'INT', 'MC', 'PRO', 'HSMC', 'BSC', 'ESC'];
const DEFAULT_SESSION = SESSIONS[0];

const emptyItem = (kind, session) => ({
  code: '',
  name: '',
  branch: BRANCHES[0],
  semester: 1,
  category: 'PCC',
  l: kind === 'lab' ? 0 : 3,
  t: 0,
  p: kind === 'lab' ? 2 : 0,
  credits: kind === 'lab' ? 1 : 3,
  facultyIds: [],
  note: '',
  syllabusText: '',
  electiveOptions: '',
  session: session || DEFAULT_SESSION,
});

const FacultyPicker = ({ options, value, onChange }) => {
  const toggle = (id) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };
  return (
    <div className="border border-slate-200 rounded-lg max-h-32 overflow-y-auto p-2 space-y-1 bg-white">
      {options.length === 0 && <p className="text-xs text-slate-400">No faculty for this department</p>}
      {options.map(f => (
        <label key={f._id} className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={value.includes(f._id)} onChange={() => toggle(f._id)} />
          <span>{f.firstName} {f.lastName} <span className="text-slate-400">· {f.department}</span></span>
        </label>
      ))}
    </div>
  );
};

export default function AdminSubjects() {
  const [items, setItems] = useState({ subjects: [], labs: [] });
  const [allFaculty, setAllFaculty] = useState([]);
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState(localStorage.getItem('erp_academic_session') || DEFAULT_SESSION);
  const [legacy, setLegacy] = useState(false);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSem, setFilterSem] = useState('');

  const [modal, setModal] = useState(null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [copyOpen, setCopyOpen] = useState(false);
  const [copyForm, setCopyForm] = useState({
    fromSession: SESSIONS[0],
    toSession: SESSIONS[1] || SESSIONS[0],
    branch: '',
    semester: '',
  });
  const [copying, setCopying] = useState(false);

  const load = () => {
    const params = new URLSearchParams();
    if (filterBranch) params.set('branch', filterBranch);
    if (filterSem) params.set('semester', filterSem);
    if (legacy) params.set('legacy', '1');
    else params.set('session', session);
    const qs = params.toString();
    setLoading(true);
    return Promise.all([
      api.get(`/admin/subjects?${qs}`).then(r => r.data.data.subjects),
      api.get(`/admin/labs?${qs}`).then(r => r.data.data.labs),
    ])
      .then(([subjects, labs]) => setItems({ subjects, labs }))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/admin/faculty').then(r => setAllFaculty(r.data.data.faculty)).catch(() => {});
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [session, legacy, filterBranch, filterSem]);

  const openCreate = (kind) => {
    setFile(null);
    setModal({ kind, mode: 'create', id: null, form: emptyItem(kind, session) });
  };

  const openEdit = (kind, item) => {
    setFile(null);
    setModal({
      kind,
      mode: 'edit',
      id: item._id,
      form: {
        code: item.code,
        name: item.name,
        branch: item.branch,
        semester: item.semester,
        category: item.category || 'PCC',
        l: item.l ?? (kind === 'lab' ? 0 : 3),
        t: item.t ?? 0,
        p: item.p ?? (kind === 'lab' ? 2 : 0),
        credits: item.credits ?? 1,
        facultyIds: (item.facultyList || []).map(f => f._id),
        note: item.note || '',
        syllabusText: item.syllabusText || '',
        electiveOptions: (item.electiveOptions || []).join('\n'),
        session: item.session || session,
      },
    });
  };

  const setField = (k, v) => setModal(m => ({ ...m, form: { ...m.form, [k]: v } }));
  const setBranch = (branch) => setModal(m => ({ ...m, form: { ...m.form, branch, facultyIds: [] } }));

  const modalFaculty = useMemo(() => {
    if (!modal) return [];
    const br = String(modal.form.branch || '').toUpperCase();
    return allFaculty.filter(f => String(f.department || '').toUpperCase() === br);
  }, [modal, allFaculty]);

  const handleSave = async (e) => {
    e.preventDefault();
    const { kind, mode, id, form } = modal;
    if (!form.session) { toast.error('Academic session is required'); return; }
    const base = kind === 'subject' ? '/admin/subjects' : '/admin/labs';
    const payload = {
      code: form.code,
      name: form.name,
      branch: form.branch,
      semester: Number(form.semester),
      session: form.session,
      category: form.category,
      l: Number(form.l) || 0,
      t: Number(form.t) || 0,
      p: Number(form.p) || 0,
      credits: Number(form.credits) || 0,
      facultyIds: form.facultyIds,
      note: form.note,
      syllabusText: form.syllabusText,
    };
    if (kind === 'subject') {
      payload.electiveOptions = (form.electiveOptions || '')
        .split('\n').map(s => s.trim()).filter(Boolean);
    }
    setSaving(true);
    try {
      if (file) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v === undefined || v === null) return;
          if (Array.isArray(v)) v.forEach(x => fd.append(k, x));
          else fd.append(k, v);
        });
        fd.append('syllabusFile', file);
        if (mode === 'edit') await api.patch(`${base}/${id}`, fd);
        else await api.post(base, fd);
      } else if (mode === 'edit') {
        await api.patch(`${base}/${id}`, payload);
      } else {
        await api.post(base, payload);
      }
      toast.success(kind === 'subject' ? 'Subject saved!' : 'Lab saved!');
      setModal(null);
      setFile(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (kind, id) => {
    if (!window.confirm(`Delete this ${kind}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/${kind === 'subject' ? 'subjects' : 'labs'}/${id}`);
      toast.success('Deleted');
      setItems(prev => kind === 'subject'
        ? { ...prev, subjects: prev.subjects.filter(s => s._id !== id) }
        : { ...prev, labs: prev.labs.filter(l => l._id !== id) });
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleCopy = async (e) => {
    e.preventDefault();
    setCopying(true);
    try {
      const { data } = await api.post('/admin/subjects/copy', {
        fromSession: copyForm.fromSession,
        toSession: copyForm.toSession,
        branch: copyForm.branch || undefined,
        semester: copyForm.semester || undefined,
      });
      toast.success(data.data.message);
      setCopyOpen(false);
      if (copyForm.toSession === session) load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Copy failed');
    } finally {
      setCopying(false);
    }
  };

  const renderTable = (kind, rows) => {
    const isSubject = kind === 'subject';
    return (
      <div className="card overflow-hidden p-0 mt-6">
        <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-800">
            {isSubject ? 'Subjects' : 'Labs'} <span className="text-sm font-normal text-slate-400">({rows.length})</span>
          </h2>
          <button onClick={() => openCreate(kind)} className="btn-primary">
            <Plus className="w-4 h-4" />Add {isSubject ? 'Subject' : 'Lab'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Code', 'Name', 'Cat', 'L-T-P', 'Credits', 'Faculty', 'Syllabus', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-400">No {isSubject ? 'subjects' : 'labs'} for this selection</td></tr>
              ) : (
                rows.map(item => {
                  const faculty = item.facultyList || [];
                  return (
                    <tr key={item._id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className={`px-4 py-3 font-mono font-semibold ${isSubject ? 'text-primary-600' : 'text-emerald-600'}`}>{item.code}</td>
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3"><span className="badge-blue">{item.category || 'PCC'}</span></td>
                      <td className="px-4 py-3 tabular-nums">{item.l ?? 0}-{item.t ?? 0}-{item.p ?? 0}</td>
                      <td className="px-4 py-3">{item.credits} cr.</td>
                      <td className="px-4 py-3">
                        {faculty.length
                          ? <span className="text-slate-700">{faculty.map(f => `${f.firstName} ${f.lastName}`).join(', ')}</span>
                          : <span className="text-slate-400 italic">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.syllabusFile && (
                            <a href={item.syllabusFile} target="_blank" rel="noreferrer" className="text-primary-600 hover:text-primary-700" title="Syllabus file">
                              <FileText className="w-4 h-4" />
                            </a>
                          )}
                          {item.syllabusText && <span className="badge-blue text-[10px]">Text</span>}
                          {!item.syllabusFile && !item.syllabusText && <span className="text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEdit(kind, item)} className="text-slate-500 hover:text-slate-700" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(kind, item._id)} className="text-red-400 hover:text-red-600" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Scheme of Subjects</h1>
          <p className="text-slate-500 text-sm">{items.subjects.length} subjects · {items.labs.length} labs</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCopyOpen(true)} className="btn-secondary"><Copy className="w-4 h-4" />Copy Scheme</button>
        </div>
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Academic Session</label>
          <select className="input w-auto" value={session} disabled={legacy} onChange={e => setSession(e.target.value)}>
            {SESSIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Department</label>
          <select className="input w-auto" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
            <option value="">All Departments</option>
            {BRANCHES.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Semester</label>
          <select className="input w-auto" value={filterSem} onChange={e => setFilterSem(e.target.value)}>
            <option value="">All Semesters</option>
            {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
          <input type="checkbox" checked={legacy} onChange={e => setLegacy(e.target.checked)} />
          Show legacy / unassigned
        </label>
      </div>

      {renderTable('subject', items.subjects)}
      {renderTable('lab', items.labs)}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">
                {modal.mode === 'edit' ? 'Edit' : 'New'} {modal.kind === 'subject' ? 'Subject' : 'Lab'}
              </h2>
              <button onClick={() => { setModal(null); setFile(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Session *</label>
                <select className="input" value={modal.form.session} onChange={e => setField('session', e.target.value)}>
                  {SESSIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Code *</label>
                <input className="input font-mono uppercase" value={modal.form.code} onChange={e => setField('code', e.target.value)} required />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={modal.form.category} onChange={e => setField('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="label">Name *</label>
                <input className="input" value={modal.form.name} onChange={e => setField('name', e.target.value)} required />
              </div>
              <div>
                <label className="label">Department *</label>
                <select className="input" value={modal.form.branch} disabled={modal.mode === 'edit'} onChange={e => setBranch(e.target.value)}>
                  {BRANCHES.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Semester *</label>
                <select className="input" value={modal.form.semester} disabled={modal.mode === 'edit'} onChange={e => setField('semester', Number(e.target.value))}>
                  {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Credits</label>
                <input className="input" type="number" min={0} max={10} value={modal.form.credits} onChange={e => setField('credits', Number(e.target.value))} />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                <div><label className="label">L</label><input className="input" type="number" min={0} value={modal.form.l} onChange={e => setField('l', Number(e.target.value))} /></div>
                <div><label className="label">T</label><input className="input" type="number" min={0} value={modal.form.t} onChange={e => setField('t', Number(e.target.value))} /></div>
                <div><label className="label">P</label><input className="input" type="number" min={0} value={modal.form.p} onChange={e => setField('p', Number(e.target.value))} /></div>
              </div>
              <div className="sm:col-span-3">
                <label className="label">Assigned Faculty (multiple)</label>
                <FacultyPicker options={modalFaculty} value={modal.form.facultyIds} onChange={ids => setField('facultyIds', ids)} />
              </div>
              <div className="sm:col-span-3">
                <label className="label">Faculty Note</label>
                <input className="input" value={modal.form.note} onChange={e => setField('note', e.target.value)} placeholder="e.g. Unit 1-2 in charge" />
              </div>
              {modal.kind === 'subject' && (
                <div className="sm:col-span-3">
                  <label className="label">Elective Options (one per line)</label>
                  <textarea className="input" rows={2} value={modal.form.electiveOptions} onChange={e => setField('electiveOptions', e.target.value)} />
                </div>
              )}
              <div className="sm:col-span-3">
                <label className="label">Syllabus Text</label>
                <textarea className="input" rows={3} value={modal.form.syllabusText} onChange={e => setField('syllabusText', e.target.value)} placeholder="Paste syllabus / unit details" />
              </div>
              <div className="sm:col-span-3">
                <label className="label">Syllabus File (PDF/DOC)</label>
                <input className="input" type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
                {modal.mode === 'edit' && modal.form.syllabusFile && (
                  <p className="text-xs text-slate-400 mt-1">Existing file kept unless a new one is uploaded.</p>
                )}
              </div>
              <div className="sm:col-span-3 flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : modal.mode === 'edit' ? 'Save Changes' : 'Create'}
                </button>
                <button type="button" onClick={() => { setModal(null); setFile(null); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {copyOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Copy Scheme Between Sessions</h2>
              <button onClick={() => setCopyOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCopy} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">From Session *</label>
                <select className="input" value={copyForm.fromSession} onChange={e => setCopyForm(f => ({ ...f, fromSession: e.target.value }))}>
                  {SESSIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">To Session *</label>
                <select className="input" value={copyForm.toSession} onChange={e => setCopyForm(f => ({ ...f, toSession: e.target.value }))}>
                  {SESSIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Department (optional)</label>
                <select className="input" value={copyForm.branch} onChange={e => setCopyForm(f => ({ ...f, branch: e.target.value }))}>
                  <option value="">All</option>
                  {BRANCHES.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Semester (optional)</label>
                <select className="input" value={copyForm.semester} onChange={e => setCopyForm(f => ({ ...f, semester: e.target.value }))}>
                  <option value="">All</option>
                  {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
              </div>
              <p className="sm:col-span-2 text-xs text-slate-500">
                Subjects and labs are copied without faculty assignments. Existing codes in the target session are skipped.
              </p>
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={copying} className="btn-primary">{copying ? 'Copying...' : 'Copy'}</button>
                <button type="button" onClick={() => setCopyOpen(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
