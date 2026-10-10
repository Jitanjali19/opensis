import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';

const BRANCHES = ['IT', 'CSE', 'ECE', 'ME', 'CE'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const EMPTY_FORM = { code: '', name: '', branch: 'IT', semester: 1, credits: 3 };
const EMPTY_LAB_FORM = { code: '', name: '', branch: 'IT', semester: 1, credits: 1 };
const getCodeErrorMessage = (error, fallback = 'Failed') => {
  const message = error.response?.data?.message || '';
  return /E11000|duplicate key|duplicate index/i.test(message)
    ? 'This code is already in use. Please enter a different code.'
    : message || fallback;
};

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [labs, setLabs] = useState([]);
  const [allFaculty, setAllFaculty] = useState([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSem, setFilterSem] = useState('');

  // add form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showLabForm, setShowLabForm] = useState(false);
  const [labForm, setLabForm] = useState(EMPTY_LAB_FORM);
  const [labSaving, setLabSaving] = useState(false);

  // inline edit
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [labEditId, setLabEditId] = useState(null);
  const [labEditForm, setLabEditForm] = useState({});
  const [labEditSaving, setLabEditSaving] = useState(false);

  // delete
  const [deletingId, setDeletingId] = useState(null);
  const [labDeletingId, setLabDeletingId] = useState(null);

  const loadSubjects = (branch = filterBranch, sem = filterSem) => {
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);
    if (sem) params.set('semester', sem);
    return api.get(`/admin/subjects?${params}`).then(r => setSubjects(r.data.data.subjects));
  };

  const loadLabs = (branch = filterBranch, sem = filterSem) => {
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);
    if (sem) params.set('semester', sem);
    return api.get(`/admin/labs?${params}`).then(r => setLabs(r.data.data.labs));
  };

  useEffect(() => {
    Promise.all([
      loadSubjects(),
      loadLabs(),
      api.get('/admin/faculty').then(r => setAllFaculty(r.data.data.faculty)),
    ]).finally(() => setLoading(false));
  }, []);

  const handleFilterChange = (branch, sem) => {
    setFilterBranch(branch);
    setFilterSem(sem);
    loadSubjects(branch, sem);
    loadLabs(branch, sem);
  };

  // ── Add ──────────────────────────────────────────
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setLab = (k, v) => setLabForm(f => ({ ...f, [k]: v }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/subjects', form);
      toast.success('Subject created!');
      setShowForm(false);
      setForm(EMPTY_FORM);
      loadSubjects();
    } catch (err) {
      toast.error(getCodeErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLabAdd = async (e) => {
    e.preventDefault();
    setLabSaving(true);
    try {
      await api.post('/admin/labs', labForm);
      toast.success('Lab created!');
      setShowLabForm(false);
      setLabForm(EMPTY_LAB_FORM);
      loadLabs();
    } catch (err) {
      toast.error(getCodeErrorMessage(err));
    } finally {
      setLabSaving(false);
    }
  };

  // ── Edit ─────────────────────────────────────────
  const startEdit = (s) => {
    setEditId(s._id);
    setEditForm({ name: s.name, credits: s.credits, facultyId: s.facultyId?._id || '' });
  };

  const cancelEdit = () => { setEditId(null); setEditForm({}); };
  const startLabEdit = (lab) => {
    setLabEditId(lab._id);
    setLabEditForm({ name: lab.name, semester: lab.semester, credits: lab.credits, facultyId: lab.facultyId?._id || '' });
  };

  const cancelLabEdit = () => { setLabEditId(null); setLabEditForm({}); };

  const handleEdit = async (id) => {
    setEditSaving(true);
    try {
      await api.patch(`/admin/subjects/${id}`, editForm);
      toast.success('Subject updated!');
      cancelEdit();
      loadSubjects();
    } catch (err) {
      toast.error(getCodeErrorMessage(err));
    } finally {
      setEditSaving(false);
    }
  };

  const handleLabEdit = async (id) => {
    setLabEditSaving(true);
    try {
      await api.patch(`/admin/labs/${id}`, labEditForm);
      toast.success('Lab updated!');
      cancelLabEdit();
      loadLabs();
    } catch (err) {
      toast.error(getCodeErrorMessage(err));
    } finally {
      setLabEditSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/admin/subjects/${id}`);
      toast.success('Subject deleted');
      setSubjects(prev => prev.filter(s => s._id !== id));
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLabDelete = async (id) => {
    setLabDeletingId(id);
    try {
      await api.delete(`/admin/labs/${id}`);
      toast.success('Lab deleted');
      setLabs(prev => prev.filter(lab => lab._id !== id));
    } catch {
      toast.error('Delete failed');
    } finally {
      setLabDeletingId(null);
    }
  };

  const viewLabStudents = async (lab) => {
    try {
      const { data } = await api.get(`/admin/labs/${lab._id}/students`);
      toast.success(`${data.data.students.length} eligible students for ${lab.code}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load lab students');
    }
  };

  const facultyForBranch = filterBranch
    ? allFaculty.filter(f => String(f.department || '').toUpperCase() === filterBranch.toUpperCase())
    : allFaculty;
  const facultyForSubjectBranch = allFaculty.filter(
    f => String(f.department || '').toUpperCase() === String(form.branch || '').toUpperCase(),
  );
  const facultyForLabBranch = labForm.branch
    ? allFaculty.filter(f => String(f.department || '').toUpperCase() === String(labForm.branch || '').toUpperCase())
    : allFaculty;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Subjects</h1>
          <p className="text-slate-500 text-sm">{subjects.length} shown</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary">
          <Plus className="w-4 h-4" />Add Subject
        </button>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold text-slate-700 mb-4">New Subject</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Code *</label>
              <input className="input font-mono uppercase" value={form.code} onChange={e => set('code', e.target.value)} required placeholder="IT501" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Data Structures & Algorithms" />
            </div>
            <div>
              <label className="label">Branch *</label>
              <select className="input" value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value, facultyId: '' }))}>
                {BRANCHES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Semester *</label>
              <select className="input" value={form.semester} onChange={e => set('semester', Number(e.target.value))}>
                {SEMESTERS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Credits</label>
              <input className="input" type="number" min={1} max={6} value={form.credits} onChange={e => set('credits', Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Assigned Faculty</label>
              <select className="input" value={form.facultyId || ''} onChange={e => set('facultyId', e.target.value)}>
                <option value="">— Unassigned —</option>
                {facultyForSubjectBranch.map(f => (
                  <option key={f._id} value={f._id}>{f.firstName} {f.lastName} · {f.department}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Subject'}</button>
              <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <select className="input w-auto" value={filterBranch} onChange={e => handleFilterChange(e.target.value, filterSem)}>
            <option value="">All Branches</option>
            {BRANCHES.map(b => <option key={b}>{b}</option>)}
          </select>
          <select className="input w-auto" value={filterSem} onChange={e => handleFilterChange(filterBranch, e.target.value)}>
            <option value="">All Semesters</option>
            {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
          </select>
          {(filterBranch || filterSem) && (
            <button onClick={() => handleFilterChange('', '')} className="text-xs text-slate-500 hover:text-slate-700 underline">Clear filters</button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Code', 'Name', 'Branch', 'Sem', 'Credits', 'Assigned Faculty', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : subjects.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No subjects found</td></tr>
              ) : (
                subjects.map(s => {
                  const isEditing = editId === s._id;
                  return (
                    <tr key={s._id} className={`border-b border-slate-100 ${isEditing ? 'bg-primary-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3 font-mono font-semibold text-primary-600">{s.code}</td>

                      {/* Name — editable */}
                      <td className="px-4 py-3">
                        {isEditing
                          ? <input className="input py-1 text-sm" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                          : <span className="font-medium">{s.name}</span>
                        }
                      </td>

                      <td className="px-4 py-3"><span className="badge-blue">{s.branch}</span></td>
                      <td className="px-4 py-3">Sem {s.semester}</td>

                      {/* Credits — editable */}
                      <td className="px-4 py-3">
                        {isEditing
                          ? <input className="input py-1 text-sm w-16" type="number" min={1} max={6} value={editForm.credits} onChange={e => setEditForm(f => ({ ...f, credits: Number(e.target.value) }))} />
                          : `${s.credits} cr.`
                        }
                      </td>

                      {/* Faculty — editable */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select className="input py-1 text-sm" value={editForm.facultyId} onChange={e => setEditForm(f => ({ ...f, facultyId: e.target.value }))}>
                            <option value="">— Unassigned —</option>
                            {allFaculty.filter(f => String(f.department || '').toUpperCase() === String(s.branch || '').toUpperCase()).map(f => (
                              <option key={f._id} value={f._id}>{f.firstName} {f.lastName} · {f.department}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={s.facultyId ? 'text-slate-700' : 'text-slate-400 italic'}>
                            {s.facultyId ? `${s.facultyId.firstName} ${s.facultyId.lastName}` : 'Unassigned'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEdit(s._id)} disabled={editSaving} className="text-primary-600 hover:text-primary-700" title="Save">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600" title="Cancel">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button onClick={() => startEdit(s)} className="text-slate-500 hover:text-slate-700" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(s._id)}
                              disabled={deletingId === s._id}
                              className="text-red-400 hover:text-red-600 disabled:opacity-40"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden p-0 mt-6">
        <div className="px-4 py-5 border-b border-slate-100 flex items-center justify-between gap-3"><h2 className="text-2xl font-bold text-slate-800">Labs</h2><button onClick={() => setShowLabForm(s => !s)} className="btn-primary"><Plus className="w-4 h-4" />{showLabForm ? 'Close Lab Form' : 'Add Lab'}</button></div>
        {showLabForm && (
          <div className="p-4 border-b border-slate-100 bg-slate-50/60">
            <h3 className="font-semibold text-slate-700 mb-4">Create New Lab</h3>
            <form onSubmit={handleLabAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className="label">Code *</label><input className="input font-mono uppercase" value={labForm.code} onChange={e => setLab('code', e.target.value)} required placeholder="ITL501" /></div>
              <div className="sm:col-span-2"><label className="label">Name *</label><input className="input" value={labForm.name} onChange={e => setLab('name', e.target.value)} required placeholder="Data Structures Lab" /></div>
              <div><label className="label">Branch *</label><select className="input" value={labForm.branch} onChange={e => setLab('branch', e.target.value)}>{BRANCHES.map(b => <option key={b}>{b}</option>)}</select></div>
              <div><label className="label">Semester *</label><select className="input" value={labForm.semester} onChange={e => setLab('semester', Number(e.target.value))}>{SEMESTERS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label className="label">Credits</label><input className="input" type="number" min={1} max={6} value={labForm.credits} onChange={e => setLab('credits', Number(e.target.value))} /></div>
              <div><label className="label">Assigned Faculty</label><select className="input" value={labForm.facultyId || ''} onChange={e => setLab('facultyId', e.target.value)}><option value="">— Unassigned —</option>{facultyForLabBranch.map(f => <option key={f._id} value={f._id}>{f.firstName} {f.lastName}</option>)}</select></div>
              <div className="sm:col-span-3 flex gap-3"><button type="submit" disabled={labSaving} className="btn-primary">{labSaving ? 'Creating...' : 'Create Lab'}</button><button type="button" onClick={() => { setShowLabForm(false); setLabForm(EMPTY_LAB_FORM); }} className="btn-secondary">Cancel</button></div>
            </form>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200"><tr>{['Code', 'Name', 'Branch', 'Sem', 'Credits', 'Assigned Faculty', ''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr></thead>
            <tbody>
              {labs.length === 0 ? <tr><td colSpan={7} className="text-center py-10 text-slate-400">No labs found</td></tr> : labs.map(lab => {
                const isEditing = labEditId === lab._id;
                const labFaculty = labForm.branch === lab.branch ? facultyForLabBranch : allFaculty.filter(f => f.department === lab.branch);
                return <tr key={lab._id} className={`border-b border-slate-100 ${isEditing ? 'bg-primary-50' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-600">{lab.code}</td>
                  <td className="px-4 py-3">{isEditing ? <input className="input py-1 text-sm" value={labEditForm.name} onChange={e => setLabEditForm(f => ({ ...f, name: e.target.value }))} /> : <span className="font-medium">{lab.name}</span>}</td>
                  <td className="px-4 py-3"><span className="badge-blue">{lab.branch}</span></td>
                  <td className="px-4 py-3">{isEditing ? <select className="input py-1 text-sm" value={labEditForm.semester} onChange={e => setLabEditForm(f => ({ ...f, semester: Number(e.target.value) }))}>{SEMESTERS.map(s => <option key={s}>{s}</option>)}</select> : `Sem ${lab.semester}`}</td>
                  <td className="px-4 py-3">{isEditing ? <input className="input py-1 text-sm w-16" type="number" min={1} max={6} value={labEditForm.credits} onChange={e => setLabEditForm(f => ({ ...f, credits: Number(e.target.value) }))} /> : `${lab.credits} cr.`}</td>
                  <td className="px-4 py-3">{isEditing ? <select className="input py-1 text-sm" value={labEditForm.facultyId} onChange={e => setLabEditForm(f => ({ ...f, facultyId: e.target.value }))}><option value="">— Unassigned —</option>{labFaculty.map(f => <option key={f._id} value={f._id}>{f.firstName} {f.lastName}</option>)}</select> : <span className={lab.facultyId ? 'text-slate-700' : 'text-slate-400 italic'}>{lab.facultyId ? `${lab.facultyId.firstName} ${lab.facultyId.lastName}` : 'Unassigned'}</span>}</td>
                  <td className="px-4 py-3">{isEditing ? <div className="flex items-center gap-2"><button onClick={() => handleLabEdit(lab._id)} disabled={labEditSaving} className="text-primary-600" title="Save"><Check className="w-4 h-4" /></button><button onClick={cancelLabEdit} className="text-slate-400" title="Cancel"><X className="w-4 h-4" /></button></div> : <div className="flex items-center gap-3"><button onClick={() => startLabEdit(lab)} className="text-slate-500" title="Edit"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => handleLabDelete(lab._id)} disabled={labDeletingId === lab._id} className="text-red-400" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button></div>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
