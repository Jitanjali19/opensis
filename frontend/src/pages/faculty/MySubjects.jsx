import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  BookOpen, FlaskConical, FileText, UserCheck, Download, Users, Plus,
  Trash2, Save, X, ChevronDown, ChevronRight, Layers, Info, Pencil,
  ExternalLink, CheckCircle2, Upload,
} from 'lucide-react';

const semLabel = (sem) => sem === 1 ? 'Sem A' : sem === 2 ? 'Sem B' : `Sem ${sem}`;

// ─── SyllabusModal ────────────────────────────────────────────────────────────
const SyllabusModal = ({ item, isLab, onClose, onSaved }) => {
  const [text, setText] = useState(item.syllabusText || '');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint = isLab
        ? `/faculty/syllabus/lab/${item._id}`
        : `/faculty/syllabus/subject/${item._id}`;

      if (file) {
        const fd = new FormData();
        fd.append('syllabusText', text);
        fd.append('syllabusFile', file);
        await api.patch(endpoint, fd);
      } else {
        await api.patch(endpoint, { syllabusText: text });
      }
      toast.success('Syllabus updated!');
      onSaved({ syllabusText: text, syllabusFile: file ? URL.createObjectURL(file) : item.syllabusFile });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 rounded-t-2xl ${isLab ? 'bg-emerald-50' : 'bg-primary-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2 ${isLab ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-100 text-primary-700'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">
                {item.syllabusText || item.syllabusFile ? 'Edit' : 'Add'} Syllabus
              </h2>
              <p className="text-xs text-slate-500">{item.code} – {item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Existing syllabus file */}
          {item.syllabusFile && !file && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-0.5">Current syllabus file</p>
                <a href={item.syllabusFile} target="_blank" rel="noreferrer"
                  className="text-sm text-primary-600 hover:underline flex items-center gap-1 truncate">
                  View / Download <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </div>
            </div>
          )}

          {/* Syllabus text */}
          <div>
            <label className="label">Syllabus Text <span className="text-slate-400 font-normal">(unit-wise, paste from PDF)</span></label>
            <textarea
              className="input font-mono text-sm"
              rows={12}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`Unit 1: Introduction\n  - Topic A\n  - Topic B\n\nUnit 2: ...`}
            />
          </div>

          {/* File upload */}
          <div>
            <label className="label">Upload Syllabus File <span className="text-slate-400 font-normal">(PDF/DOC/Image, replaces existing)</span></label>
            <div className="flex items-center gap-3">
              <label className={`flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-xl px-4 py-3 text-sm transition-colors flex-1
                ${file ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-300 hover:border-slate-400 text-slate-500'}`}>
                <Upload className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{file ? file.name : 'Choose PDF / DOC / Image'}</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </label>
              {file && (
                <button onClick={() => setFile(null)} className="text-red-400 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`btn-primary flex-1 ${isLab ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600' : ''}`}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Syllabus'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── SubjectCard ─────────────────────────────────────────────────────────────
const SubjectCard = ({ item: initialItem, isLab, onManageBatches }) => {
  const [item, setItem] = useState(initialItem);
  const [syllabusOpen, setSyllabusOpen] = useState(false);
  const [editSyllabus, setEditSyllabus] = useState(false);
  const total = (item.theoryEndMax || 0) + (item.cwMax || 0) + (item.practicalEndMax || 0) + (item.swMax || 0);
  const hasSyllabus = item.syllabusText || item.syllabusFile;

  return (
    <>
      <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isLab ? 'border-emerald-200' : 'border-slate-200'}`}>
        {/* Colour stripe */}
        <div className={`h-1 w-full ${isLab ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : 'bg-gradient-to-r from-primary-500 to-indigo-500'}`} />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`rounded-xl p-2 flex-shrink-0 ${isLab ? 'bg-emerald-50 text-emerald-700' : 'bg-primary-50 text-primary-700'}`}>
              {isLab ? <FlaskConical className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs font-semibold text-slate-500 mb-0.5">{item.code}</p>
              <h3 className="font-semibold text-slate-800 leading-snug">{item.name}</h3>
            </div>
            {/* Syllabus status dot */}
            <div title={hasSyllabus ? 'Syllabus added' : 'No syllabus yet'}>
              <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${hasSyllabus ? 'text-emerald-500' : 'text-slate-300'}`} />
            </div>
          </div>

          {/* Meta pills */}
          <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
            <span className="bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 font-medium">{item.branch}</span>
            <span className="bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 font-medium">{semLabel(item.semester)}</span>
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${isLab ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-100 text-primary-700'}`}>
              {item.credits} Cr
            </span>
            {item.category && <span className="bg-blue-50 text-blue-700 rounded-full px-2.5 py-0.5">{item.category}</span>}
          </div>

          {/* L-T-P and marks */}
          <div className="flex gap-2 flex-wrap text-xs mb-3">
            <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-400 mr-1">L-T-P</span>
              <span className="font-mono font-semibold text-slate-700">{item.l ?? 0}-{item.t ?? 0}-{item.p ?? 0}</span>
            </div>
            {total > 0 && (
              <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-400 mr-1">Max</span>
                <span className="font-mono font-semibold text-slate-700">{total}</span>
              </div>
            )}
          </div>

          {/* Note */}
          {item.note && (
            <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mb-3">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{item.note}</span>
            </div>
          )}

          {/* Syllabus inline viewer */}
          {item.syllabusText && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setSyllabusOpen(o => !o)}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                <FileText className="h-3.5 w-3.5" />
                {syllabusOpen ? 'Hide' : 'View'} Syllabus
                {syllabusOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              {syllabusOpen && (
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600 max-h-48 overflow-y-auto border border-slate-200 font-sans">
                  {item.syllabusText}
                </pre>
              )}
            </div>
          )}

          {/* Actions row */}
          <div className="flex gap-2 pt-3 border-t border-slate-100 flex-wrap">
            {/* Syllabus file download */}
            {item.syllabusFile && (
              <a
                href={item.syllabusFile}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-primary-600 bg-slate-50 hover:bg-primary-50 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Syllabus PDF
              </a>
            )}

            {/* Add / Edit syllabus */}
            <button
              onClick={() => setEditSyllabus(true)}
              className={`flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${hasSyllabus
                ? 'text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200'
                : 'text-primary-700 bg-primary-50 hover:bg-primary-100 border-primary-200'}`}
            >
              <Pencil className="h-3.5 w-3.5" />
              {hasSyllabus ? 'Edit Syllabus' : 'Add Syllabus'}
            </button>

            {/* Manage batches (labs only) */}
            {isLab && (
              <button
                onClick={() => onManageBatches(item)}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-white hover:bg-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Layers className="h-3.5 w-3.5" /> Manage Batches
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Syllabus edit modal */}
      {editSyllabus && (
        <SyllabusModal
          item={item}
          isLab={isLab}
          onClose={() => setEditSyllabus(false)}
          onSaved={(updated) => setItem(prev => ({ ...prev, ...updated }))}
        />
      )}
    </>
  );
};

// ─── BatchModal ───────────────────────────────────────────────────────────────
const BatchModal = ({ lab, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [mode, setMode] = useState('manual');
  const [rangeForm, setRangeForm] = useState({ batchName: 'Batch A', from: '', to: '' });

  useEffect(() => {
    api.get(`/faculty/lab-batches/${lab._id}`)
      .then(({ data }) => {
        setAllStudents(data.data.students || []);
        const raw = data.data.batches || [];
        setBatches(raw.map(b => ({
          batchName: b.batchName,
          studentIds: (b.studentIds || []).map(s => (typeof s === 'object' ? String(s._id) : String(s))),
        })));
      })
      .catch(() => toast.error('Failed to load lab data'))
      .finally(() => setLoading(false));
  }, [lab._id]);

  const assignedIds = new Set(batches.flatMap(b => b.studentIds));
  const unassigned = allStudents.filter(s => !assignedIds.has(String(s._id)));

  const addBatch = () => setBatches(prev => [...prev, { batchName: `Batch ${String.fromCharCode(65 + prev.length)}`, studentIds: [] }]);
  const removeBatch = (idx) => setBatches(prev => prev.filter((_, i) => i !== idx));
  const renameBatch = (idx, name) => setBatches(prev => prev.map((b, i) => i === idx ? { ...b, batchName: name } : b));

  const toggleStudent = (batchIdx, studentId) => {
    const sid = String(studentId);
    setBatches(prev => {
      const next = prev.map((b, i) => {
        if (i === batchIdx) {
          const has = b.studentIds.includes(sid);
          return { ...b, studentIds: has ? b.studentIds.filter(x => x !== sid) : [...b.studentIds, sid] };
        }
        // Remove from all other batches when adding
        return { ...b, studentIds: b.studentIds.filter(x => x !== sid) };
      });
      return next;
    });
  };

  const applyRange = () => {
    if (!rangeForm.from || !rangeForm.to || !rangeForm.batchName) return toast.error('Fill all range fields');
    const rangeStudents = allStudents
      .filter(s => s.enrollmentNo >= rangeForm.from && s.enrollmentNo <= rangeForm.to)
      .map(s => String(s._id));
    if (rangeStudents.length === 0) return toast.error('No students found in that enrollment range');

    setBatches(prev => {
      const cleaned = prev.map(b => ({
        ...b,
        studentIds: b.studentIds.filter(sid => !rangeStudents.includes(sid)),
      }));
      const existingIdx = cleaned.findIndex(b => b.batchName === rangeForm.batchName);
      if (existingIdx >= 0) {
        cleaned[existingIdx] = { ...cleaned[existingIdx], studentIds: [...new Set([...cleaned[existingIdx].studentIds, ...rangeStudents])] };
        return cleaned;
      }
      return [...cleaned, { batchName: rangeForm.batchName, studentIds: rangeStudents }];
    });
    toast.success(`Assigned ${rangeStudents.length} students to "${rangeForm.batchName}"`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/faculty/lab-batches/${lab._id}`, { batches });
      toast.success('Batches saved!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-emerald-50 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2 bg-emerald-100 text-emerald-700"><FlaskConical className="w-5 h-5" /></div>
            <div>
              <h2 className="font-semibold text-slate-800">Lab Batch Management</h2>
              <p className="text-xs text-slate-500">{lab.code} – {lab.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Mode toggle */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                {['manual', 'range'].map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === m ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
                    {m === 'manual' ? 'Manual Assignment' : 'Bulk by Enrollment Range'}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">{allStudents.length} students in this branch/semester</span>
            </div>

            {/* Bulk range form */}
            {mode === 'range' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="text-sm font-semibold text-emerald-800 mb-3">Assign by Enrollment Range</h3>
                <div className="flex flex-wrap gap-3 items-end">
                  {[['Batch Name', 'batchName', 'Batch A', 'w-32'], ['From Enrollment', 'from', 'e.g. 2300101', 'w-40 font-mono'], ['To Enrollment', 'to', 'e.g. 2300130', 'w-40 font-mono']].map(([lbl, key, ph, cls]) => (
                    <div key={key}>
                      <label className="text-xs text-slate-500 mb-1 block">{lbl}</label>
                      <input className={`input text-sm ${cls}`} value={rangeForm[key]}
                        onChange={e => setRangeForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} />
                    </div>
                  ))}
                  <button onClick={applyRange} className="btn-primary text-sm">Apply Range</button>
                </div>
                <p className="text-xs text-emerald-700 mt-2">
                  Students with enrollment number in [{rangeForm.from || '…'} – {rangeForm.to || '…'}] → "{rangeForm.batchName}"
                </p>
              </div>
            )}

            {unassigned.length > 0 && batches.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                {unassigned.length} student{unassigned.length !== 1 ? 's' : ''} not yet assigned to any batch.
              </div>
            )}

            <div className="space-y-4">
              {batches.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">No batches yet. Click "Add Batch" below.</div>
              )}
              {batches.map((batch, bIdx) => {
                const batchStudents = allStudents.filter(s => batch.studentIds.includes(String(s._id)));
                return (
                  <div key={bIdx} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-700 text-white">
                      <input className="bg-transparent border-b border-white/40 focus:border-white text-sm font-semibold outline-none w-32"
                        value={batch.batchName} onChange={e => renameBatch(bIdx, e.target.value)} />
                      <span className="text-slate-300 text-xs">{batchStudents.length} students</span>
                      <button onClick={() => removeBatch(bIdx)} className="ml-auto text-red-300 hover:text-red-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-x divide-slate-100">
                      <div className="p-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Assigned ({batchStudents.length})</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {batchStudents.length === 0
                            ? <p className="text-xs text-slate-400 italic text-center py-2">None yet</p>
                            : batchStudents.map(s => (
                              <div key={String(s._id)} className="flex items-center justify-between text-xs bg-emerald-50 rounded-lg px-2.5 py-1.5">
                                <div>
                                  <span className="font-medium text-slate-800">{s.firstName} {s.lastName}</span>
                                  <span className="text-slate-400 ml-1.5 font-mono">{s.enrollmentNo}</span>
                                </div>
                                <button onClick={() => toggleStudent(bIdx, s._id)} className="text-red-400 hover:text-red-600 ml-2">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Add Students</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {unassigned.length === 0
                            ? <p className="text-xs text-slate-400 italic text-center py-2">All students assigned</p>
                            : unassigned.map(s => (
                              <div key={String(s._id)} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-1.5 hover:bg-slate-100">
                                <div>
                                  <span className="font-medium text-slate-700">{s.firstName} {s.lastName}</span>
                                  <span className="text-slate-400 ml-1.5 font-mono">{s.enrollmentNo}</span>
                                </div>
                                <button onClick={() => toggleStudent(bIdx, s._id)} className="text-emerald-500 hover:text-emerald-700 ml-2">
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={addBatch}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl px-4 py-2.5 transition-colors w-full justify-center">
              <Plus className="w-4 h-4" /> Add Batch
            </button>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-shrink-0">
          <div className="text-xs text-slate-500">
            {batches.length} batch{batches.length !== 1 ? 'es' : ''} · {allStudents.length - unassigned.length} / {allStudents.length} students assigned
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="btn-primary text-sm bg-emerald-600 hover:bg-emerald-700 border-emerald-600">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Batches'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FacultySubjects() {
  const [classes, setClasses] = useState([]);
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batchLab, setBatchLab] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/faculty/subjects')
      .then(({ data }) => {
        setClasses(data.data.classes || []);
        setLabs(data.data.labs || []);
      })
      .catch(() => toast.error('Failed to load subjects'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const empty = !loading && classes.length === 0 && labs.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-primary-50 p-3 text-primary-700">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Subjects & Labs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {classes.length} theor{classes.length !== 1 ? 'ies' : 'y'} · {labs.length} lab{labs.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      )}

      {empty && (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="font-medium text-slate-600">No subjects or labs assigned for this session</p>
        </div>
      )}

      {!loading && !empty && (
        <>
          {/* Theory Subjects */}
          {classes.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-bold text-slate-800">Theory Subjects</h2>
                <span className="bg-primary-100 text-primary-700 text-xs font-semibold rounded-full px-2.5 py-0.5">{classes.length}</span>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> = syllabus added
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {classes.map(item => (
                  <SubjectCard key={item._id} item={item} isLab={false} onManageBatches={null} />
                ))}
              </div>
            </section>
          )}

          {/* Labs */}
          {labs.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <FlaskConical className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-800">Labs</h2>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full px-2.5 py-0.5">{labs.length}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3 mb-4 flex items-start gap-2 text-xs text-emerald-800">
                <Layers className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Click <strong>Manage Batches</strong> to divide students into practical groups. Click <strong>Add/Edit Syllabus</strong> to add lab manual / instructions.</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {labs.map(item => (
                  <SubjectCard key={item._id} item={item} isLab={true} onManageBatches={setBatchLab} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {batchLab && (
        <BatchModal lab={batchLab} onClose={() => { setBatchLab(null); load(); }} />
      )}
    </div>
  );
}
