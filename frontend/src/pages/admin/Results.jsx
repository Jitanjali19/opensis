import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { 
  BarChart3, Calculator, Award, AlertCircle, FileSpreadsheet, 
  CheckCircle, Download, CheckCircle2, Circle, Search, Eye,
  CheckCheck, MessageSquare, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import AdminSubjectReviewModal from './AdminSubjectReviewModal';

export default function AdminResults() {
  const [tab, setTab] = useState('status');
  
  // Shared Filters
  const [semester, setSemester] = useState('5');
  const [session, setSession] = useState(`${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
  const [branch, setBranch] = useState('');
  
  // Data States
  const [statusData, setStatusData] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [revaluations, setRevaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedReval, setSelectedReval] = useState(null);
  const [revalMarks, setRevalMarks] = useState({ internal: '', external: '' });
  const [updating, setUpdating] = useState(false);
  const [reviewingItem, setReviewingItem] = useState(null);

  // Phase 4: Admin Review States
  const [selectedReviewSubject, setSelectedReviewSubject] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [statusSearch, setStatusSearch] = useState('');
  const [bulkApproving, setBulkApproving] = useState(false);

  // Tab 1: Load Submission Status
  const loadStatus = async () => {
    if (!semester || !session) return toast.error('Enter semester and session');
    setLoading(true);
    try {
      const q = `?semester=${semester}&session=${session}${branch ? `&branch=${branch}` : ''}`;
      const { data } = await api.get(`/admin/results/submission-status${q}`);
      setStatusData(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load status');
    }
    setLoading(false);
  };

  const reviewSubmission = async (item, status) => {
    const rejectionReason = status === 'rejected'
      ? window.prompt('Why are these marks being rejected? This message will be shown to the faculty.')
      : '';
    if (status === 'rejected' && rejectionReason === null) return;
    if (status === 'approved' && !window.confirm(`Approve marks for ${item.code}? Students will be included in gradesheet generation.`)) return;
    setReviewingItem(item._id);
    try {
      const { data } = await api.patch('/admin/results/submission-status/review', {
        itemId: item._id,
        itemType: item.itemType,
        semester: Number(semester),
        session,
        status,
        rejectionReason,
      });
      toast.success(data.message);
      loadStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update marks review status');
    } finally {
      setReviewingItem(null);
    }
  };

  // Phase 4: Bulk Approve all pending submissions
  const handleBulkApprove = async () => {
    const pendingSubjects = (statusData?.subjects || []).filter(
      (s) => (s.statusCounts?.pending || 0) > 0
    );
    if (pendingSubjects.length === 0) return toast.error('No subjects currently pending review');
    if (!window.confirm(`Bulk approve marks for all ${pendingSubjects.length} pending subject(s)?`)) return;

    setBulkApproving(true);
    try {
      await Promise.all(
        pendingSubjects.map((s) =>
          api.patch('/admin/results/submission-status/review', {
            itemId: s._id,
            itemType: s.itemType,
            semester: Number(semester),
            session,
            status: 'approved',
          })
        )
      );
      toast.success(`Successfully approved ${pendingSubjects.length} subject(s)!`);
      loadStatus();
    } catch (err) {
      toast.error('Some subjects could not be approved');
      loadStatus();
    } finally {
      setBulkApproving(false);
    }
  };

  // Tab 2/3: Generate & Load Results
  const generateGradesheet = async () => {
    if (!semester || !session) return toast.error('Enter semester and session');
    setGenerating(true);
    try {
      const { data } = await api.post('/admin/results/generate-gradesheet', {
        semester: Number(semester),
        session,
        branch
      });
      toast.success(`Generated gradesheet for ${data.data.totalProcessed} students`);
      loadResults(); // reload the newly generated results
      setTab('view');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate');
    }
    setGenerating(false);
  };

  const loadResults = async () => {
    if (!semester || !session) return;
    setLoading(true);
    try {
      const q = `?semester=${semester}&session=${session}${branch ? `&branch=${branch}` : ''}`;
      const { data } = await api.get(`/admin/results${q}`);
      setResultsData(data.data.results || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load results');
    }
    setLoading(false);
  };

  // Tab 4: Publish
  const handlePublishToggle = async (publish) => {
    if (!semester || !session) return toast.error('Enter semester and session');
    if (publish && !window.confirm('Are you sure you want to publish these results? They will become visible to students immediately.')) return;
    
    setLoading(true);
    try {
      const { data } = await api.patch('/admin/results/publish', {
        semester: Number(semester),
        session,
        branch,
        publish
      });
      toast.success(data.message);
      loadResults();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update publish status');
    }
    setLoading(false);
  };

  // Tab 5: Load Analytics
  const loadAnalytics = async () => {
    if (!semester || !session) return toast.error('Enter semester and session');
    setLoading(true);
    try {
      const q = `?semester=${semester}&session=${session}${branch ? `&branch=${branch}` : ''}`;
      const { data } = await api.get(`/admin/results/analytics${q}`);
      setAnalyticsData(data.data.analytics);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load analytics');
    }
    setLoading(false);
  };

  // Export
  const handleExport = () => {
    if (!semester || !session) return toast.error('Enter semester and session');
    const q = `?semester=${semester}&session=${session}${branch ? `&branch=${branch}` : ''}`;
    window.location.href = `${api.defaults.baseURL}/admin/results/export${q}`;
  };

  const loadRevaluations = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/revaluation-requests');
      setRevaluations(data.data.requests);
    } catch (err) {
      toast.error('Failed to load revaluation requests');
    }
    setLoading(false);
  };

  const handleUpdateReval = async (id, status, marks = null) => {
    setUpdating(true);
    try {
      await api.patch(`/admin/revaluation-requests/${id}`, {
        status,
        internalMarks: marks?.internal,
        externalMarks: marks?.external
      });
      toast.success(`Request ${status} successfully`);
      setSelectedReval(null);
      loadRevaluations();
    } catch (err) {
      toast.error('Failed to update request');
    }
    setUpdating(false);
  };

  // Effect to load data when tab changes
  useEffect(() => {
    if (tab === 'status') loadStatus();
    if (tab === 'view' || tab === 'publish') loadResults();
    if (tab === 'analytics') loadAnalytics();
    if (tab === 'revaluation') loadRevaluations();
  }, [tab, semester, session, branch]);

  // UI Helpers
  const renderFilters = (actionFn, actionText, actionIcon, isPrimary = true, loadingState = loading) => (
    <div className="card mb-6">
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="w-full sm:w-1/4">
          <label className="label">Semester</label>
          <input type="number" className="input" value={semester} onChange={e => setSemester(e.target.value)} min="1" max="8" />
        </div>
        <div className="w-full sm:w-1/4">
          <label className="label">Session</label>
          <input className="input" value={session} onChange={e => setSession(e.target.value)} placeholder="e.g. 2026-2027" />
        </div>
        <div className="w-full sm:w-1/4">
          <label className="label">Branch (Optional)</label>
          <select className="input" value={branch} onChange={e => setBranch(e.target.value)}>
            <option value="">All Branches</option>
            <option value="IT">IT</option>
            <option value="CSE">CSE</option>
            <option value="ECE">ECE</option>
            <option value="ME">ME</option>
            <option value="CE">CE</option>
          </select>
        </div>
        <div className="w-full sm:w-1/4 flex gap-2">
          {actionFn && (
            <button onClick={actionFn} disabled={loadingState} className={`w-full flex items-center justify-center gap-2 ${isPrimary ? 'btn-primary' : 'btn-secondary'}`}>
              {actionIcon} {loadingState ? 'Processing...' : actionText}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'status', label: 'Submission Status' },
    { id: 'generate', label: 'Generate Gradesheet' },
    { id: 'view', label: 'View Gradesheet', icon: Award },
    { id: 'publish', label: 'Publish Control', icon: AlertCircle },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'revaluation', label: 'Revaluation', icon: FileSpreadsheet },
  ];

  return (
    <div>
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Result Management</h1>
          <p className="text-slate-500 text-sm mt-1">Manage, generate, and publish student results</p>
        </div>
        {(tab === 'view' || tab === 'analytics') && (
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export to Excel
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PENDING REVIEWS & SUBMISSION STATUS */}
      {tab === 'status' && (
        <>
          {renderFilters(loadStatus, 'Check Status', <Search className="w-4 h-4" />)}
          
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : statusData ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              {(() => {
                const totalSubjects = statusData.subjects?.length || 0;
                const pendingCount = (statusData.subjects || []).filter(s => (s.statusCounts?.pending || 0) > 0).length;
                const approvedCount = (statusData.subjects || []).filter(s => s.isComplete).length;
                const rejectedCount = (statusData.subjects || []).filter(s => (s.statusCounts?.rejected || 0) > 0).length;

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card bg-white p-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Classes & Labs</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">{statusData.totalSubjects}</p>
                    </div>
                    <div className="card bg-white p-4">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending Reviews</p>
                      <p className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</p>
                    </div>
                    <div className="card bg-white p-4">
                      <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Approved / Complete</p>
                      <p className="text-2xl font-bold text-emerald-700 mt-1">{statusData.completedSubjects} / {statusData.totalSubjects}</p>
                    </div>
                    <div className="card bg-white p-4">
                      <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Students Expected</p>
                      <p className="text-2xl font-bold text-purple-700 mt-1">{statusData.totalStudents}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Status Banner */}
              {statusData.totalSubjects > 0 && (
                <div className={`p-4 rounded-xl border ${statusData.allComplete ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'} flex items-center justify-between gap-3 flex-wrap`}>
                  <div className="flex items-center gap-3">
                    {statusData.allComplete ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : <AlertCircle className="w-6 h-6 text-amber-600" />}
                    <div>
                      <p className="font-semibold">{statusData.allComplete ? 'All marks approved!' : 'Pending marks review!'}</p>
                      <p className="text-xs opacity-90">
                        {statusData.allComplete 
                          ? 'All faculty submissions have been verified and approved. You can generate gradesheets.' 
                          : 'Review faculty submissions and approve marks before generating the final semester gradesheet.'}
                      </p>
                    </div>
                  </div>

                  {statusData.allComplete && (
                    <button
                      onClick={() => setTab('generate')}
                      className="btn-primary text-xs px-4 py-2"
                    >
                      Proceed to Generate Gradesheet →
                    </button>
                  )}
                </div>
              )}

              {/* Toolbar: Filter Pills, Search & Bulk Approve */}
              {(() => {
                const pendingItems = (statusData.subjects || []).filter(s => (s.statusCounts?.pending || 0) > 0);
                const approvedItems = (statusData.subjects || []).filter(s => s.isComplete);
                const rejectedItems = (statusData.subjects || []).filter(s => (s.statusCounts?.rejected || 0) > 0);

                const filteredList = (statusData.subjects || []).filter(s => {
                  const matchSearch = 
                    s.code.toLowerCase().includes(statusSearch.toLowerCase()) ||
                    s.name.toLowerCase().includes(statusSearch.toLowerCase()) ||
                    (s.faculty && s.faculty.toLowerCase().includes(statusSearch.toLowerCase()));
                  
                  if (!matchSearch) return false;
                  if (statusFilter === 'pending') return (s.statusCounts?.pending || 0) > 0;
                  if (statusFilter === 'approved') return s.isComplete;
                  if (statusFilter === 'rejected') return (s.statusCounts?.rejected || 0) > 0;
                  return true;
                });

                return (
                  <div className="card space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Search */}
                      <div className="relative w-full sm:w-80">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          className="input !pl-9 !py-2 text-xs w-full bg-slate-50/50"
                          placeholder="Search subject code, name, or faculty..."
                          value={statusSearch}
                          onChange={(e) => setStatusSearch(e.target.value)}
                        />
                      </div>

                      {/* Filter Pills */}
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setStatusFilter('all')}
                          className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
                        >
                          All ({statusData.subjects.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('pending')}
                          className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'hover:text-slate-900'}`}
                        >
                          Pending Review ({pendingItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('approved')}
                          className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'approved' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
                        >
                          Approved ({approvedItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('rejected')}
                          className={`px-3 py-1.5 rounded-lg transition-colors ${statusFilter === 'rejected' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
                        >
                          Action Required ({rejectedItems.length})
                        </button>
                      </div>

                      {/* Bulk Approve Action */}
                      {pendingItems.length > 0 && (
                        <button
                          type="button"
                          onClick={handleBulkApprove}
                          disabled={bulkApproving}
                          className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
                          title="Bulk approve all pending subject marks"
                        >
                          <CheckCheck className="w-4 h-4" />
                          <span>{bulkApproving ? 'Approving...' : `Bulk Approve (${pendingItems.length} Pending)`}</span>
                        </button>
                      )}
                    </div>

                    {/* Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                            <th className="py-3 px-3">Subject / Lab</th>
                            <th className="py-3 px-3">Assigned Faculty</th>
                            <th className="py-3 px-3">Student Marks Progress</th>
                            <th className="py-3 px-3">Review Status</th>
                            <th className="py-3 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredList.map(s => {
                            const isLab = s.itemType === 'lab';
                            const hasPending = (s.statusCounts?.pending || 0) > 0;
                            const hasRejected = (s.statusCounts?.rejected || 0) > 0;

                            return (
                              <tr 
                                key={s._id} 
                                className={`hover:bg-slate-50/80 transition-colors ${hasPending ? 'bg-amber-50/20' : ''}`}
                              >
                                <td className="py-3.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800">{s.code}</span>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${isLab ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {isLab ? 'Lab' : 'Class'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">{s.name}</p>
                                </td>

                                <td className="py-3.5 px-3">
                                  <span className="font-medium text-slate-700">{s.faculty}</span>
                                </td>

                                <td className="py-3.5 px-3">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="font-bold text-slate-800">{s.studentsWithMarks}</span>
                                    <span className="text-slate-400">/ {s.totalStudents} students</span>
                                  </div>
                                  {s.totalStudents > 0 && (
                                    <div className="w-36 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all ${s.isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                        style={{ width: `${Math.min(100, (s.studentsWithMarks / s.totalStudents) * 100)}%` }}
                                      />
                                    </div>
                                  )}
                                </td>

                                <td className="py-3.5 px-3">
                                  {s.isComplete ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                                    </span>
                                  ) : hasPending ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 animate-pulse">
                                      <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Review ({s.statusCounts?.pending})
                                    </span>
                                  ) : hasRejected ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                                      <AlertCircle className="w-3.5 h-3.5" /> Returned ({s.statusCounts?.rejected})
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">Not Started</span>
                                  )}
                                </td>

                                <td className="py-3.5 px-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedReviewSubject(s)}
                                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 hover:border-primary-300 hover:text-primary-700"
                                      title="Open student marks list to inspect and review"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Review Marks</span>
                                    </button>

                                    {s.studentsWithMarks > 0 && (s.statusCounts?.pending > 0 || s.statusCounts?.rejected > 0) && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => reviewSubmission(s, 'approved')}
                                          disabled={reviewingItem === s._id}
                                          className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 font-medium border border-emerald-200 transition-colors"
                                          title="Quick approve marks for this subject"
                                        >
                                          Accept
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => reviewSubmission(s, 'rejected')}
                                          disabled={reviewingItem === s._id}
                                          className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 font-medium border border-rose-200 transition-colors"
                                          title="Reject marks and return to faculty with reason"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                          {filteredList.length === 0 && (
                            <tr>
                              <td colSpan="5" className="text-center py-10 text-slate-500">
                                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="font-medium text-slate-600">No subjects found matching your filter</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 card">Select filters and click "Check Status" to begin.</div>
          )}

          {/* Admin Subject Review Modal */}
          <AdminSubjectReviewModal
            isOpen={Boolean(selectedReviewSubject)}
            onClose={() => setSelectedReviewSubject(null)}
            subject={selectedReviewSubject}
            semester={semester}
            session={session}
            branch={branch}
            onReviewComplete={loadStatus}
          />
        </>
      )}

      {/* TAB 2: GENERATE GRADESHEET */}
      {tab === 'generate' && (
        <div className="max-w-2xl mx-auto">
          <div className="card mb-6 text-center py-8">
            <Calculator className="w-16 h-16 text-primary-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800">Generate Gradesheet</h2>
            <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm">
              This process will calculate Total Marks, Grades, Grade Points, SGPA, CGPA, Percentage, and Rank for all students in the selected semester.
            </p>
          </div>

          {renderFilters(generateGradesheet, 'Generate Now', <Calculator className="w-4 h-4" />, true, generating)}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
            <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5" /> What happens during generation?
            </h4>
            <ul className="space-y-2 text-sm text-blue-800 list-disc list-inside">
              <li><strong>Grades:</strong> Calculated on a 10-point scale (A, B, C, D, E, F)</li>
              <li><strong>SGPA:</strong> Credit-weighted average of grade points</li>
              <li><strong>CGPA:</strong> Cumulative average including all previous published semesters</li>
              <li><strong>Rank:</strong> Automatically assigned based on SGPA within the branch/class</li>
              <li><strong>Status:</strong> PASS (all subjects ≥ 40) or FAIL (any subject &lt; 40)</li>
            </ul>
            <p className="text-xs text-blue-600 mt-4 italic">Note: You can run this multiple times. It will overwrite the previous calculations for the same semester/session.</p>
          </div>
        </div>
      )}

      {/* TAB 3: VIEW GRADESHEET */}
      {tab === 'view' && (
        <>
          {renderFilters(loadResults, 'Load Results', <Search className="w-4 h-4" />)}
          
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : resultsData && resultsData.length > 0 ? (
            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="py-3 px-3 font-semibold">Rank</th>
                      <th className="py-3 px-3 font-semibold">Enrollment No</th>
                      <th className="py-3 px-3 font-semibold">Student Name</th>
                      <th className="py-3 px-3 font-semibold text-center">Earned Credits</th>
                      <th className="py-3 px-3 font-semibold text-center">SGPA</th>
                      <th className="py-3 px-3 font-semibold text-center">CGPA</th>
                      <th className="py-3 px-3 font-semibold text-center">Percentage</th>
                      <th className="py-3 px-3 font-semibold text-center">Status</th>
                      <th className="py-3 px-3 font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultsData.map((r, i) => (
                      <tr key={r._id} className={`border-b border-slate-100 hover:bg-slate-50 ${r.rank <= 3 ? 'bg-amber-50/30' : ''}`}>
                        <td className="py-3 px-3 font-bold text-slate-700">
                          {r.rank === 1 ? '🥇 1' : r.rank === 2 ? '🥈 2' : r.rank === 3 ? '🥉 3' : r.rank || '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-xs">{r.studentId?.enrollmentNo}</td>
                        <td className="py-3 px-3 font-medium text-slate-800">{r.studentId?.firstName} {r.studentId?.lastName}</td>
                        <td className="py-3 px-3 text-center text-slate-600">{r.earnedCredits || 0}/{r.totalCredits || 0}</td>
                        <td className="py-3 px-3 text-center font-bold text-primary-600">{r.sgpa ? r.sgpa.toFixed(2) : '—'}</td>
                        <td className="py-3 px-3 text-center font-bold text-indigo-600">{r.cgpa ? r.cgpa.toFixed(2) : '—'}</td>
                        <td className="py-3 px-3 text-center text-slate-600">{r.percentage ? `${r.percentage.toFixed(1)}%` : '—'}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold text-white ${
                            r.status === 'pass' ? 'bg-green-500' : 'bg-red-500'
                          }`}>
                            {(r.status || 'pending').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500">{r.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
             <div className="card text-center py-12">
              <Eye className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No gradesheet generated for this criteria.</p>
              <button onClick={() => setTab('generate')} className="btn-primary mt-4 text-sm">Go to Generate Tab</button>
            </div>
          )}
        </>
      )}

      {/* TAB 4: PUBLISH CONTROL */}
      {tab === 'publish' && (
        <div className="max-w-3xl mx-auto">
          {renderFilters(loadResults, 'Find Results', <Search className="w-4 h-4" />)}

          {loading ? (
             <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : resultsData && resultsData.length > 0 ? (
            <div className="card text-center py-8">
              {/* Calculate publish stats */}
              {(() => {
                const publishedCount = resultsData.filter(r => r.isPublished).length;
                const totalCount = resultsData.length;
                const isFullyPublished = publishedCount === totalCount;
                
                return (
                  <>
                    <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${isFullyPublished ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Award className="w-10 h-10" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                      {isFullyPublished ? 'Results are Published' : 'Results are Unpublished'}
                    </h2>
                    
                    <p className="text-slate-500 mb-8">
                      Found <strong>{totalCount}</strong> results for Semester {semester} ({session}).<br/>
                      Currently, <strong>{publishedCount}</strong> results are visible to students.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                      <button 
                        onClick={() => handlePublishToggle(true)}
                        disabled={isFullyPublished}
                        className="btn-primary py-3 px-8 text-lg disabled:opacity-50"
                      >
                        Publish Results
                      </button>
                      <button 
                        onClick={() => handlePublishToggle(false)}
                        disabled={publishedCount === 0}
                        className="btn-secondary py-3 px-8 text-lg disabled:opacity-50"
                      >
                        Unpublish Results
                      </button>
                    </div>

                    {!isFullyPublished && (
                      <div className="mt-8 p-4 bg-amber-50 text-amber-800 text-sm rounded-lg text-left inline-block max-w-lg">
                        <strong>⚠️ Note:</strong> Publishing will make the gradesheet visible on the student portal. Ensure all marks are correct and verified before publishing.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="card text-center py-12 text-slate-500">
              No results found. Please generate the gradesheet first.
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ANALYTICS */}
      {tab === 'analytics' && (
        <>
          {renderFilters(loadAnalytics, 'View Analytics', <BarChart3 className="w-4 h-4" />)}

          {loading ? (
             <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : analyticsData ? (
            <div className="space-y-6">
              {/* Top Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <p className="text-blue-600 text-xs font-medium">Total Students</p>
                  <p className="text-3xl font-bold text-blue-700 mt-1">{analyticsData.totalStudents}</p>
                </div>
                <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <p className="text-green-600 text-xs font-medium">Pass Percentage</p>
                  <p className="text-3xl font-bold text-green-700 mt-1">{analyticsData.passPercentage}%</p>
                  <p className="text-xs text-green-600 mt-1">{analyticsData.passCount} Passed</p>
                </div>
                <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                  <p className="text-red-600 text-xs font-medium">Fail Count</p>
                  <p className="text-3xl font-bold text-red-700 mt-1">{analyticsData.failCount}</p>
                </div>
                <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <p className="text-purple-600 text-xs font-medium">Average SGPA</p>
                  <p className="text-3xl font-bold text-purple-700 mt-1">{analyticsData.avgSgpa}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Grade Distribution */}
                <div className="card">
                  <h3 className="font-semibold text-slate-800 mb-4">Grade Distribution</h3>
                  <div className="space-y-3">
                    {Object.entries(analyticsData.gradeDistribution).map(([grade, count]) => (
                      <div key={grade} className="flex items-center text-sm">
                        <div className="w-12 font-bold text-slate-700">{grade}</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-4 mx-3 overflow-hidden">
                          <div 
                            className={`h-full ${grade === 'F' ? 'bg-red-400' : 'bg-primary-500'}`}
                            style={{ 
                              width: `${analyticsData.totalStudents ? (count / (analyticsData.totalStudents * analyticsData.subjectWise.length)) * 100 * 2 : 0}%` 
                            }}
                          />
                        </div>
                        <div className="w-12 text-right text-slate-500">{count}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top 10 Students */}
                <div className="card">
                  <h3 className="font-semibold text-slate-800 mb-4">Top Performers</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="pb-2">Rank</th>
                          <th className="pb-2">Student</th>
                          <th className="pb-2 text-right">SGPA</th>
                          <th className="pb-2 text-right">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.topStudents.map((s, i) => (
                          <tr key={i} className="border-b border-slate-50">
                            <td className="py-2 font-bold text-slate-700">#{s.rank}</td>
                            <td className="py-2">
                              <div className="font-medium text-slate-800">{s.name}</div>
                              <div className="text-xs text-slate-400 font-mono">{s.enrollmentNo}</div>
                            </td>
                            <td className="py-2 text-right font-bold text-primary-600">{s.sgpa.toFixed(2)}</td>
                            <td className="py-2 text-right text-slate-600">{s.percentage.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Subject Performance */}
              <div className="card">
                <h3 className="font-semibold text-slate-800 mb-4">Subject-wise Performance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="py-3 px-3">Subject Code</th>
                        <th className="py-3 px-3">Subject Name</th>
                        <th className="py-3 px-3 text-center">Average Marks</th>
                        <th className="py-3 px-3 text-center">Highest</th>
                        <th className="py-3 px-3 text-center">Lowest</th>
                        <th className="py-3 px-3 text-center">Pass %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.subjectWise.map((s, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="py-3 px-3 font-medium text-slate-800">{s.code}</td>
                          <td className="py-3 px-3 text-slate-600">{s.name}</td>
                          <td className="py-3 px-3 text-center font-medium">{s.average}</td>
                          <td className="py-3 px-3 text-center text-emerald-600">{s.highest}</td>
                          <td className="py-3 px-3 text-center text-red-600">{s.lowest}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${Number(s.passPercentage) > 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {s.passPercentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12 text-slate-500">
              No analytics data available. Ensure gradesheet is generated.
            </div>
          )}
        </>
      )}

      {/* Revaluation Tab */}
      {tab === 'revaluation' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-800">Revaluation Requests</h3>
            <button onClick={loadRevaluations} className="btn-secondary text-xs">Refresh</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-medium">
                  <th className="py-3 px-4 text-left">Student</th>
                  <th className="py-3 px-4 text-left">Subject</th>
                  <th className="py-3 px-4 text-left">Reason</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {revaluations.length === 0 ? (
                  <tr><td colSpan="5" className="py-8 text-center text-slate-400">No requests found</td></tr>
                ) : (
                  revaluations.map(r => (
                    <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <p className="font-medium text-slate-800">{r.studentId?.firstName} {r.studentId?.lastName}</p>
                        <p className="text-xs text-slate-500">{r.studentId?.enrollmentNo}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-slate-700">{r.subjectId?.name}</p>
                        <p className="text-xs text-slate-500">{r.subjectId?.code} | Sem {r.semester}</p>
                      </td>
                      <td className="py-4 px-4 max-w-xs truncate text-slate-600" title={r.reason}>{r.reason}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase ${
                          r.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                          r.status === 'approved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {r.status === 'pending' && (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => {
                                setSelectedReval(r);
                                setRevalMarks({ internal: '', external: '' });
                              }}
                              className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleUpdateReval(r._id, 'rejected')}
                              className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{new Date(r.requestedAt).toLocaleDateString()}</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {selectedReval && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">Approve & Update Marks</h3>
              <button onClick={() => setSelectedReval(null)} className="text-slate-400 hover:text-slate-600">
                <Search className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg text-sm mb-4">
                <p className="text-slate-500">Student: <span className="text-slate-800 font-medium">{selectedReval.studentId?.firstName} {selectedReval.studentId?.lastName}</span></p>
                <p className="text-slate-500">Subject: <span className="text-slate-800 font-medium">{selectedReval.subjectId?.name}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs">New Internal Marks (Max 40)</label>
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="Leave blank to keep old"
                    value={revalMarks.internal}
                    onChange={e => setRevalMarks({...revalMarks, internal: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label text-xs">New External Marks (Max 60)</label>
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="Leave blank to keep old"
                    value={revalMarks.external}
                    onChange={e => setRevalMarks({...revalMarks, external: e.target.value})}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Entering marks here will automatically update the student's result and recalculate their SGPA/CGPA.</p>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setSelectedReval(null)} className="btn-secondary">Cancel</button>
              <button 
                onClick={() => handleUpdateReval(selectedReval._id, 'approved', revalMarks)}
                disabled={updating}
                className="btn-primary"
              >
                {updating ? 'Processing...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
