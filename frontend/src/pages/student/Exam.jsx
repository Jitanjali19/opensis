import React, { useEffect, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../../api/axios';
import { Calendar, BarChart3, RotateCcw, Send, Download, Printer, Eye, EyeOff, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import collegeLogo from '../gslogo.png';
import AdmitCard from '../../components/AdmitCard';
import { useAuth } from '../../context/AuthContext';
import { getDepartmentLabel } from '../../constants/departments';
import { resolveAssetUrl, resolveAssetDownloadUrl } from '../../utils/assetUrl';

const CollegeLogo = () => (
  <img
    src={collegeLogo}
    alt="Shri G. S. Institute of Technology & Science, Indore logo"
    className="h-20 w-20 shrink-0 object-contain print:h-24 print:w-24"
  />
);

const EXAM_TYPE_LABELS = {
  'end-sem': 'End Semester',
  'mid-sem-1': 'Mid Semester 1',
  'mid-sem-2': 'Mid Semester 2',
};

export default function StudentExam() {
  const { selectedSession, selectedTerm } = useAuth();
  const [tab, setTab] = useState('timetable');
  const [timetables, setTimetables] = useState([]);
  const [results, setResults] = useState([]);
  const [internalMarks, setInternalMarks] = useState([]);
  const [revaluationRequests, setRevaluationRequests] = useState([]);
  const [loadingRevaluations, setLoadingRevaluations] = useState(false);
  const [revalForm, setRevalForm] = useState({ subjectId: '', semester: '', session: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resultSemester, setResultSemester] = useState('');
  const [loadingResults, setLoadingResults] = useState(false);
  const [visibleGradesheets, setVisibleGradesheets] = useState({});
  const [admitCard, setAdmitCard] = useState(null);
  const [admitError, setAdmitError] = useState('');
  const [loadingAdmit, setLoadingAdmit] = useState(false);
  const gradesheetRefs = useRef({});
  const admitRef = useRef(null);

  const handlePrintAdmit = useReactToPrint({ content: () => admitRef.current });
  const handlePrintGradesheet = useReactToPrint({
    content: () => gradesheetRefs.current.active,
  });

  const loadAdmitCard = async () => {
    setLoadingAdmit(true);
    setAdmitError('');
    try {
      const { data } = await api.get('/student/admit-card');
      setAdmitCard(data.data.admitCard);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load admit card';
      setAdmitError(message);
      toast.error(message);
    } finally {
      setLoadingAdmit(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setAdmitCard(null);
    Promise.all([
      api.get('/student/exam-timetable').then(r => setTimetables(r.data.data.timetables || [])),
      api.get('/student/result').then(r => setResults(r.data.data.results)),
      api.get('/student/internal-marks').then(r => setInternalMarks(r.data.data.results || [])),
    ]).finally(() => setLoading(false));
  }, [selectedSession, selectedTerm]);

  const loadResults = async (semesterValue = resultSemester) => {
    setLoadingResults(true);
    try {
      const semester = String(semesterValue || '').trim();
      const endpoint = semester ? `/student/result?semester=${encodeURIComponent(semester)}` : '/student/result';
      const { data } = await api.get(endpoint);
      setResults(data.data.results || []);
      const internal = await api.get(semester
        ? `/student/internal-marks?semester=${encodeURIComponent(semester)}`
        : '/student/internal-marks');
      setInternalMarks(internal.data.data.results || []);
    } catch {
      toast.error('Failed to load results');
    }
    setLoadingResults(false);
  };

  const loadRevaluationRequests = async () => {
    setLoadingRevaluations(true);
    try {
      const { data } = await api.get('/student/revaluation');
      setRevaluationRequests(data.data.requests || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load revaluation requests');
    } finally {
      setLoadingRevaluations(false);
    }
  };

  const handleRevaluation = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/student/revaluation', revalForm);
      toast.success('Revaluation request submitted');
      setRevalForm({ subjectId: '', semester: '', session: '', reason: '' });
      loadRevaluationRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit revaluation request');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { key: 'timetable', label: 'Timetable', icon: Calendar },
    { key: 'admitcard', label: 'Admit Card', icon: Download },
    { key: 'results', label: 'Results', icon: BarChart3 },
    { key: 'revaluation', label: 'Revaluation', icon: RotateCcw },
  ];

  const statusStyles = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  useEffect(() => {
    if (tab === 'revaluation') loadRevaluationRequests();
  }, [tab]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Exams & Results</h1>
        <p className="text-slate-500 text-sm mt-1">Exam timetable, admit card and results</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Timetable Tab */}
      {tab === 'timetable' && (
        timetables.length === 0 ? (
          <div className="card text-center py-12">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No exam timetable has been uploaded for your session and term yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {timetables.map(item => (
              <div key={item._id} className="card flex flex-wrap items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-800">{item.title || 'Exam Time Table'}</h3>
                    <span className="text-xs rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      {EXAM_TYPE_LABELS[item.examType] || item.examType || 'End Semester'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">{item.originalName}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Session {item.session} · {item.term === 'july-december' ? 'July-December' : 'January-June'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a href={resolveAssetUrl(item.fileUrl)} target="_blank" rel="noreferrer" className="btn-secondary">
                    <Eye className="w-4 h-4" /> View
                  </a>
                  <a href={resolveAssetDownloadUrl(item.fileUrl)} className="btn-primary">
                    <Download className="w-4 h-4" /> Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Admit Card Tab */}
      {tab === 'admitcard' && (
        <div>
          {!admitCard ? (
            <div className="card text-center py-12">
              <Download className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-2">End Semester Admit Card</p>
              <p className="text-xs text-slate-400 mb-4">
                Admit cards are issued by the examination office. If your admit card is not available, please contact them.
              </p>
              {admitError && <p className="text-sm text-rose-600 mb-4">{admitError}</p>}
              <button onClick={loadAdmitCard} disabled={loadingAdmit} className="btn-primary mx-auto">
                <Download className="w-4 h-4" /> {loadingAdmit ? 'Loading...' : 'View Admit Card'}
              </button>
            </div>
          ) : (
            <div>
              <div className="flex justify-end gap-2 mb-4 print:hidden">
                <button onClick={() => setAdmitCard(null)} className="btn-secondary">Back</button>
                <button onClick={handlePrintAdmit} className="btn-primary">
                  <Printer className="w-4 h-4" /> Print / Download PDF
                </button>
              </div>
              <div ref={admitRef}>
                <AdmitCard card={admitCard} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Tab */}
      {tab === 'results' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="w-full sm:w-52">
                <label className="label">Semester</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  className="input"
                  placeholder="Enter semester"
                  value={resultSemester}
                  onChange={e => setResultSemester(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={loadingResults}
                  onClick={() => loadResults()}
                >
                  {loadingResults ? 'Loading...' : 'Load Result'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={loadingResults}
                  onClick={() => {
                    setResultSemester('');
                    loadResults('');
                  }}
                >
                  Current Sem
                </button>
              </div>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="card text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No results found for the selected semester</p>
            </div>
          ) : (
            <div className="space-y-6">
              {results.map(r => (
                <div key={r._id} className="card relative print:shadow-none print:border-none print:p-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
                    <div>
                      <h2 className="font-semibold text-slate-800">Semester {r.semester} Gradesheet</h2>
                      <p className="text-sm text-slate-500">Session: {r.session || '—'} · Status: {r.status || '—'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setVisibleGradesheets(current => ({ ...current, [r._id]: !current[r._id] }))}
                        className="btn-secondary text-xs flex items-center gap-1"
                      >
                        {visibleGradesheets[r._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {visibleGradesheets[r._id] ? 'Hide Gradesheet' : 'View Gradesheet'}
                      </button>
                      {visibleGradesheets[r._id] && (
                        <button
                          type="button"
                          onClick={() => {
                            gradesheetRefs.current.active = gradesheetRefs.current[r._id];
                            handlePrintGradesheet();
                          }}
                          className="btn-primary text-xs flex items-center gap-1"
                        >
                          <Download className="w-4 h-4" /> Download / Print
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {visibleGradesheets[r._id] && (
                    <div
                      ref={el => {
                        if (el) {
                          gradesheetRefs.current[r._id] = el;
                        }
                      }}
                      className="p-8 border-2 border-slate-200 rounded-lg bg-white print:border-none print:m-0 print:p-0 print:block w-full overflow-x-auto"
                    >
                    <div className="text-center border-b-2 border-slate-800 pb-6 mb-8">
                      <div className="flex flex-col items-center gap-4 print:gap-3">
                        <CollegeLogo />
                        <div>
                          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 uppercase tracking-wide leading-tight">
                            Shri G. S. Institute of Technology & Science, Indore
                          </h2>
                          <p className="mt-2 text-lg font-semibold text-slate-600 uppercase tracking-[0.2em]">Statement of Marks</p>
                          <p className="text-sm text-slate-500 font-medium mt-2">Session: {r.session} | Semester: {r.semester}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-12 mb-10 text-sm">
                      <div className="flex border-b border-dashed border-slate-300 pb-2"><span className="w-32 font-semibold text-slate-600">Student Name:</span> <span className="font-bold text-slate-800 uppercase">{r.studentId?.firstName} {r.studentId?.lastName}</span></div>
                      <div className="flex border-b border-dashed border-slate-300 pb-2"><span className="w-32 font-semibold text-slate-600">Enrollment No:</span> <span className="font-bold text-slate-800 uppercase">{r.studentId?.enrollmentNo}</span></div>
                      <div className="flex border-b border-dashed border-slate-300 pb-2"><span className="w-32 font-semibold text-slate-600">Department:</span> <span className="font-bold text-slate-800">{getDepartmentLabel(r.studentId?.branch || r.branch)}</span></div>
                      <div className="flex border-b border-dashed border-slate-300 pb-2"><span className="w-32 font-semibold text-slate-600">Status:</span> <span className={`font-bold uppercase tracking-wider ${r.status === 'pass' ? 'text-green-600' : 'text-red-600'}`}>{r.status}</span></div>
                    </div>

                    <table className="w-full text-sm mb-8 border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-white print:bg-slate-200 print:text-black">
                          <th className="py-3 px-4 text-left border border-slate-800 print:border-slate-400 font-semibold">Subject Code</th>
                          <th className="py-3 px-4 text-left border border-slate-800 print:border-slate-400 font-semibold">Subject Name</th>
                          <th className="py-3 px-4 text-center border border-slate-800 print:border-slate-400 font-semibold w-20">Credits</th>
                          <th className="py-3 px-4 text-center border border-slate-800 print:border-slate-400 font-semibold">Marks Obtained</th>
                          <th className="py-3 px-4 text-center border border-slate-800 print:border-slate-400 font-semibold w-20">Grade</th>
                          <th className="py-3 px-4 text-center border border-slate-800 print:border-slate-400 font-semibold w-20">GP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(r.subjectMarks || []).map((sm, i) => (
                          <tr key={i}>
                            <td className="py-3 px-4 border border-slate-300 font-mono text-xs">
                              {sm.itemCode || sm.subjectId?.code || sm.labId?.code || '—'}
                            </td>
                            <td className="py-3 px-4 border border-slate-300 font-medium text-slate-700">
                              {sm.itemName || sm.subjectId?.name || sm.labId?.name || '—'}
                            </td>
                            <td className="py-3 px-4 border border-slate-300 text-center font-medium text-slate-600">
                              {sm.credits || sm.subjectId?.credits || sm.labId?.credits || '—'}
                            </td>
                            <td className="py-3 px-4 border border-slate-300 text-center font-bold text-slate-800">{sm.totalMarks ?? '—'}</td>
                            <td className="py-3 px-4 border border-slate-300 text-center font-bold text-slate-800">{sm.grade || '—'}</td>
                            <td className="py-3 px-4 border border-slate-300 text-center font-medium text-slate-600">{sm.gradePoints ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center print:border-slate-400 print:bg-transparent">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Earned / Total Credits</p>
                        <p className="text-2xl font-bold text-slate-800">{r.earnedCredits || 0} / {r.totalCredits || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">SGPA</p>
                        <p className="text-2xl font-bold text-primary-600">{r.sgpa ? r.sgpa.toFixed(2) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">CGPA</p>
                        <p className="text-2xl font-bold text-indigo-600">{r.cgpa ? r.cgpa.toFixed(2) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Percentage</p>
                        <p className="text-2xl font-bold text-slate-800">{r.percentage ? `${r.percentage.toFixed(1)}%` : '—'}</p>
                      </div>
                    </div>

                    <div className="mt-12 flex justify-between items-end text-sm text-slate-600 font-medium print:mt-20">
                      <div className="space-y-1">
                        <p>Remarks: <span className="font-bold text-slate-800 uppercase tracking-wider">{r.remarks || (r.status === 'pass' ? 'Promoted' : 'Reappear')}</span></p>
                        <p>Date of Issue: {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                      </div>
                      <div className="text-center">
                        <div className="w-48 border-b-2 border-slate-400 mb-2"></div>
                        <p className="font-semibold uppercase tracking-wider text-xs">Controller of Examinations</p>
                      </div>
                    </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {internalMarks.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-bold text-slate-800">Internal Assessment Marks</h2>
              <p className="text-sm text-slate-500 mt-1 mb-4">Published Mid Term, assignment, attendance and lab internal marks</p>
              {internalMarks.map(r => (
                <div key={r._id} className="mb-5 last:mb-0">
                  <h3 className="font-semibold text-slate-700 mb-2">Semester {r.semester} · {r.session || 'Session N/A'}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-2">Subject / Lab</th>
                          <th className="text-center px-3 py-2">CW / SW</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(r.subjectMarks || []).map((sm, i) => {
                          const lab = sm.itemType === 'lab' || sm.labId;
                          return (
                            <tr key={`${r._id}-${i}`} className="border-b border-slate-100">
                              <td className="px-3 py-2">{sm.itemName || sm.subjectId?.name || sm.labId?.name || '—'} <span className="text-xs text-slate-400">({sm.itemCode || sm.subjectId?.code || sm.labId?.code || 'NA'})</span></td>
                              <td className="text-center px-3 py-2 font-semibold">{lab ? `${sm.sw ?? sm.internalMarks ?? '—'} / 40` : `${sm.cw ?? '—'} / 30`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Revaluation Tab */}
      {tab === 'revaluation' && (
        <div className="space-y-6">
          <div className="card max-w-xl">
          <h3 className="font-semibold text-slate-800 mb-4">Request Revaluation</h3>
          <form onSubmit={handleRevaluation} className="space-y-4">
            <div>
              <label className="label">Subject Code</label>
              <input
                className="input"
                required
                value={revalForm.subjectId}
                onChange={e => setRevalForm({ ...revalForm, subjectId: e.target.value.toUpperCase() })}
                placeholder="e.g. IT701"
              />
            </div>
            <div>
              <label className="label">Semester</label>
              <input
                type="number"
                className="input"
                required
                value={revalForm.semester}
                onChange={e => setRevalForm({ ...revalForm, semester: e.target.value })}
                placeholder="e.g. 7"
                min="1"
                max="8"
              />
            </div>
            <div>
              <label className="label">Session</label>
              <input
                className="input"
                required
                value={revalForm.session}
                onChange={e => setRevalForm({ ...revalForm, session: e.target.value })}
                placeholder="e.g. 2026-27"
              />
            </div>
            <div>
              <label className="label">Reason</label>
              <textarea
                className="input min-h-[100px]"
                required
                value={revalForm.reason}
                onChange={e => setRevalForm({ ...revalForm, reason: e.target.value })}
                placeholder="Explain your reason for revaluation..."
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">My Revaluation Requests</h3>
              <button type="button" onClick={loadRevaluationRequests} className="btn-secondary text-xs" disabled={loadingRevaluations}>
                {loadingRevaluations ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            {loadingRevaluations ? (
              <p className="text-sm text-slate-500">Loading requests...</p>
            ) : revaluationRequests.length === 0 ? (
              <p className="text-sm text-slate-500">No revaluation requests submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {revaluationRequests.map(request => (
                  <div key={request._id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {request.subjectId?.code || 'Subject'}{request.subjectId?.name ? ` — ${request.subjectId.name}` : ''}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Semester {request.semester} · Session {request.session || 'N/A'}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusStyles[request.status] || 'bg-slate-100 text-slate-600'}`}>
                        {request.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-3">{request.reason}</p>
                    {request.status === 'approved' && request.totalMarks !== undefined && (
                      <div className="mt-3 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                        <span className="font-semibold">Revaluation complete:</span> New marks {request.totalMarks}
                        {request.internalMarks !== undefined && request.externalMarks !== undefined && (
                          <span className="text-green-700"> (Internal {request.internalMarks} + External {request.externalMarks})</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-3">
                      Requested {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString('en-IN') : '—'}
                      {request.reviewedAt ? ` · Reviewed ${new Date(request.reviewedAt).toLocaleDateString('en-IN')}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
