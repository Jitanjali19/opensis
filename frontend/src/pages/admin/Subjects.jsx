import React, { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, Copy, FileText, X, ChevronDown, ChevronRight, Eye,
  BookOpen, FlaskConical, UserCheck, Download, GraduationCap, Lock, Globe,
} from 'lucide-react';
import academicConfig from '../../../../shared/academicConfig.json';

const BRANCHES       = academicConfig.DEPARTMENTS;
const DEPT_LABELS    = academicConfig.DEPARTMENT_LABELS || {};
const SESSIONS       = academicConfig.ACADEMIC_YEARS;
const SEMESTERS_BY_YEAR = academicConfig.SEMESTERS_BY_YEAR; // { "1":[1,2], "2":[3,4], ... }
const YEARS          = [1, 2, 3, 4];
const DEFAULT_SESSION = SESSIONS[0];

// ─── helpers ────────────────────────────────────────────────────────────────
const yearLabel = (y) => ['I', 'II', 'III', 'IV'][y - 1] || `Year ${y}`;

// Semester display name: Year 1 uses Sem A / Sem B across all departments
const semLabel = (sem) => {
  if (sem === 1) return 'Semester A  (Sem I)';
  if (sem === 2) return 'Semester B  (Sem II)';
  return `Semester ${sem}`;
};
// Short label for the header badge
const semShortLabel = (sem) => {
  if (sem === 1) return 'Sem A';
  if (sem === 2) return 'Sem B';
  return `Sem ${sem}`;
};

const defaultMarks = (isLab) => isLab
  ? { theoryEndMax: 0,  cwMax: 0,  practicalEndMax: 60, swMax: 40 }
  : { theoryEndMax: 70, cwMax: 30, practicalEndMax: 0,  swMax: 0  };

const emptyForm = (kind, session, branch, semester) => ({
  code: '', name: '',
  l: kind === 'lab' ? 0 : 3,
  t: 0,
  p: kind === 'lab' ? 2 : 0,
  credits: kind === 'lab' ? 1 : 3,
  facultyIds: [],
  note: '',
  syllabusText: '',
  electiveOptions: '',
  isCommon: false,
  session:  session  || DEFAULT_SESSION,
  branch:   branch   || BRANCHES[0],
  semester: semester || 1,
  ...defaultMarks(kind === 'lab'),
});

