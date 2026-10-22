import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { 
  Save, 
  BarChart3, 
  Plus, 
  X, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  FileSpreadsheet, 
  Download,
  LayoutGrid,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import MySubjectsView from './marks/MySubjectsView';
import SubjectMarksSheet from './marks/SubjectMarksSheet';

export default function FacultyMarks() {
  const { selectedSession, selectedTerm } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [session, setSession] = useState('');
  const [existingResults, setExistingResults] = useState([]);
  const [subjectStats, setSubjectStats] = useState({});
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  // Phase 1 navigation state
  const [activeSubject, setActiveSubject] = useState(null);
  const [showLegacyMode, setShowLegacyMode] = useState(false);

  // Legacy tab state (preserved for full backward compatibility)
  const [tab, setTab] = useState('update');
  const [students, setStudents] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [semester, setSemester] = useState('5');
  const [entries, setEntries] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Legacy Excel upload state
  const [excelFile, setExcelFile] = useState(null);
  const [excelSubject, setExcelSubject] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [courseworkSubject, setCourseworkSubject] = useState('');
  const [courseworkFile, setCourseworkFile] = useState(null);
  const [courseworkMode, setCourseworkMode] = useState('average');
  const [courseworkResult, setCourseworkResult] = useState(null);

  // Sync session from auth context or fallback
  useEffect(() => {
    if (selectedSession) setSession(selectedSession);
    else {
      const saved = localStorage.getItem('erp_academic_session');
      if (saved) setSession(saved);
    }
  }, [selectedSession]);

  useEffect(() => {
    setActiveSubject(null);
    setSelectedSubject('');
    setShowLegacyMode(false);
  }, [selectedSession, selectedTerm]);

  // Load faculty subjects
  const loadFacultyData = useCallback(async () => {
    setLoadingSubjects(true);
    try {
      const res = await api.get('/faculty/subjects');
      const loadedSubjects = res.data?.data?.subjects || [];
      setSubjects(loadedSubjects);

      if (loadedSubjects.length > 0 && session) {
        // Collect distinct semesters
        const semesters = [...new Set(loadedSubjects.map(s => Number(s.semester)).filter(Boolean))];

        // Fetch existing results for all semesters
        const resultsPromises = semesters.map(sem => 
          api.get(`/faculty/marks?semester=${sem}&session=${encodeURIComponent(session)}`)
            .then(r => r.data?.data?.results || [])
            .catch(() => [])
        );
        const resultsArrays = await Promise.all(resultsPromises);
        const allResults = resultsArrays.flat();
        setExistingResults(allResults);

        // Fetch student roster counts per branch and semester
        const branchSemCombos = [...new Set(loadedSubjects.map(s => `${s.branch}___${s.semester}`))];
        const countMap = {};

        await Promise.all(branchSemCombos.map(async (combo) => {
          const [branch, sem] = combo.split('___');
          try {
            let q = `?branch=${encodeURIComponent(branch)}&semester=${encodeURIComponent(sem)}&session=${encodeURIComponent(session)}&limit=1000`;
            let { data } = await api.get(`/admin/students${q}`);
            let roster = data.data?.students || [];
            if (roster.length <= 2) {
              const resp2 = await api.get(`/admin/students?branch=${encodeURIComponent(branch)}&semester=${encodeURIComponent(sem)}&limit=1000`);
              const roster2 = resp2.data?.data?.students || [];
              if (roster2.length > roster.length) roster = roster2;
            }
            countMap[combo] = roster.length;
          } catch (e) {
            countMap[combo] = 0;
          }
        }));

        // Build stats per subject
        const stats = {};
        loadedSubjects.forEach(s => {
          const combo = `${s.branch}___${s.semester}`;
          const totalStudents = countMap[combo] || 0;
          const isLab = s.itemType === 'lab';

          // Find student marks matching this subject
          const marksList = [];
          allResults.forEach(r => {
            const mark = (r.subjectMarks || []).find(sm => (
              isLab
                ? String(sm.labId?._id || sm.labId) === String(s._id)
                : String(sm.subjectId?._id || sm.subjectId) === String(s._id)
            ));
            if (mark && mark.totalMarks != null) {
              marksList.push(mark);
            }
          });

          let status = 'not_started';
          let rejectionReason = '';

          if (marksList.length > 0) {
            const hasRejected = marksList.some(m => m.submissionStatus === 'rejected');
            const hasPending = marksList.some(m => m.submissionStatus === 'pending');
            const allApproved = marksList.every(m => m.submissionStatus === 'approved') && totalStudents > 0 && marksList.length >= totalStudents;

            if (hasRejected) {
              status = 'rejected';
              const rejectedItem = marksList.find(m => m.submissionStatus === 'rejected' && m.rejectionReason);
              if (rejectedItem) rejectionReason = rejectedItem.rejectionReason;
            } else if (allApproved) {
              status = 'approved';
            } else if (hasPending) {
              status = 'pending';
            } else {
              status = 'draft';
            }
          }

          stats[s._id] = {
            totalStudents,
            filledCount: marksList.length,
            status,
            rejectionReason,
          };
        });

        setSubjectStats(stats);
      }
    } catch (err) {
      toast.error('Failed to load faculty subjects');
    } finally {
      setLoadingSubjects(false);
    }
  }, [session, selectedTerm]);

  useEffect(() => {
    loadFacultyData();
  }, [loadFacultyData]);

  // Handle selecting a subject from My Subjects
  const handleSelectSubject = (subj) => {
    setActiveSubject(subj);
    setSelectedSubject(subj._id);
    if (subj.semester) setSemester(String(subj.semester));
  };

  const handleBackToSubjects = () => {
    setActiveSubject(null);
    loadFacultyData();
  };

  // Legacy helper functions
  const selectSubjectAndSemester = (setter, subjectId) => {
    setter(subjectId);
    const subject = subjects.find(s => s._id === subjectId);
    if (subject?.semester !== undefined && subject?.semester !== null) {
      setSemester(String(subject.semester));
    }
  };

  const loadExisting = () => {
    api.get(`/faculty/marks?semester=${semester}&session=${session}`).then(r => {
      setExistingResults(r.data?.data?.results || []);
    });
  };

  useEffect(() => {
    const load = async () => {
      const activeSubjectId = tab === 'excel' ? excelSubject : selectedSubject;
      if (!activeSubjectId) return setStudents([]);
      const subj = subjects.find(s => s._id === activeSubjectId);
      if (!subj) return setStudents([]);
      const sem = semester || subj.semester;
      setLoadingStudents(true);
      try {
        let q = `?branch=${encodeURIComponent(subj.branch)}&semester=${encodeURIComponent(sem)}&session=${encodeURIComponent(session)}&limit=1000`;
        let { data } = await api.get(`/admin/students${q}`);
        let roster = data.data?.students || [];
        if (roster.length <= 2) {
          try {
            q = `?branch=${encodeURIComponent(subj.branch)}&semester=${encodeURIComponent(sem)}&limit=1000`;
            const resp2 = await api.get(`/admin/students${q}`);
            const roster2 = resp2.data?.data?.students || [];
            if (roster2.length > roster.length) {
              roster = roster2;
            }
          } catch (e) { }
        }
        setStudents(roster);
      } catch (err) {
        setStudents([]);
      }
      setLoadingStudents(false);
    };
    if (showLegacyMode) load();
  }, [selectedSubject, excelSubject, semester, session, subjects, tab, showLegacyMode]);

  useEffect(() => {
    if (showLegacyMode && tab === 'view') loadExisting();
  }, [tab, semester, session, showLegacyMode]);

  const addEntry = () => {
    setEntries([...entries, { studentId: '', cw: '', sw: '', theory: '', practical: '' }]);
  };

  const populateRoster = async () => {
    const activeSub = tab === 'excel' ? excelSubject : selectedSubject;
    if (!activeSub) return toast.error('Select a subject first');
    const subj = subjects.find(s => s._id === activeSub);
    if (!subj) return toast.error('Subject not found');
    const sem = semester || subj.semester;
    setLoadingStudents(true);
    try {
      let q = `?branch=${encodeURIComponent(subj.branch)}&semester=${encodeURIComponent(sem)}&session=${encodeURIComponent(session)}&limit=1000`;
      let { data } = await api.get(`/admin/students${q}`);
      let roster = data.data?.students || [];
      if (roster.length <= 2) {
        try {
          q = `?branch=${encodeURIComponent(subj.branch)}&semester=${encodeURIComponent(sem)}&limit=1000`;
          const resp2 = await api.get(`/admin/students${q}`);
          const roster2 = resp2.data?.data?.students || [];
          if (roster2.length > roster.length) roster = roster2;
        } catch (e) { }
      }
      if (roster.length === 0) return toast.error('No students found for this subject/semester/session');
      const rows = roster.map(s => ({ studentId: s._id, cw: '', sw: '', theory: '', practical: '' }));
      setEntries(rows);
      setStudents(roster);
      toast.success(`${rows.length} students added to entries`);
    } catch (err) {
      toast.error('Failed to load students');
    }
    setLoadingStudents(false);
  };

  const updateLegacyEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const removeEntry = (idx) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const handleLegacySubmit = async () => {
    if (entries.length === 0) return toast.error('Add at least one entry');
    if (!selectedSubject) return toast.error('Select a subject');
    const activeItem = subjects.find(s => s._id === selectedSubject);
    const valid = entries.every(e => e.studentId
      && (activeItem?.itemType === 'lab'
        ? e.sw !== '' && e.practical !== ''
        : e.cw !== '' && e.theory !== ''));
    if (!valid) return toast.error('Fill all required fields');

    const limits = activeItem?.itemType === 'lab'
      ? { sw: 40, practical: 60 }
      : { cw: 30, theory: 70 };
    const invalidEntry = entries.find((entry, index) => Object.entries(limits).some(([field, max]) => {
      const value = Number(entry[field]);
      if (!Number.isFinite(value) || value < 0 || value > max) {
        toast.error(`Entry ${index + 1}: ${field.toUpperCase()} must be between 0 and ${max}`);
        return true;
      }
      return false;
    }));
    if (invalidEntry) return;

    setSubmitting(true);
    try {
      await api.post('/faculty/marks', {
        semester: Number(semester),
        session,
        entries: entries.map(e => ({
          studentId: e.studentId,
          ...(activeItem?.itemType === 'lab' ? { labId: selectedSubject, itemType: 'lab' } : { subjectId: selectedSubject, itemType: 'class' }),
          cw: Number(e.cw) || 0,
          sw: Number(e.sw) || 0,
          theory: Number(e.theory) || 0,
          practical: Number(e.practical) || 0,
        })),
      });
      toast.success('Marks submitted. Admin review is pending.');
      setEntries([]);
      loadFacultyData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update marks');
    }
    setSubmitting(false);
  };

  // Legacy Excel Upload
  const handleExcelUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) return toast.error('Please select a file');
    if (!excelSubject) return toast.error('Please select a subject');

    const activeItem = subjects.find(s => s._id === excelSubject);
    const formData = new FormData();
    formData.append('file', excelFile);
    if (activeItem?.itemType === 'lab') {
      formData.append('labId', excelSubject);
      formData.append('itemType', 'lab');
    } else {
      formData.append('subjectId', excelSubject);
      formData.append('itemType', 'class');
    }
    formData.append('semester', semester);
    formData.append('session', session);

    setUploading(true);
    try {
      const { data } = await api.post('/faculty/marks/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(data.data);
      toast.success(`Processed ${data.data.success.length} entries`);
      setExcelFile(null);
      loadFacultyData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    }
    setUploading(false);
  };

  // Legacy Coursework Upload
  const handleCourseworkUpload = async (e) => {
    e.preventDefault();
    const item = subjects.find(s => s._id === courseworkSubject);
    if (!item || !courseworkFile) return toast.error('Select an item and CSV/Excel file');
    const formData = new FormData();
    formData.append('file', courseworkFile);
    formData.append(item.itemType === 'lab' ? 'labId' : 'subjectId', courseworkSubject);
    formData.append('itemType', item.itemType || 'class');
    formData.append('semester', semester);
    formData.append('session', session);
    formData.append('midTermMode', courseworkMode);
    formData.append('publishNotice', 'true');
    setUploading(true);
    try {
      const { data } = await api.post('/faculty/marks/coursework-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCourseworkResult(data.data);
      setCourseworkFile(null);
      toast.success(`Uploaded ${data.data.success.length} student internal marks and published a student notice`);
      loadFacultyData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Internal marks upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!excelSubject || !semester || !session) {
      return toast.error('Select Subject, Semester, and Session to download template');
    }
    const selectedItem = subjects.find(s => s._id === excelSubject);
    const q = `?${selectedItem?.itemType === 'lab' ? 'labId' : 'subjectId'}=${encodeURIComponent(excelSubject)}&itemType=${selectedItem?.itemType || 'class'}&semester=${encodeURIComponent(semester)}&session=${encodeURIComponent(session)}&_=${Date.now()}`;
    try {
      const resp = await api.get(`/faculty/marks/template${q}`, { responseType: 'blob' });
      const disposition = resp.headers['content-disposition'] || '';
      let filename = 'marks_template.xlsx';
      const match = /filename\*?=([^;]+)/i.exec(disposition);
      if (match) filename = match[1].replace(/UTF-8''/, '').replace(/"/g, '').trim();

      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download template');
    }
  };

  const handleDownloadSubmitted = async () => {
    if (!selectedSubject || !semester || !session) return toast.error('Select subject, semester and session to download');
    const activeItem = subjects.find(s => s._id === selectedSubject);
    const q = activeItem?.itemType === 'lab'
      ? `?labId=${selectedSubject}&itemType=lab&semester=${semester}&session=${encodeURIComponent(session)}`
      : `?subjectId=${selectedSubject}&itemType=class&semester=${semester}&session=${encodeURIComponent(session)}`;
    try {
      const resp = await api.get(`/faculty/marks/export${q}`, { responseType: 'blob' });
      const disposition = resp.headers['content-disposition'] || '';
      let filename = 'submitted_marks.xlsx';
      const match = /filename\*?=([^;]+)/i.exec(disposition);
      if (match) filename = match[1].replace(/UTF-8''/, '').replace(/"/g, '').trim();

      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download submitted marks');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Update Marks</h1>
          <p className="text-slate-500 text-sm mt-1">
            Academic Session: <strong className="text-slate-700">{session || 'Not selected'}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowLegacyMode(!showLegacyMode);
              if (showLegacyMode) setActiveSubject(null);
            }}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            title="Toggle between redesigned experience and legacy 4-tab interface"
          >
            {showLegacyMode ? (
              <>
                <LayoutGrid className="w-3.5 h-3.5 text-primary-600" />
                <span>Switch to My Subjects View</span>
              </>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Legacy View</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* NEW REDESIGNED FLOW (PHASE 1) */}
      {!showLegacyMode && (
        <>
          {activeSubject ? (
            <SubjectMarksSheet
              subject={activeSubject}
              session={session}
              onBack={handleBackToSubjects}
              onSubmissionSuccess={() => {
                setActiveSubject(null);
                loadFacultyData();
              }}
              existingResults={existingResults}
            />
          ) : (
            <MySubjectsView
              subjects={subjects}
              loading={loadingSubjects}
              session={session}
              subjectStats={subjectStats}
              onSelectSubject={handleSelectSubject}
              onDownloadTemplate={handleDownloadTemplate}
              onDownloadSubmitted={handleDownloadSubmitted}
            />
          )}
        </>
      )}

      {/* LEGACY 4-TAB FLOW (PRESERVED BEHIND THE TOGGLE) */}
      {showLegacyMode && (
        <div className="border-t border-slate-200 pt-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-center justify-between text-xs text-amber-800">
            <span>You are viewing the legacy 4-tab interface. All existing flows and routes remain supported.</span>
            <button
              onClick={() => setShowLegacyMode(false)}
              className="font-semibold underline ml-4 hover:text-amber-900"
            >
              Return to My Subjects
            </button>
          </div>

          {/* Legacy Tabs */}
          <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
            <button onClick={() => setTab('update')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'update' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>Manual Entry</button>
            <button onClick={() => setTab('excel')} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'excel' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}><FileSpreadsheet className="w-4 h-4" /> Upload Excel</button>
            <button onClick={() => setTab('coursework')} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'coursework' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}><Upload className="w-4 h-4" /> Internal / CW Upload</button>
            <button onClick={() => setTab('view')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'view' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>View Results</button>
          </div>

          {/* Manual Entry Tab */}
          {tab === 'update' && (
            <>
              <div className="card mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Subject *</label>
                    <select className="input" value={selectedSubject} onChange={e => selectSubjectAndSemester(setSelectedSubject, e.target.value)}>
                      <option value="">Select subject</option>
                      {subjects.map(s => <option key={s._id} value={s._id}>{s.itemType === 'lab' ? 'Lab: ' : 'Class: '}{s.code} — {s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Semester (from subject)</label>
                    <input type="number" className="input" value={semester} readOnly={Boolean(selectedSubject)} aria-readonly={Boolean(selectedSubject)} />
                  </div>
                  <div>
                    <label className="label">Session</label>
                    <input className="input" value={session} onChange={e => setSession(e.target.value)} placeholder="e.g. 2024-25" />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800">Mark Entries</h3>
                  <div className="flex gap-2">
                    <button onClick={addEntry} className="btn-secondary text-xs flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Add Student
                    </button>
                    <button onClick={populateRoster} disabled={!selectedSubject || loadingStudents} className="btn-secondary text-xs flex items-center gap-1" title="Populate all students from this class">
                      <Download className="w-4 h-4" /> Populate Roster
                    </button>
                  </div>
                </div>

                {entries.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">Click "Add Student" or "Populate Roster" to start entering marks</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {entries.map((e, i) => {
                        const activeItem = subjects.find(s => s._id === selectedSubject);
                        const isLab = activeItem?.itemType === 'lab';
                        return (
                          <div key={i} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                              <div>
                                <label className="label text-xs">Student *</label>
                                <select 
                                  className="input text-sm"
                                  value={e.studentId}
                                  onChange={ev => updateLegacyEntry(i, 'studentId', ev.target.value)}
                                >
                                  <option value="">Select student</option>
                                  {students.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.enrollmentNo})</option>)}
                                </select>
                              </div>
                              <div>
                                {!isLab && <label className="label text-xs">CW (max 30)</label>}
                                {!isLab && (
                                  <input 
                                    type="number" 
                                    className="input text-sm"
                                    value={e.cw}
                                    onChange={ev => updateLegacyEntry(i, 'cw', ev.target.value)}
                                    placeholder="0-30"
                                    min="0"
                                    max="30"
                                  />
                                )}
                              </div>
                              {isLab && (
                                <div>
                                  <label className="label text-xs">SW (max 40)</label>
                                  <input 
                                    type="number"
                                    className="input text-sm"
                                    value={e.sw}
                                    onChange={ev => updateLegacyEntry(i, 'sw', ev.target.value)}
                                    placeholder="0-40"
                                    min="0"
                                    max="40"
                                  />
                                </div>
                              )}
                              <div>
                                {isLab ? (
                                  <>
                                    <label className="label text-xs">Practical (max 60)</label>
                                    <input type="number" className="input text-sm" value={e.practical}
                                      onChange={ev => updateLegacyEntry(i, 'practical', ev.target.value)}
                                      placeholder="0-60" min="0" max="60" />
                                  </>
                                ) : (
                                  <>
                                    <label className="label text-xs">Theory (max 70)</label>
                                    <input type="number" className="input text-sm" value={e.theory}
                                      onChange={ev => updateLegacyEntry(i, 'theory', ev.target.value)}
                                      placeholder="0-70" min="0" max="70" />
                                  </>
                                )}
                              </div>
                              <div className="flex items-end">
                                <button onClick={() => removeEntry(i)} className="btn-danger text-xs w-full">
                                  <X className="w-4 h-4 inline" /> Remove
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                              Total: {isLab ? (Number(e.sw) || 0) + (Number(e.practical) || 0) : (Number(e.cw) || 0) + (Number(e.theory) || 0)} / 100
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                      <button onClick={() => setEntries([])} className="btn-secondary">Clear All</button>
                      <button onClick={handleLegacySubmit} disabled={submitting} className="btn-primary">
                        <Save className="w-4 h-4" /> {submitting ? 'Saving...' : 'Submit Marks'}
                      </button>
                      <button onClick={handleDownloadSubmitted} disabled={!selectedSubject || !semester || !session} className="btn-secondary">Download Submitted Marks</button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Legacy Coursework Tab */}
          {tab === 'coursework' && (
            <div className="card max-w-4xl">
              <h3 className="font-semibold text-slate-800">Upload Mid Term, Assignment and Lab Internal Marks</h3>
              <p className="text-sm text-slate-500 mt-1">
                Class: Mid Term 1 + Mid Term 2 (average/best of 20) + assignments (10) = CW / 30.<br />
                Lab: attendance (10) + assignments (10) + internal (20) = SW / 40.
              </p>
              <form onSubmit={handleCourseworkUpload} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="label">Class / Lab *</label>
                    <select className="input" value={courseworkSubject} onChange={e => selectSubjectAndSemester(setCourseworkSubject, e.target.value)}>
                      <option value="">Select item</option>
                      {subjects.map(s => <option key={s._id} value={s._id}>{s.itemType === 'lab' ? 'LAB: ' : 'CLASS: '}{s.code} — {s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Semester (from item) *</label>
                    <input type="number" className="input" value={semester} readOnly={Boolean(courseworkSubject)} aria-readonly={Boolean(courseworkSubject)} min="1" max="8" required />
                  </div>
                  <div>
                    <label className="label">Session *</label>
                    <input className="input" value={session} onChange={e => setSession(e.target.value)} placeholder="2024-25" required />
                  </div>
                  <div>
                    <label className="label">Class Mid Term rule</label>
                    <select className="input" value={courseworkMode} onChange={e => setCourseworkMode(e.target.value)}>
                      <option value="average">Average of Mid Term 1 & 2</option>
                      <option value="best">Best of Mid Term 1 & 2</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">CSV / Excel file *</label>
                    <input className="input" type="file" accept=".csv,.xlsx,.xls" onChange={e => setCourseworkFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" className="btn-primary" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload & Publish to Students'}</button>
                </div>
              </form>
              <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                <p className="font-semibold">Columns:</p>
                <p>Class: enrollmentNo, studentName, midTerm1, midTerm2, assignmentMarks</p>
                <p>Lab: enrollmentNo, studentName, attendanceMarks, assignmentMarks, internalMarks</p>
                <p className="mt-1">Students are loaded automatically based on selected subject, semester, and session.</p>
              </div>
              {courseworkResult && (
                <div className="mt-4 text-sm text-slate-600">
                  Uploaded: {courseworkResult.success.length} · Failed: {courseworkResult.failed.length}
                </div>
              )}
            </div>
          )}

          {/* Legacy Excel Upload Tab */}
          {tab === 'excel' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <form onSubmit={handleExcelUpload} className="card space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-primary-600" />
                      Upload Marks via Excel
                    </h2>
                    <button 
                      type="button" 
                      onClick={handleDownloadTemplate} 
                      disabled={!excelSubject || !semester || !session}
                      className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" /> Download Template
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Subject *</label>
                      <select className="input" value={excelSubject} onChange={e => selectSubjectAndSemester(setExcelSubject, e.target.value)} required>
                        <option value="">Select subject</option>
                        {subjects.map(s => <option key={s._id} value={s._id}>{s.itemType === 'lab' ? 'Lab: ' : 'Class: '}{s.code} — {s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Semester (from subject) *</label>
                      <input type="number" className="input" value={semester} readOnly={Boolean(excelSubject)} aria-readonly={Boolean(excelSubject)} min="1" max="8" required />
                    </div>
                    <div>
                      <label className="label">Session *</label>
                      <input className="input" value={session} onChange={e => setSession(e.target.value)} placeholder="2024-25" required />
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 hover:border-primary-300 transition-colors">
                    <div className="flex flex-col items-center justify-center text-center">
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <label className="cursor-pointer">
                        <span className="text-primary-600 font-medium hover:underline">Click to upload</span>
                        {' '}or drag and drop
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-slate-500 mt-1">
                        {excelFile ? `📄 ${excelFile.name}` : 'Excel files (.xlsx, .xls, .csv) • Max 15 MB'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={uploading || !excelFile || !excelSubject}
                      className="flex-1 btn btn-primary disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload Marks'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="lg:col-span-1">
                {uploadResult ? (
                  <div className="card space-y-4">
                    <h2 className="font-semibold text-slate-700">Upload Results</h2>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <span className="font-medium text-emerald-900">Success</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">{uploadResult.success.length}</p>
                      <p className="text-xs text-emerald-700 mt-1">marks uploaded</p>
                    </div>
                    {uploadResult.failed?.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <span className="font-medium text-red-900">Failed</span>
                        </div>
                        <p className="text-2xl font-bold text-red-600">{uploadResult.failed.length}</p>
                      </div>
                    )}
                    <button onClick={() => setUploadResult(null)} className="btn-secondary w-full text-sm">Upload Another</button>
                  </div>
                ) : (
                  <div className="card text-center py-8">
                    <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Upload an Excel file to see results here</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legacy View Tab */}
          {tab === 'view' && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Results Summary</h3>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    className="input text-sm w-24"
                    value={semester}
                    onChange={e => setSemester(e.target.value)}
                    placeholder="Sem"
                  />
                  <input
                    className="input text-sm w-32"
                    value={session}
                    onChange={e => setSession(e.target.value)}
                    placeholder="2024-25"
                  />
                  <button onClick={loadExisting} className="btn-secondary text-xs">Refresh</button>
                </div>
              </div>
              
              {existingResults.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No results found for this semester/session</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-2 text-slate-600 font-semibold">Student</th>
                        <th className="text-center py-3 px-2 text-slate-600 font-semibold">SGPA</th>
                        <th className="text-center py-3 px-2 text-slate-600 font-semibold">Percentage</th>
                        <th className="text-center py-3 px-2 text-slate-600 font-semibold">Status</th>
                        <th className="text-left py-3 px-2 text-slate-600 font-semibold">Subjects</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingResults.map(r => (
                        <tr key={r._id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-2 text-slate-800 font-medium">
                            {r.studentId?.firstName} {r.studentId?.lastName}
                            <br /><span className="text-xs text-slate-400">{r.studentId?.enrollmentNo}</span>
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-primary-600">{r.sgpa || '-'}</td>
                          <td className="py-3 px-2 text-center font-bold text-amber-600">{r.percentage ? r.percentage.toFixed(1) + '%' : '-'}</td>
                          <td className="py-3 px-2 text-center"><span className={r.status === 'pass' ? 'badge-green' : 'badge-red'}>{r.status?.toUpperCase() || 'PENDING'}</span></td>
                          <td className="py-3 px-2 text-xs text-slate-600">
                            {(r.subjectMarks || []).length === 0 ? '—' : (r.subjectMarks || []).map(sm => {
                              const itemCode = sm.itemCode || sm.subjectId?.code || sm.labId?.code || '?';
                              const review = sm.submissionStatus === 'approved'
                                ? 'Approved'
                                : sm.submissionStatus === 'rejected'
                                  ? `Rejected${sm.rejectionReason ? `: ${sm.rejectionReason}` : ''}`
                                  : 'Pending admin review';
                              return `${itemCode}: ${sm.totalMarks ?? '–'} (${review})`;
                            }).join(' • ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
