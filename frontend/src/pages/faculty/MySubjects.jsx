import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { getDepartmentLabel } from '../../constants/departments';
import {
  BookOpen, FlaskConical, FileText, Users, Plus,
  Trash2, Save, X, ChevronDown, ChevronRight, Layers, Info, Pencil,
  ExternalLink, CheckCircle2, Upload, Search, Download,
  User, GraduationCap, Tag,
} from 'lucide-react';

const semLabel = (sem) => sem === 1 ? 'Sem A' : sem === 2 ? 'Sem B' : `Sem ${sem}`;
const yearLabel = (y) => ['', '1st', '2nd', '3rd', '4th'][y] || `${y}th`;

// ─── StudentsModal ────────────────────────────────────────────────────────────
const StudentsModal = ({ item, isLab, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState('');
  const [filterBatch, setFilterBatch] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');

  useEffect(() => {
    const endpoint = isLab
      ? `/faculty/lab-students/${item._id}`
      : `/faculty/subject-students/${item._id}`;
    api.get(endpoint)
      .then(({ data }) => {
        setStudents(data.data.students || []);
        setBatches(data.data.batches || []);
      })
      .catch(err => toast.error(err.response?.data?.message || 'Failed to load students'))
      .finally(() => setLoading(false));
  }, [item._id, isLab]);

  const sections = [...new Set(students.map(s => s.section).filter(Boolean))].sort();

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.firstName?.toLowerCase().includes(q) || s.lastName?.toLowerCase().includes(q) || s.enrollmentNo?.toLowerCase().includes(q);
    const matchBatch = filterBatch === 'ALL' || s.batch === filterBatch;
    const matchSection = filterSection === 'ALL' || s.section === filterSection;
    return matchSearch && matchBatch && matchSection;
  });

  const exportCSV = () => {
    const headers = ['S.No', 'Enrollment No', 'Name', 'Department', 'Year', 'Semester', 'Section', ...(isLab ? ['Batch'] : [])];
    const rows = filtered.map((s, i) => [
      i + 1, s.enrollmentNo, `${s.firstName} ${s.lastName}`, getDepartmentLabel(s.branch),
      `${yearLabel(s.year)} Year`, `Sem ${s.semester}`, s.section || '—',
      ...(isLab ? [s.batch || 'Unassigned'] : []),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = `${item.code}-students.csv`;
    a.click();
  };

  const genderCount = { M: 0, F: 0, Other: 0 };
  students.forEach(s => {
    if (s.gender === 'Male' || s.gender === 'M') genderCount.M++;
    else if (s.gender === 'Female' || s.gender === 'F') genderCount.F++;
    else genderCount.Other++;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 rounded-t-2xl flex-shrink-0 ${isLab ? 'bg-emerald-50' : 'bg-primary-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2 ${isLab ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-100 text-primary-700'}`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Enrolled Students</h2>
              <p className="text-xs text-slate-500">{item.code} — {item.name} · {getDepartmentLabel(item.branch)} · {semLabel(item.semester)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0 flex-wrap gap-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${isLab ? 'text-emerald-700' : 'text-primary-700'}`}>{students.length}</span>
                <span className="text-xs text-slate-500">total</span>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              {genderCount.M > 0 && <div className="text-xs"><span className="font-semibold text-blue-700">{genderCount.M}</span> <span className="text-slate-400">Male</span></div>}
              {genderCount.F > 0 && <div className="text-xs"><span className="font-semibold text-rose-600">{genderCount.F}</span> <span className="text-slate-400">Female</span></div>}
              {sections.length > 0 && (
                <>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Tag className="w-3.5 h-3.5" />
                    Sections: {sections.map(sec => (
                      <span key={sec} className="bg-slate-200 text-slate-700 rounded px-1.5 py-0.5 font-medium ml-1">{sec}</span>
                    ))}
                  </div>
                </>
              )}
              {isLab && batches.length > 0 && (
                <>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Layers className="w-3.5 h-3.5" />
                    Batches: {batches.map(b => (
                      <span key={b} className="bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 font-medium ml-1">{b}</span>
                    ))}
                  </div>
                </>
              )}
              <div className="ml-auto">
                <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-primary-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 flex-shrink-0 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  className="input pl-8 text-sm h-9"
                  placeholder="Search name or enrollment no…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {sections.length > 1 && (
                <select className="input text-sm h-9 w-32" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                  <option value="ALL">All Sections</option>
                  {sections.map(sec => <option key={sec} value={sec}>Section {sec}</option>)}
                </select>
              )}
              {isLab && batches.length > 0 && (
                <select className="input text-sm h-9 w-32" value={filterBatch} onChange={e => setFilterBatch(e.target.value)}>
                  <option value="ALL">All Batches</option>
                  {batches.map(b => <option key={b} value={b}>{b}</option>)}
                  <option value={null}>Unassigned</option>
                </select>
              )}
              {(search || filterBatch !== 'ALL' || filterSection !== 'ALL') && (
                <span className="text-xs text-slate-400">{filtered.length} / {students.length} shown</span>
              )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No students found</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <tr>
                      {['#', 'Enrollment No', 'Name', 'Dept', 'Year / Sem', 'Section', ...(isLab ? ['Batch'] : [])].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => (
                      <tr key={String(s._id)} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-700">{s.enrollmentNo}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s.gender === 'Female' || s.gender === 'F' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                              {(s.firstName?.[0] || '?').toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-800">{s.firstName} {s.lastName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="bg-primary-50 text-primary-700 text-xs font-semibold rounded px-2 py-0.5">{getDepartmentLabel(s.branch)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-xs">
                          <span className="font-medium">{yearLabel(s.year)} Year</span>
                          <span className="text-slate-400 ml-1">· {semLabel(s.semester)}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {s.section && s.section !== '—'
                            ? <span className="bg-slate-100 text-slate-600 text-xs font-medium rounded px-2 py-0.5">Sec {s.section}</span>
                            : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        {isLab && (
                          <td className="px-4 py-2.5">
                            {s.batch
                              ? <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold rounded px-2 py-0.5">{s.batch}</span>
                              : <span className="text-amber-500 text-xs bg-amber-50 rounded px-2 py-0.5">Unassigned</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-shrink-0 flex justify-end">
              <button onClick={onClose} className="btn-secondary text-sm">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

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
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 rounded-t-2xl ${isLab ? 'bg-emerald-50' : 'bg-primary-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2 ${isLab ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-100 text-primary-700'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">{item.syllabusText || item.syllabusFile ? 'Edit' : 'Add'} Syllabus</h2>
              <p className="text-xs text-slate-500">{item.code} – {item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {item.syllabusFile && !file && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-0.5">Current file</p>
                <a href={item.syllabusFile} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline flex items-center gap-1 truncate">
                  View / Download <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </div>
            </div>
          )}
          <div>
            <label className="label">{isLab ? 'Lab Manual / Experiment List' : 'Syllabus Text'}</label>
            <textarea className="input font-mono text-sm" rows={10} value={text} onChange={e => setText(e.target.value)}
              placeholder={isLab ? 'Experiment 1: ...\nExperiment 2: ...' : 'Unit 1: Introduction\n  - Topic A'} />
          </div>
          <div>
            <label className="label">Upload File <span className="text-slate-400 font-normal">(PDF/DOC/Image)</span></label>
            <div className="flex items-center gap-3">
              <label className={`flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-xl px-4 py-3 text-sm flex-1 transition-colors ${file ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-300 hover:border-slate-400 text-slate-500'}`}>
                <Upload className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{file ? file.name : 'Choose file…'}</span>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
              {file && <button onClick={() => setFile(null)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex-shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className={`btn-primary flex-1 ${isLab ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600' : ''}`}>
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Syllabus'}
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
  const [viewStudents, setViewStudents] = useState(false);
  const total = (item.theoryEndMax || 0) + (item.cwMax || 0) + (item.practicalEndMax || 0) + (item.swMax || 0);
  const hasSyllabus = item.syllabusText || item.syllabusFile;

  return (
    <>
      <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isLab ? 'border-emerald-200' : 'border-slate-200'}`}>
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
            <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${hasSyllabus ? 'text-emerald-500' : 'text-slate-300'}`} title={hasSyllabus ? 'Syllabus added' : 'No syllabus yet'} />
          </div>

          {/* Meta pills */}
          <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
            <span className="bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 font-medium">{getDepartmentLabel(item.branch)}</span>
            <span className="bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 font-medium">{semLabel(item.semester)}</span>
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${isLab ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-100 text-primary-700'}`}>{item.credits} Cr</span>
            <span className="bg-slate-50 text-slate-500 rounded-full px-2.5 py-0.5 font-mono">L-T-P {item.l ?? 0}-{item.t ?? 0}-{item.p ?? 0}</span>
          </div>

          {/* Marks row */}
          {total > 0 && (
            <div className="flex gap-1.5 flex-wrap text-xs mb-3">
              {item.theoryEndMax > 0 && <div className="bg-slate-50 rounded-lg px-2 py-1 text-center"><div className="font-bold text-slate-700">{item.theoryEndMax}</div><div className="text-slate-400">Th.End</div></div>}
              {item.cwMax > 0 && <div className="bg-slate-50 rounded-lg px-2 py-1 text-center"><div className="font-bold text-slate-700">{item.cwMax}</div><div className="text-slate-400">CW</div></div>}
              {item.practicalEndMax > 0 && <div className="bg-emerald-50 rounded-lg px-2 py-1 text-center"><div className="font-bold text-emerald-700">{item.practicalEndMax}</div><div className="text-emerald-500">Pr.End</div></div>}
              {item.swMax > 0 && <div className="bg-emerald-50 rounded-lg px-2 py-1 text-center"><div className="font-bold text-emerald-700">{item.swMax}</div><div className="text-emerald-500">SW</div></div>}
            </div>
          )}

          {/* Syllabus inline */}
          {item.syllabusText && (
            <div className="mb-3">
              <button type="button" onClick={() => setSyllabusOpen(o => !o)}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
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

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t border-slate-100 flex-wrap">
            {/* View Students */}
            <button
              onClick={() => setViewStudents(true)}
              className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition-colors ${isLab ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' : 'text-primary-700 bg-primary-50 hover:bg-primary-100 border-primary-200'}`}
            >
              <Users className="h-3.5 w-3.5" /> Students
            </button>

            {/* Syllabus file */}
            {item.syllabusFile && (
              <a href={item.syllabusFile} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-primary-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
                <Download className="h-3.5 w-3.5" /> Syllabus
              </a>
            )}

            {/* Add / Edit syllabus */}
            <button onClick={() => setEditSyllabus(true)}
              className={`flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${hasSyllabus ? 'text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200' : 'text-primary-700 bg-primary-50 hover:bg-primary-100 border-primary-200'}`}>
              <Pencil className="h-3.5 w-3.5" />
              {hasSyllabus ? 'Edit Syllabus' : 'Add Syllabus'}
            </button>

            {/* Manage batches (labs only) */}
            {isLab && (
              <button onClick={() => onManageBatches(item)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-white hover:bg-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
                <Layers className="h-3.5 w-3.5" /> Batches
              </button>
            )}
          </div>
        </div>
      </div>

      {viewStudents && <StudentsModal item={item} isLab={isLab} onClose={() => setViewStudents(false)} />}
      {editSyllabus && (
        <SyllabusModal item={item} isLab={isLab} onClose={() => setEditSyllabus(false)}
          onSaved={(updated) => setItem(prev => ({ ...prev, ...updated }))} />
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
  const [sectionBatches, setSectionBatches] = useState([]);
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
        const sec = data.data.sectionBatches || [];
        setSectionBatches(sec);
        if (sec.length) setRangeForm(f => ({ ...f, batchName: sec[0] }));
      })
      .catch(() => toast.error('Failed to load lab data'))
      .finally(() => setLoading(false));
  }, [lab._id]);

  const assignedIds = new Set(batches.flatMap(b => b.studentIds));
  const unassigned = allStudents.filter(s => !assignedIds.has(String(s._id)));

  const addBatch = () => setBatches(prev => {
    const used = new Set(prev.map(b => b.batchName));
    const nextName = sectionBatches.find(name => !used.has(name))
      || `Batch ${String.fromCharCode(65 + prev.length)}`;
    return [...prev, { batchName: nextName, studentIds: [] }];
  });
  const removeBatch = (idx) => setBatches(prev => prev.filter((_, i) => i !== idx));
  const renameBatch = (idx, name) => setBatches(prev => prev.map((b, i) => i === idx ? { ...b, batchName: name } : b));

  const toggleStudent = (batchIdx, studentId) => {
    const sid = String(studentId);
    setBatches(prev => prev.map((b, i) => {
      if (i === batchIdx) {
        const has = b.studentIds.includes(sid);
        return { ...b, studentIds: has ? b.studentIds.filter(x => x !== sid) : [...b.studentIds, sid] };
      }
      return { ...b, studentIds: b.studentIds.filter(x => x !== sid) };
    }));
  };

  const applyRange = () => {
    if (!rangeForm.from || !rangeForm.to || !rangeForm.batchName) return toast.error('Fill all range fields');
    const rangeStudents = allStudents.filter(s => s.enrollmentNo >= rangeForm.from && s.enrollmentNo <= rangeForm.to).map(s => String(s._id));
    if (!rangeStudents.length) return toast.error('No students found in that enrollment range');
    setBatches(prev => {
      const cleaned = prev.map(b => ({ ...b, studentIds: b.studentIds.filter(sid => !rangeStudents.includes(sid)) }));
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
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                {['manual', 'range'].map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === m ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
                    {m === 'manual' ? 'Manual Assignment' : 'Bulk by Enrollment Range'}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">{allStudents.length} students · {unassigned.length} unassigned</span>
            </div>

            {mode === 'range' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="text-sm font-semibold text-emerald-800 mb-3">Assign by Enrollment Range</h3>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Batch Name</label>
                    {sectionBatches.length ? (
                      <select className="input text-sm h-9 w-32" value={rangeForm.batchName}
                        onChange={e => setRangeForm(f => ({ ...f, batchName: e.target.value }))}>
                        {sectionBatches.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                    ) : (
                      <input className="input text-sm h-9 w-32" value={rangeForm.batchName}
                        onChange={e => setRangeForm(f => ({ ...f, batchName: e.target.value }))} placeholder="Batch A" />
                    )}
                  </div>
                  {[['From', 'from', '2300101', 'w-36 font-mono'], ['To', 'to', '2300130', 'w-36 font-mono']].map(([lbl, key, ph, cls]) => (
                    <div key={key}>
                      <label className="text-xs text-slate-500 mb-1 block">{lbl}</label>
                      <input className={`input text-sm h-9 ${cls}`} value={rangeForm[key]}
                        onChange={e => setRangeForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} />
                    </div>
                  ))}
                  <button onClick={applyRange} className="btn-primary text-sm">Apply</button>
                </div>
                {sectionBatches.length > 0 && (
                  <p className="text-xs text-emerald-700 mt-2">
                    Section batches: {sectionBatches.join(', ')} — use these names so the timetable shows the right lab.
                  </p>
                )}
              </div>
            )}

            {unassigned.length > 0 && batches.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                {unassigned.length} student{unassigned.length !== 1 ? 's' : ''} not yet assigned to any batch.
              </div>
            )}

            <div className="space-y-4">
              {batches.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">No batches yet. Click "Add Batch" below.</div>}
              {batches.map((batch, bIdx) => {
                const batchStudents = allStudents.filter(s => batch.studentIds.includes(String(s._id)));
                return (
                  <div key={bIdx} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-700 text-white">
                      <input className="bg-transparent border-b border-white/40 focus:border-white text-sm font-semibold outline-none w-32"
                        value={batch.batchName} onChange={e => renameBatch(bIdx, e.target.value)} />
                      <span className="text-slate-300 text-xs">{batchStudents.length} students</span>
                      <button onClick={() => removeBatch(bIdx)} className="ml-auto text-red-300 hover:text-red-100"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-x divide-slate-100">
                      <div className="p-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Assigned ({batchStudents.length})</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {batchStudents.length === 0
                            ? <p className="text-xs text-slate-400 italic text-center py-2">None yet</p>
                            : batchStudents.map(s => (
                              <div key={String(s._id)} className="flex items-center justify-between text-xs bg-emerald-50 rounded-lg px-2.5 py-1.5">
                                <div><span className="font-medium text-slate-800">{s.firstName} {s.lastName}</span><span className="text-slate-400 ml-1.5 font-mono">{s.enrollmentNo}</span></div>
                                <button onClick={() => toggleStudent(bIdx, s._id)} className="text-red-400 hover:text-red-600 ml-2"><X className="w-3 h-3" /></button>
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Add from Unassigned</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {unassigned.length === 0
                            ? <p className="text-xs text-slate-400 italic text-center py-2">All assigned</p>
                            : unassigned.map(s => (
                              <div key={String(s._id)} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-1.5 hover:bg-slate-100">
                                <div><span className="font-medium text-slate-700">{s.firstName} {s.lastName}</span><span className="text-slate-400 ml-1.5 font-mono">{s.enrollmentNo}</span></div>
                                <button onClick={() => toggleStudent(bIdx, s._id)} className="text-emerald-500 hover:text-emerald-700 ml-2"><Plus className="w-3.5 h-3.5" /></button>
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
          <div className="text-xs text-slate-500">{batches.length} batch{batches.length !== 1 ? 'es' : ''} · {allStudents.length - unassigned.length} / {allStudents.length} assigned</div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm bg-emerald-600 hover:bg-emerald-700 border-emerald-600">
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
        <div className="rounded-xl bg-primary-50 p-3 text-primary-700"><BookOpen className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Subjects & Labs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {classes.length} theor{classes.length !== 1 ? 'ies' : 'y'} · {labs.length} lab{labs.length !== 1 ? 's' : ''}
            <span className="ml-3 text-slate-400">Click <strong>Students</strong> on any card to see enrolled students</span>
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
                {classes.map(item => <SubjectCard key={item._id} item={item} isLab={false} onManageBatches={null} />)}
              </div>
            </section>
          )}

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
                <span>Click <strong>Students</strong> to see enrolled students &amp; batch info. Click <strong>Batches</strong> to manage lab groups.</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {labs.map(item => <SubjectCard key={item._id} item={item} isLab={true} onManageBatches={setBatchLab} />)}
              </div>
            </section>
          )}
        </>
      )}

      {batchLab && <BatchModal lab={batchLab} onClose={() => { setBatchLab(null); load(); }} />}
    </div>
  );
}