// ─── FacultyPicker ───────────────────────────────────────────────────────────
const FacultyPicker = ({ options, value, onChange }) => {
  const toggle = (id) => {
    const next = new Set(value);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange([...next]);
  };
  return (
    <div className="border border-slate-200 rounded-lg max-h-36 overflow-y-auto p-2 space-y-1 bg-white">
      {options.length === 0
        ? <p className="text-xs text-slate-400 italic py-2 text-center">No faculty for this department</p>
        : options.map(f => (
          <label key={f._id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
            <input type="checkbox" checked={value.includes(f._id)} onChange={() => toggle(f._id)} className="accent-primary-600" />
            <span>{f.firstName} {f.lastName}<span className="text-slate-400 ml-1">· {f.department}</span></span>
          </label>
        ))}
    </div>
  );
};

// ─── SubjectModal ────────────────────────────────────────────────────────────
const SubjectModal = ({ modal, allFaculty, onClose, onSaved }) => {
  const { kind, mode, id } = modal;
  const isLab = kind === 'lab';
  const [form, setForm] = useState(modal.form);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // When kind changes defaults auto-fill marks
  const applyMarkDefaults = () => setForm(f => ({ ...f, ...defaultMarks(isLab) }));

  const facultyOptions = useMemo(() => {
    // Year-1 common subjects are taught by their own department's faculty
    // (Maths, Physics, Civil, etc.), so don't restrict the picker to the branch.
    if (form.isCommon) return allFaculty;
    const br = String(form.branch || '').toUpperCase();
    return allFaculty.filter(f => String(f.department || '').toUpperCase() === br);
  }, [form.branch, form.isCommon, allFaculty]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const base = isLab ? '/admin/labs' : '/admin/subjects';
    const payload = {
      code: form.code, name: form.name,
      branch: form.branch, semester: Number(form.semester), session: form.session,
      l: Number(form.l) || 0, t: Number(form.t) || 0, p: Number(form.p) || 0,
      credits: Number(form.credits) || 0,
      theoryEndMax: Number(form.theoryEndMax) || 0, cwMax: Number(form.cwMax) || 0,
      practicalEndMax: Number(form.practicalEndMax) || 0, swMax: Number(form.swMax) || 0,
      facultyIds: form.facultyIds, note: form.note, syllabusText: form.syllabusText,
    };
    if (!isLab) payload.electiveOptions = (form.electiveOptions || '').split('\n').map(s => s.trim()).filter(Boolean);
    // Send isCommon for Year 1 subjects/labs (sem 1 or 2)
    if (Number(form.semester) <= 2) payload.isCommon = !!form.isCommon;

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
        mode === 'edit' ? await api.patch(`${base}/${id}`, fd) : await api.post(base, fd);
      } else if (mode === 'edit') {
        await api.patch(`${base}/${id}`, payload);
      } else {
        await api.post(base, payload);
      }
      toast.success(isLab ? 'Lab saved!' : 'Subject saved!');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 rounded-t-2xl ${isLab ? 'bg-emerald-50' : 'bg-primary-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2 ${isLab ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-100 text-primary-700'}`}>
              {isLab ? <FlaskConical className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">{mode === 'edit' ? 'Edit' : 'New'} {isLab ? 'Lab' : 'Subject'}</h2>
              <p className="text-xs text-slate-500">{form.session} · {form.branch} · Semester {form.semester}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-lg p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Code *</label>
              <input className="input font-mono uppercase" value={form.code}
                onChange={e => set('code', e.target.value)} required placeholder="e.g. IT38101" />
            </div>
            <div>
              <label className="label">Credits</label>
              <input className="input" type="number" min={0} max={10} value={form.credits}
                onChange={e => set('credits', Number(e.target.value))} />
            </div>
            <div className="sm:col-span-3">
              <label className="label">Subject Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required
                placeholder={isLab ? "e.g. Computer Networks Lab" : "e.g. Computer Networks"} />
            </div>
          </div>

          {/* L-T-P */}
          <div>
            <label className="label mb-2">Hours / Week (L – T – P)</label>
            <div className="grid grid-cols-3 gap-3">
              {[['L', 'Lecture'], ['T', 'Tutorial'], ['P', 'Practical']].map(([k, lbl]) => (
                <div key={k}>
                  <label className="text-xs text-slate-500 mb-1 block">{lbl}</label>
                  <input className="input text-center" type="number" min={0} value={form[k.toLowerCase()]}
                    onChange={e => set(k.toLowerCase(), Number(e.target.value))} />
                </div>
              ))}
            </div>
          </div>

          {/* Marks structure */}
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Marks Structure (per scheme)</label>
              <button type="button" onClick={applyMarkDefaults}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Reset defaults
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Theory End-Sem</label>
                <input className="input" type="number" min={0} value={form.theoryEndMax}
                  onChange={e => set('theoryEndMax', Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">CW / Internal</label>
                <input className="input" type="number" min={0} value={form.cwMax}
                  onChange={e => set('cwMax', Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Practical End-Sem</label>
                <input className="input" type="number" min={0} value={form.practicalEndMax}
                  onChange={e => set('practicalEndMax', Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">SW / Sessional</label>
                <input className="input" type="number" min={0} value={form.swMax}
                  onChange={e => set('swMax', Number(e.target.value))} />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Total: {(Number(form.theoryEndMax) || 0) + (Number(form.cwMax) || 0) + (Number(form.practicalEndMax) || 0) + (Number(form.swMax) || 0)} marks
            </p>
          </div>

          {/* Faculty */}
          <div>
            <label className="label">Assign Faculty</label>
            {isLab && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Faculty inherited from the paired theory subject are automatically applied and cannot be removed from here. Add extra lab-specific faculty below.</span>
              </div>
            )}
            <FacultyPicker options={facultyOptions} value={form.facultyIds} onChange={ids => set('facultyIds', ids)} />
            <input className="input mt-2" value={form.note} onChange={e => set('note', e.target.value)}
              placeholder="Faculty note (optional, e.g. Unit 1-2 in charge)" />
          </div>

          {/* Elective options (subjects only) */}
          {!isLab && (
            <div>
              <label className="label">Elective Options <span className="font-normal text-slate-400">(one per line, if applicable)</span></label>
              <textarea className="input" rows={2} value={form.electiveOptions}
                onChange={e => set('electiveOptions', e.target.value)} />
            </div>
          )}

          {/* Common Year 1 toggle — only shown for Sem 1 & 2 */}
          {(Number(form.semester) === 1 || Number(form.semester) === 2) && (
            <div className={`rounded-xl border p-4 flex items-start gap-3 ${form.isCommon ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-slate-50'}`}>
              <input
                id="isCommon"
                type="checkbox"
                className="mt-0.5 accent-violet-600 w-4 h-4 cursor-pointer"
                checked={!!form.isCommon}
                onChange={e => set('isCommon', e.target.checked)}
              />
              <label htmlFor="isCommon" className="cursor-pointer flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  Common (All Departments — Year 1 Shared Scheme)
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  When checked, this {isLab ? 'lab' : 'subject'} is part of the universal 1st-year scheme
                  and will automatically appear for students of <strong>all departments</strong> in
                  {Number(form.semester) === 1 ? ' Sem A' : ' Sem B'} — regardless of their branch.
                  Use &ldquo;Copy to All Branches&rdquo; in the semester header to distribute it.
                </p>
              </label>
            </div>
          )}

          {/* Syllabus Section */}
          <div className={`rounded-xl border p-4 space-y-4 ${isLab ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/40'}`}>
            <div className="flex items-center gap-2">
              <FileText className={`w-4 h-4 ${isLab ? 'text-emerald-600' : 'text-slate-500'}`} />
              <h3 className={`text-sm font-semibold ${isLab ? 'text-emerald-800' : 'text-slate-700'}`}>
                {isLab ? 'Lab Syllabus / Lab Manual' : 'Subject Syllabus'}
              </h3>
              {isLab && (
                <span className="text-xs text-emerald-600 bg-emerald-100 rounded-full px-2 py-0.5">
                  Separate from theory syllabus
                </span>
              )}
            </div>

            <div>
              <label className="label">
                {isLab ? 'Lab Manual / Experiment List' : 'Syllabus Text'}
                <span className="font-normal text-slate-400 ml-1">(unit / experiment-wise, paste from PDF)</span>
              </label>
              <textarea
                className="input font-mono text-sm"
                rows={isLab ? 6 : 4}
                value={form.syllabusText}
                onChange={e => set('syllabusText', e.target.value)}
                placeholder={isLab
                  ? 'Experiment 1: Introduction to ...\nExperiment 2: ...\n\nObjectives:\n- ...'
                  : 'Unit 1: Introduction\n  - Topic A\n  - Topic B\n\nUnit 2: ...'}
              />
            </div>

            <div>
              <label className="label">
                {isLab ? 'Lab Manual File' : 'Syllabus File'}
                <span className="font-normal text-slate-400 ml-1">(PDF / DOC / Image)</span>
              </label>
              <input
                className="input"
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
              {mode === 'edit' && form.syllabusFile && !file && (
                <a
                  href={form.syllabusFile}
                  target="_blank"
                  rel="noreferrer"
                  className={`text-xs mt-1.5 flex items-center gap-1 ${isLab ? 'text-emerald-600' : 'text-primary-600'}`}
                >
                  <FileText className="w-3 h-3" />
                  View current {isLab ? 'lab manual' : 'syllabus'} file
                </a>
              )}
            </div>
          </div>


          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="submit" disabled={saving}
              className={`btn-primary ${isLab ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
              {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : `Add ${isLab ? 'Lab' : 'Subject'}`}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── SemesterSection ─────────────────────────────────────────────────────────
const SemesterSection = ({ sem, subjects, labs, onAdd, onEdit, onDelete, onViewStudents, onImportCommon }) => {
  const [open, setOpen] = useState(true);
  const allRows = [
    ...subjects.map(s => ({ ...s, _kind: 'subject' })),
    ...labs.map(l => ({ ...l, _kind: 'lab' })),
  ].sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
      {/* Semester header — use div, NOT button, because buttons are nested inside */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-700 text-white select-none">
        {/* clickable left side toggles open/close */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen(o => !o)}
          onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
          className="flex items-center gap-3 cursor-pointer flex-1 hover:opacity-80 transition-opacity"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-semibold">{semShortLabel(sem)}</span>
          <span className="text-slate-400 text-sm">
            {subjects.length} subject{subjects.length !== 1 ? 's' : ''} · {labs.length} lab{labs.length !== 1 ? 's' : ''}
          </span>
        </div>
        {/* Add buttons on the right */}
        <div className="flex items-center gap-2">
          {(sem === 1 || sem === 2) && onImportCommon && (
            <button
              type="button"
              onClick={() => onImportCommon(sem)}
              className="flex items-center gap-1 text-xs bg-violet-500/30 hover:bg-violet-500/50 text-white rounded-lg px-2.5 py-1.5 transition-colors"
              title="Add shared Year-1 subjects/labs and choose Sem A or Sem B for this department"
            >
              <Globe className="w-3.5 h-3.5" /> Common
            </button>
          )}
          <button
            type="button"
            onClick={() => onAdd('subject', sem)}
            className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /><BookOpen className="w-3.5 h-3.5" /> Subject
          </button>
          <button
            type="button"
            onClick={() => onAdd('lab', sem)}
            className="flex items-center gap-1 text-xs bg-emerald-500/30 hover:bg-emerald-500/50 text-white rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /><FlaskConical className="w-3.5 h-3.5" /> Lab
          </button>
        </div>
      </div>

      {open && (
        <div className="overflow-x-auto">
          {allRows.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No subjects yet.&nbsp;
              <button onClick={() => onAdd('subject', sem)} className="text-primary-600 hover:underline">Add subject</button>
              &nbsp;or&nbsp;
              <button onClick={() => onAdd('lab', sem)} className="text-emerald-600 hover:underline">add lab</button>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Code', 'Subject Name', 'L-T-P', 'Cr', 'Th.End', 'CW', 'Pr.End', 'SW', 'Total', 'Faculty', 'Syllabus', 'Actions'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRows.map((item, i) => {
                  const isLab = item._kind === 'lab';
                  const faculty = item.facultyList || [];
                  const totalMax = (item.theoryEndMax || 0) + (item.cwMax || 0) + (item.practicalEndMax || 0) + (item.swMax || 0);
                  return (
                    <tr key={item._id} className={`border-b border-slate-100 hover:bg-slate-50/80 ${isLab ? 'bg-emerald-50/30' : ''}`}>
                      <td className={`px-3 py-2.5 font-mono font-semibold text-xs whitespace-nowrap ${isLab ? 'text-emerald-700' : 'text-primary-700'}`}>
                        {item.code}
                      </td>
                      <td className="px-3 py-2.5 font-medium max-w-xs">
                        <div className="flex items-center gap-1.5">
                          {isLab
                            ? <FlaskConical className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            : <BookOpen className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />}
                          {item.name}
                          {item.isCommon && (
                            <span className="ml-1 text-[9px] font-semibold bg-violet-100 text-violet-700 rounded-full px-1.5 py-0.5 flex-shrink-0" title="Common Year 1 scheme — shared across all departments">
                              🌐 Common
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-600 whitespace-nowrap">
                        {item.l ?? 0}-{item.t ?? 0}-{item.p ?? 0}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{item.credits ?? 0}</td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-600">{item.theoryEndMax ?? '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-600">{item.cwMax ?? '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-600">{item.practicalEndMax ?? '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-600">{item.swMax ?? '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold text-slate-800 whitespace-nowrap">{totalMax || '—'}</td>
                      <td className="px-3 py-2.5 max-w-[140px]">
                        {faculty.length
                          ? <span className="text-slate-700 text-xs">{faculty.map(f => `${f.firstName} ${f.lastName}`).join(', ')}</span>
                          : <span className="text-slate-400 italic text-xs flex items-center gap-1"><UserCheck className="w-3 h-3" />Unassigned</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {item.syllabusFile && (
                            <a href={item.syllabusFile} target="_blank" rel="noreferrer"
                              className="text-primary-600 hover:text-primary-700" title="Syllabus file">
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {item.syllabusText && <span className="badge-blue text-[9px]">Text</span>}
                          {!item.syllabusFile && !item.syllabusText && <span className="text-slate-300 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => onViewStudents && onViewStudents(item._kind, item._id, item.name)}
                            className="text-primary-400 hover:text-primary-600 transition-colors" title="View students">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onEdit(item._kind, item)}
                            className="text-slate-400 hover:text-slate-700 transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onDelete(item._kind, item._id)}
                            className="text-red-400 hover:text-red-600 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

// ─── CopySchemeModal ─────────────────────────────────────────────────────────
const CopySchemeModal = ({ onClose, onDone }) => {
  const [form, setForm] = useState({
    fromSession: SESSIONS[0],
    toSession: SESSIONS[1] || SESSIONS[0],
    branch: '',
    semester: '',
  });
  const [copying, setCopying] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCopy = async (e) => {
    e.preventDefault();
    setCopying(true);
    try {
      const { data } = await api.post('/admin/subjects/copy', {
        fromSession: form.fromSession,
        toSession: form.toSession,
        branch: form.branch || undefined,
        semester: form.semester || undefined,
      });
      toast.success(data.data.message);
      onDone(form.toSession);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Copy failed');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Copy className="w-4 h-4 text-primary-600" /> Copy Scheme Between Sessions
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleCopy} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">From Session *</label>
              <select className="input" value={form.fromSession} onChange={e => set('fromSession', e.target.value)}>
                {SESSIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">To Session *</label>
              <select className="input" value={form.toSession} onChange={e => set('toSession', e.target.value)}>
                {SESSIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Department <span className="font-normal text-slate-400">(optional)</span></label>
              <select className="input" value={form.branch} onChange={e => set('branch', e.target.value)}>
                <option value="">All Departments</option>
                {BRANCHES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Semester <span className="font-normal text-slate-400">(optional)</span></label>
              <select className="input" value={form.semester} onChange={e => set('semester', e.target.value)}>
                <option value="">All Semesters</option>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            Subjects and labs are copied without faculty assignments. Existing codes in the target session are skipped.
          </p>
          <div className="flex gap-3">
            <button type="submit" disabled={copying} className="btn-primary">
              {copying ? 'Copying...' : 'Copy Scheme'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── CommonImportModal ───────────────────────────────────────────────────────
const CommonImportModal = ({ session, branch, semester, existingCodes, onClose, onDone }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get(`/admin/subjects/common-year1?session=${encodeURIComponent(session)}`)
      .then((r) => {
        if (cancelled) return;
        const { subjects = [], labs = [] } = r.data.data || {};
        setRows([
          ...subjects.map((s) => ({ ...s, _kind: 'subject' })),
          ...labs.map((l) => ({ ...l, _kind: 'lab' })),
        ]);
      })
      .catch(() => toast.error('Could not load common Year-1 subjects'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session]);

  const toggle = (row) => {
    setSelected((prev) => {
      const next = { ...prev };
      const code = String(row.code).toUpperCase();
      if (next[code] !== undefined) delete next[code];
      else next[code] = semester || row.semester;
      return next;
    });
  };

  const setTargetSemester = (code, value) => {
    setSelected((prev) => ({ ...prev, [String(code).toUpperCase()]: Number(value) }));
  };

  const selectAll = () => {
    const next = {};
    rows.forEach((row) => {
      const code = String(row.code).toUpperCase();
      if (!existingCodes.has(code)) next[code] = semester || row.semester;
    });
    setSelected(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    const items = Object.entries(selected).map(([code, targetSemester]) => ({ code, semester: targetSemester }));
    if (!items.length) { toast.error('Select at least one subject or lab'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/admin/subjects/import-common', { session, branch, items });
      const result = data.data;
      toast.success(result.message || 'Common subjects added');
      if (result.skipped?.length) {
        toast(`${result.skipped.length} item(s) skipped (already present or invalid)`, { icon: '⚠️' });
      }
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add common subjects');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-600" /> Add Common Year-1 Subjects
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{session} · {branch} · choose Sem A or Sem B for each item</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Year-1 subjects are shared across departments. Keep an item in Sem A or move it to Sem B for {branch}.
            </p>
            <button type="button" onClick={selectAll} className="btn-secondary text-xs whitespace-nowrap">Select all</button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No common Year-1 subjects found for this session.</p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['', 'Code', 'Name', 'Type', 'Original', 'Place in'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const code = String(row.code).toUpperCase();
                    const exists = existingCodes.has(code);
                    const checked = selected[code] !== undefined;
                    return (
                      <tr key={`${row._kind}-${row._id}`} className={`border-b border-slate-100 ${exists ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            disabled={exists}
                            checked={checked}
                            onChange={() => toggle(row)}
                            className="accent-primary-600"
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs font-semibold">{row.code}</td>
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2 text-xs text-slate-500 capitalize">{row._kind}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{row.semester === 1 ? 'Sem A' : 'Sem B'}</td>
                        <td className="px-3 py-2">
                          {exists ? (
                            <span className="text-xs text-slate-400">Already added</span>
                          ) : (
                            <select
                              className="input py-1 text-xs w-24"
                              disabled={!checked}
                              value={selected[code] ?? row.semester}
                              onChange={(e) => setTargetSemester(code, e.target.value)}
                            >
                              <option value={1}>Sem A</option>
                              <option value={2}>Sem B</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="submit" disabled={saving || !Object.keys(selected).length} className="btn-primary">
              {saving ? 'Adding...' : `Add ${Object.keys(selected).length || ''} to ${branch}`}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AdminSubjects() {
  const [session, setSession]   = useState(localStorage.getItem('erp_academic_session') || DEFAULT_SESSION);
  const [branch,  setBranch]    = useState('');
  const [items,   setItems]     = useState({ subjects: [], labs: [] });
  const [allFaculty, setAllFaculty] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [modal,   setModal]     = useState(null);
  const [studentsModal, setStudentsModal] = useState(null);   // NEW STATE
  const [copyOpen, setCopyOpen] = useState(false);
  const [commonModal, setCommonModal] = useState(null);

  // Load faculty once
  useEffect(() => {
    api.get('/admin/faculty').then(r => setAllFaculty(r.data.data.faculty)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    if (!session || !branch) { setItems({ subjects: [], labs: [] }); return; }
    setLoading(true);
    const qs = `session=${encodeURIComponent(session)}&branch=${branch}`;
    Promise.all([
      api.get(`/admin/subjects?${qs}`).then(r => r.data.data.subjects),
      api.get(`/admin/labs?${qs}`).then(r => r.data.data.labs),
    ])
      .then(([subjects, labs]) => setItems({ subjects, labs }))
      .catch(() => toast.error('Failed to load subjects'))
      .finally(() => setLoading(false));
  }, [session, branch]);

  useEffect(() => { load(); }, [load]);

  // Group by semester
  const bySemester = useMemo(() => {
    const map = {};
    items.subjects.forEach(s => {
      const k = s.semester;
      if (!map[k]) map[k] = { subjects: [], labs: [] };
      map[k].subjects.push(s);
    });
    items.labs.forEach(l => {
      const k = l.semester;
      if (!map[k]) map[k] = { subjects: [], labs: [] };
      map[k].labs.push(l);
    });
    return map;
  }, [items]);

  const openAdd = (kind, semester) => {
    setModal({
      kind, mode: 'create', id: null,
      form: emptyForm(kind, session, branch, semester),
    });
  };

  const openEdit = (kind, item) => {
    const isLab = kind === 'lab';
    setModal({
      kind, mode: 'edit', id: item._id,
      form: {
        code: item.code, name: item.name,
        branch: item.branch, semester: item.semester, session: item.session || session,
        l: item.l ?? (isLab ? 0 : 3),
        t: item.t ?? 0,
        p: item.p ?? (isLab ? 2 : 0),
        credits: item.credits ?? (isLab ? 1 : 3),
        theoryEndMax: item.theoryEndMax ?? (isLab ? 0 : 70),
        cwMax: item.cwMax ?? (isLab ? 0 : 30),
        practicalEndMax: item.practicalEndMax ?? (isLab ? 60 : 0),
        swMax: item.swMax ?? (isLab ? 40 : 0),
        facultyIds: (item.facultyList || []).map(f => f._id),
        note: item.note || '',
        syllabusText: item.syllabusText || '',
        syllabusFile: item.syllabusFile || '',
        electiveOptions: (item.electiveOptions || []).join('\n'),
        isCommon: !!item.isCommon,
      },
    });
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

  // ─── Fetch students for a subject / lab ───────────────────────────────────────
  const fetchStudents = async (kind, id, name) => {
    try {
      const endpoint = kind === 'lab'
        ? `/admin/labs/${id}/students`
        : `/admin/subjects/${id}/students`;
      const { data } = await api.get(endpoint);
      setStudentsModal({ kind, id, name, list: data.data.students || [] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load students');
    }
  };

  // Only codes owned by this department count as "already added"; common items
  // shown from the canonical branch are still importable with a chosen semester.
  const existingCodes = useMemo(
    () => new Set(
      [...items.subjects, ...items.labs]
        .filter((item) => String(item.branch || '').toUpperCase() === String(branch || '').toUpperCase())
        .map((item) => String(item.code || '').toUpperCase()),
    ),
    [items, branch],
  );

  const totalSubjects = items.subjects.length;
  const totalLabs     = items.labs.length;
  const totalCredits  = [...items.subjects, ...items.labs].reduce((s, x) => s + (x.credits || 0), 0);

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Scheme of Subjects</h1>
          <p className="text-slate-500 text-sm mt-0.5">Design the academic scheme — session-wise, department-wise</p>
        </div>
        <button onClick={() => setCopyOpen(true)} className="btn-secondary">
          <Copy className="w-4 h-4" /> Copy Scheme
        </button>
      </div>

      {/* Session + Department selector — the primary "step" */}
      <div className="card mb-6 p-5">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold text-slate-700">Select Session &amp; Department</h2>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Academic Session *</label>
            <select className="input w-auto min-w-[160px]" value={session} onChange={e => setSession(e.target.value)}>
              {SESSIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Department *</label>
            <select className="input w-auto min-w-[200px]" value={branch} onChange={e => setBranch(e.target.value)}>
              <option value="">— Select Department —</option>
              {BRANCHES.map(b => <option key={b} value={b}>{DEPT_LABELS[b] ? `${b} – ${DEPT_LABELS[b]}` : b}</option>)}
            </select>
          </div>
          {branch && (
            <div className="flex items-center gap-4 pb-1 text-sm text-slate-500">
              <span><strong className="text-slate-700">{totalSubjects}</strong> subjects</span>
              <span><strong className="text-slate-700">{totalLabs}</strong> labs</span>
              <span><strong className="text-slate-700">{totalCredits}</strong> total credits</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {!branch ? (
        <div className="card py-20 text-center">
          <GraduationCap className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Select a session and department to view or design the scheme</p>
          <p className="text-slate-400 text-sm mt-1">Then add subjects and labs semester-by-semester below</p>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-slate-200 overflow-hidden animate-pulse">
              <div className="h-12 bg-slate-200" />
              <div className="p-4 space-y-3">
                {[1, 2].map(j => <div key={j} className="h-8 bg-slate-100 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {YEARS.map(year => {
            const sems = (SEMESTERS_BY_YEAR[String(year)] || []);
            return (
              <div key={year} className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-xl bg-primary-600 text-white px-4 py-1.5 text-sm font-bold tracking-wide">
                    Year {yearLabel(year)}
                  </div>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400">
                    {sems.reduce((total, sem) => {
                      const data = bySemester[sem];
                      return total + (data?.subjects.length || 0) + (data?.labs.length || 0);
                    }, 0)} entries
                  </span>
                </div>
                {sems.map(sem => (
                  <SemesterSection
                    key={sem}
                    sem={sem}
                    subjects={bySemester[sem]?.subjects || []}
                    labs={bySemester[sem]?.labs || []}
                    onAdd={openAdd}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onViewStudents={fetchStudents}
                    onImportCommon={(sem) => setCommonModal({ semester: sem })}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Subject/Lab modal */}
      {modal && (
        <SubjectModal
          modal={modal}
          allFaculty={allFaculty}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {/* Copy scheme modal */}
      {copyOpen && (
        <CopySchemeModal
          onClose={() => setCopyOpen(false)}
          onDone={(toSession) => {
            setCopyOpen(false);
            setSession(toSession);
          }}
        />
      )}
      {/* Import common Year-1 subjects modal */}
      {commonModal && (
        <CommonImportModal
          session={session}
          branch={branch}
          semester={commonModal.semester}
          existingCodes={existingCodes}
          onClose={() => setCommonModal(null)}
          onDone={() => { setCommonModal(null); load(); }}
        />
      )}
      {/* Students modal */}
      {studentsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary-600" />
                {studentsModal.kind === 'lab' ? 'Lab' : 'Subject'} Students – {studentsModal.name}
              </h2>
              <button onClick={() => setStudentsModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {studentsModal.list.length === 0 ? (
                <p className="text-center text-slate-500">No students enrolled yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500">Roll #</th>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500">Name</th>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500">Year</th>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsModal.list.map(st => (
                      <tr key={st._id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-3 py-2.5">{st.rollNumber}</td>
                        <td className="px-3 py-2.5">{st.firstName} {st.lastName}</td>
                        <td className="px-3 py-2.5 text-center">{st.year}</td>
                        <td className="px-3 py-2.5">{st.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex justify-end gap-3 mt-4">
                <button
                  className="btn-primary"
                  onClick={() => {
                    const csv = [
                      ['Roll #', 'First Name', 'Last Name', 'Year', 'Status'],
                      ...studentsModal.list.map(s => [
                        s.rollNumber,
                        s.firstName,
                        s.lastName,
                        s.year,
                        s.status,
                      ]),
                    ].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${studentsModal.kind}-${studentsModal.name}-students.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >Download CSV</button>
                <button onClick={() => setStudentsModal(null)} className="btn-secondary">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
