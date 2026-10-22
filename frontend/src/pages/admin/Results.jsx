import React, { useEffect, useState, useMemo, useCallback } from 'react';
import api from '../../api/axios';
import { 
  BarChart3, Calculator, Award, AlertCircle, FileSpreadsheet, 
  CheckCircle, Download, CheckCircle2, Circle, Search, Eye,
  CheckCheck, MessageSquare, Clock, Info, ChevronRight, ArrowUpDown,
  Lock, RefreshCw, X, ShieldAlert, Sparkles, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import AdminSubjectReviewModal from './AdminSubjectReviewModal';
import { DEPARTMENT_OPTIONS } from '../../constants/departments';
import { useAuth } from '../../context/AuthContext';
import academicConfig from '../../../../shared/academicConfig.json';

const BRANCH_OPTIONS = [
  { value: '', label: 'All Departments' },
  ...DEPARTMENT_OPTIONS,
];

const SEMESTERS_BY_TERM = {
  'july-december': [1, 3, 5, 7],
  'january-june': [2, 4, 6, 8],
};

const DEFAULT_SEMESTER_BY_TERM = {
  'july-december': '5',
  'january-june': '6',
};

const RESULT_STATUS_LABELS = {
  published: 'Published',
  generated: 'Generated',
  pending_generation: 'Ready to Generate',
  not_started: 'Not Generated',
};

const RESULT_STATUS_STYLES = {
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  generated: 'bg-blue-100 text-blue-800 border-blue-200',
  pending_generation: 'bg-amber-100 text-amber-800 border-amber-200',
  not_started: 'bg-slate-100 text-slate-600 border-slate-200',
};

const MARKS_STATUS_LABELS = {
  updated: 'Marks Updated',
  pending_approval: 'Pending Approval',
  returned: 'Returned',
  partial: 'Partially Updated',
  not_started: 'Not Started',
};

const MARKS_STATUS_STYLES = {
  updated: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
  returned: 'bg-rose-100 text-rose-800 border-rose-200',
  partial: 'bg-orange-100 text-orange-800 border-orange-200',
  not_started: 'bg-slate-100 text-slate-600 border-slate-200',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const DEFAULT_SESSIONS = academicConfig.ACADEMIC_YEARS || [
  `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
  `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  `${new Date().getFullYear() + 1}-${new Date().getFullYear() + 2}`
];

// Reusable Confirmation Dialog for Generate / Publish / Unpublish
function ConfirmationDialog({ isOpen, title, description, details, confirmText, confirmVariant = 'primary', onConfirm, onCancel, loading }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        role="dialog" 
        aria-modal="true" 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className={`p-2.5 rounded-xl ${confirmVariant === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-primary-50 text-primary-600'}`}>
              {confirmVariant === 'danger' ? <ShieldAlert className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            </div>
            <button 
              type="button" 
              onClick={onCancel} 
              disabled={loading}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{description}</p>

          {details && details.length > 0 && (
            <div className="mt-3.5 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between items-center text-slate-600">
                  <span className="font-medium text-slate-500">{k}:</span>
                  <span className="font-semibold text-slate-800">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
          <button 
            type="button" 
            onClick={onCancel} 
            disabled={loading} 
            className="btn-secondary text-xs px-3.5 py-1.5"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={onConfirm} 
            disabled={loading} 
            className={`text-xs px-4 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              confirmVariant === 'danger'
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {loading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminResults() {
  const { selectedTerm } = useAuth();
  const [tab, setTab] = useState('status');
  
  // Shared Filters
  const initialTerm = selectedTerm || localStorage.getItem('erp_academic_term') || 'july-december';
  const [term, setTerm] = useState(initialTerm);
  const [semester, setSemester] = useState(DEFAULT_SEMESTER_BY_TERM[initialTerm] || '5');
  const [session, setSession] = useState(() => localStorage.getItem('erp_academic_session') || DEFAULT_SESSIONS[1] || '2026-2027');
  const [branch, setBranch] = useState('');
  const [section, setSection] = useState('');
  
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

  // Review & Dialog states
  const [selectedReviewSubject, setSelectedReviewSubject] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [statusSearch, setStatusSearch] = useState('');
  const [bulkApproving, setBulkApproving] = useState(false);

  // Step 3 (Review) Table UX states
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('all'); // 'all' | 'pass' | 'fail'
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Confirmation Modals State
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);
  const [confirmPublishModal, setConfirmPublishModal] = useState({ isOpen: false, publish: true });

  // Student Lookup
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupSearched, setLookupSearched] = useState(false);

  const semesterOptions = SEMESTERS_BY_TERM[term] || [1, 2, 3, 4, 5, 6, 7, 8];
  const sectionOptions = semester
    ? academicConfig.SECTIONS_BY_YEAR[String(Math.ceil(Number(semester) / 2))] || []
    : [];

  const clearLoadedData = () => {
    setStatusData(null);
    setResultsData(null);
    setAnalyticsData(null);
    setLookupResults([]);
    setLookupSearched(false);
  };

  const buildResultParams = useCallback(() => {
    const params = new URLSearchParams();
    if (semester) params.set('semester', semester);
    if (session) params.set('session', session);
    if (term) params.set('term', term);
    if (branch) params.set('branch', branch);
    if (section) params.set('section', section);
    return params;
  }, [semester, session, term, branch, section]);

  // Reset dependent data whenever shared filters change to avoid stale state
  const handleSemesterChange = (newSem) => {
    setSemester(newSem);
    const nextSections = academicConfig.SECTIONS_BY_YEAR[String(Math.ceil(Number(newSem) / 2))] || [];
    if (section && !nextSections.includes(section)) setSection('');
    clearLoadedData();
  };

  const handleTermChange = (newTerm) => {
    setTerm(newTerm);
    const currentYear = Math.ceil(Number(semester) / 2);
    const targetSemester = newTerm === 'january-june' ? currentYear * 2 : currentYear * 2 - 1;
    const options = SEMESTERS_BY_TERM[newTerm] || [];
    if (targetSemester >= 1 && targetSemester <= 8 && options.includes(targetSemester)) {
      setSemester(String(targetSemester));
    } else if (options.length > 0) {
      setSemester(String(options[0]));
    }
    setSection('');
    clearLoadedData();
  };

  const handleSessionChange = (newSession) => {
    setSession(newSession);
    clearLoadedData();
  };

  const handleBranchChange = (newBranch) => {
    setBranch(newBranch);
    clearLoadedData();
  };

  const handleSectionChange = (newSection) => {
    setSection(newSection);
    clearLoadedData();
  };

  // Tab 1: Load Submission Status
  const loadStatus = useCallback(async () => {
    if (!semester || !session) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/results/submission-status?${buildResultParams().toString()}`);
      setStatusData(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load submission status');
    } finally {
      setLoading(false);
    }
  }, [semester, session, buildResultParams]);

  const reviewSubmission = async (item, status) => {
    const rejectionReason = status === 'rejected'
      ? window.prompt('Why are these marks being returned to faculty? (Provide clear feedback)')
      : '';
    if (status === 'rejected' && rejectionReason === null) return;
    if (status === 'approved' && !window.confirm(`Approve marks for ${item.code} (${item.name})?`)) return;

    setReviewingItem(item._id);
    try {
      const { data } = await api.patch('/admin/results/submission-status/review', {
        itemId: item._id,
        itemType: item.itemType,
        semester: Number(semester),
        session,
        term,
        branch,
        section,
        status,
        rejectionReason,
      });
      toast.success(data.message || `Subject ${status} successfully`);
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
    if (!window.confirm(`Approve submitted marks for all ${pendingSubjects.length} pending subject(s)?`)) return;

    setBulkApproving(true);
    try {
      await Promise.all(
        pendingSubjects.map((s) =>
          api.patch('/admin/results/submission-status/review', {
            itemId: s._id,
            itemType: s.itemType,
            semester: Number(semester),
            session,
            term,
            branch,
            section,
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

  // Tab 2: Generate Gradesheet
  const handleConfirmGenerate = async () => {
    setConfirmGenerateOpen(false);
    setGenerating(true);
    try {
      const { data } = await api.post('/admin/results/generate-gradesheet', {
        semester: Number(semester),
        session,
        term,
        branch,
        section
      });
      toast.success(`Generated gradesheet for ${data.data?.totalProcessed ?? 'all'} students!`);
      await loadResults();
      setTab('view');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate gradesheet');
    } finally {
      setGenerating(false);
    }
  };

  // Tab 3: Load Results
  const loadResults = useCallback(async () => {
    if (!semester || !session) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/results?${buildResultParams().toString()}`);
      setResultsData(data.data?.results || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load results');
      setResultsData([]);
    } finally {
      setLoading(false);
    }
  }, [semester, session, buildResultParams]);

  // Tab 4: Publish / Unpublish action execution
  const executePublishToggle = async () => {
    const { publish } = confirmPublishModal;
    setConfirmPublishModal({ isOpen: false, publish });
    setLoading(true);
    try {
      const { data } = await api.patch('/admin/results/publish', {
        semester: Number(semester),
        session,
        term,
        branch,
        section,
        publish
      });
      toast.success(data.message || (publish ? 'Results published to students' : 'Results unpublished'));
      await loadResults();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update publish status');
    } finally {
      setLoading(false);
    }
  };

  // Tab 5: Load Analytics
  const loadAnalytics = useCallback(async () => {
    if (!semester || !session) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/results/analytics?${buildResultParams().toString()}`);
      setAnalyticsData(data.data?.analytics || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load analytics');
      setAnalyticsData(null);
    } finally {
      setLoading(false);
    }
  }, [semester, session, buildResultParams]);

  // Export to Excel
  const handleExport = () => {
    if (!semester || !session) return toast.error('Enter semester and session');
    window.location.href = `${api.defaults.baseURL}/admin/results/export?${buildResultParams().toString()}`;
  };

  // Tab 6: Load Revaluations
  const loadRevaluations = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/revaluation-requests');
      setRevaluations(data.data?.requests || []);
    } catch (err) {
      toast.error('Failed to load revaluation requests');
      setRevaluations([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
    } finally {
      setUpdating(false);
    }
  };

  const runStudentLookup = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    const query = lookupQuery.trim();
    if (query.length < 2) {
      toast.error('Enter at least 2 characters to search');
      return;
    }
    setLookupLoading(true);
    setLookupSearched(true);
    try {
      const params = buildResultParams();
      params.set('query', query);
      const { data } = await api.get(`/admin/results/student-lookup?${params.toString()}`);
      setLookupResults(data.data?.students || []);
    } catch (err) {
      setLookupResults([]);
      toast.error(err.response?.data?.message || 'Failed to search student');
    } finally {
      setLookupLoading(false);
    }
  };

  // Refresh active tab
  const handleRefresh = () => {
    if (tab === 'status') loadStatus();
    else if (tab === 'view' || tab === 'publish') loadResults();
    else if (tab === 'analytics') loadAnalytics();
    else if (tab === 'revaluation') loadRevaluations();
    else if (tab === 'lookup' && lookupQuery.trim()) runStudentLookup();
  };

  // Trigger loads when tab or filters change
  useEffect(() => {
    if (tab === 'status') loadStatus();
    else if (tab === 'view' || tab === 'publish') loadResults();
    else if (tab === 'analytics') loadAnalytics();
    else if (tab === 'revaluation') loadRevaluations();
  }, [tab, loadStatus, loadResults, loadAnalytics, loadRevaluations]);

  // Dynamic Stepper Status
  const stepStatuses = useMemo(() => {
    let s1 = { status: 'not-started', label: 'Not started' };
    if (statusData) {
      if (statusData.allComplete) {
        s1 = { status: 'done', label: 'Complete' };
      } else {
        const hasPending = (statusData.subjects || []).some(s => (s.statusCounts?.pending || 0) > 0 || (s.statusCounts?.rejected || 0) > 0);
        if (hasPending) {
          s1 = { status: 'attention', label: 'Pending' };
        } else if ((statusData.completedSubjects || 0) > 0) {
          s1 = { status: 'progress', label: 'In Progress' };
        }
      }
    }

    const hasResults = resultsData && resultsData.length > 0;
    let s2 = { status: 'not-started', label: 'Waiting' };
    if (hasResults) {
      s2 = { status: 'done', label: 'Generated' };
    } else if (statusData?.allComplete) {
      s2 = { status: 'ready', label: 'Ready' };
    }

    let s3 = { status: 'locked', label: 'Locked' };
    if (hasResults) {
      s3 = { status: 'ready', label: `${resultsData.length} records` };
    }

    let s4 = { status: 'locked', label: 'Locked' };
    if (hasResults) {
      const pubCount = resultsData.filter(r => r.isPublished).length;
      if (pubCount === resultsData.length) {
        s4 = { status: 'done', label: 'Published' };
      } else if (pubCount > 0) {
        s4 = { status: 'attention', label: `${pubCount}/${resultsData.length}` };
      } else {
        s4 = { status: 'ready', label: 'Unpublished' };
      }
    }

    return { s1, s2, s3, s4 };
  }, [statusData, resultsData]);

  // Derived Results for Step 3
  const processedResults = useMemo(() => {
    if (!resultsData || resultsData.length === 0) return [];
    
    let list = resultsData.filter(r => {
      const q = reviewSearch.trim().toLowerCase();
      if (q) {
        const enroll = (r.studentId?.enrollmentNo || '').toLowerCase();
        const fullName = `${r.studentId?.firstName || ''} ${r.studentId?.lastName || ''}`.trim().toLowerCase();
        if (!enroll.includes(q) && !fullName.includes(q)) return false;
      }
      if (reviewStatusFilter === 'pass' && (r.status || '').toLowerCase() !== 'pass') return false;
      if (reviewStatusFilter === 'fail' && (r.status || '').toLowerCase() === 'pass') return false;
      return true;
    });

    if (sortField) {
      list = [...list].sort((a, b) => {
        let valA, valB;
        if (sortField === 'rank') {
          valA = a.rank ?? 99999;
          valB = b.rank ?? 99999;
        } else if (sortField === 'name') {
          valA = `${a.studentId?.firstName || ''} ${a.studentId?.lastName || ''}`.trim();
          valB = `${b.studentId?.firstName || ''} ${b.studentId?.lastName || ''}`.trim();
        } else if (sortField === 'enrollment') {
          valA = a.studentId?.enrollmentNo || '';
          valB = b.studentId?.enrollmentNo || '';
        } else if (sortField === 'sgpa') {
          valA = a.sgpa ?? -1;
          valB = b.sgpa ?? -1;
        } else if (sortField === 'cgpa') {
          valA = a.cgpa ?? -1;
          valB = b.cgpa ?? -1;
        } else if (sortField === 'percentage') {
          valA = a.percentage ?? -1;
          valB = b.percentage ?? -1;
        }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [resultsData, reviewSearch, reviewStatusFilter, sortField, sortDirection]);

  // Summary statistics for Step 3
  const reviewStats = useMemo(() => {
    if (!resultsData || resultsData.length === 0) return null;
    const total = resultsData.length;
    const passed = resultsData.filter(r => (r.status || '').toLowerCase() === 'pass').length;
    const failed = total - passed;
    const validSgpas = resultsData.map(r => r.sgpa).filter(s => typeof s === 'number' && !isNaN(s));
    const avgSgpa = validSgpas.length ? (validSgpas.reduce((acc, v) => acc + v, 0) / validSgpas.length).toFixed(2) : '—';
    const highestSgpa = validSgpas.length ? Math.max(...validSgpas).toFixed(2) : '—';

    return { total, passed, failed, avgSgpa, highestSgpa };
  }, [resultsData]);

  const currentBranchLabel = BRANCH_OPTIONS.find(b => b.value === branch)?.label || (branch || 'All Branches');

  const handleSortToggle = (field) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else { setSortField(null); setSortDirection('asc'); }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      
      {/* ─── UNIFIED HEADER & WORKFLOW CONTROL (Clean, Single Card) ───────── */}
      <div className="card p-4 sm:p-5 border-slate-200/80 shadow-sm bg-white space-y-4">
        
        {/* Top Row: Title on Left, Compact Filters & Utility on Right */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Academic Results</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify faculty marks, calculate semester gradesheets, review ranks, and publish to students.
            </p>
          </div>

          {/* Clean, Non-Redundant Filter Selects */}
          <div className="flex flex-wrap items-center gap-2">
            <select 
              value={session} 
              onChange={(e) => handleSessionChange(e.target.value)}
              className="input !py-1.5 !px-3 text-xs font-semibold text-slate-700 bg-slate-50 border-slate-200 rounded-lg w-auto"
              title="Academic Session"
              aria-label="Academic Session"
            >
              {DEFAULT_SESSIONS.map(sess => (
                <option key={sess} value={sess}>{sess}</option>
              ))}
            </select>

            <select 
              value={term} 
              onChange={(e) => handleTermChange(e.target.value)}
              className="input !py-1.5 !px-3 text-xs font-semibold text-slate-700 bg-slate-50 border-slate-200 rounded-lg w-auto"
              title="Academic Term"
              aria-label="Academic Term"
            >
              <option value="july-december">July-December</option>
              <option value="january-june">January-June</option>
            </select>

            <select 
              value={branch} 
              onChange={(e) => handleBranchChange(e.target.value)}
              className="input !py-1.5 !px-3 text-xs font-semibold text-slate-700 bg-slate-50 border-slate-200 rounded-lg w-auto max-w-[190px] sm:max-w-[220px]"
              title="Department / Branch"
              aria-label="Department / Branch"
            >
              {BRANCH_OPTIONS.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>

            <select 
              value={semester} 
              onChange={(e) => handleSemesterChange(e.target.value)}
              className="input !py-1.5 !px-3 text-xs font-semibold text-slate-700 bg-slate-50 border-slate-200 rounded-lg w-auto"
              title="Select Semester"
              aria-label="Semester"
            >
              {semesterOptions.map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>

            <select 
              value={section} 
              onChange={(e) => handleSectionChange(e.target.value)}
              disabled={sectionOptions.length === 0}
              className="input !py-1.5 !px-3 text-xs font-semibold text-slate-700 bg-slate-50 border-slate-200 rounded-lg w-auto disabled:opacity-50"
              title="Section"
              aria-label="Section"
            >
              <option value="">All Sections</option>
              {sectionOptions.map(item => (
                <option key={item} value={item}>Section {item}</option>
              ))}
            </select>

            {(tab === 'view' || tab === 'analytics') && (
              <button 
                type="button" 
                onClick={handleExport} 
                className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5 shadow-sm"
                title="Export current results to Excel"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}

            <button 
              type="button" 
              onClick={handleRefresh}
              disabled={loading}
              className="p-1.5 border border-slate-200 bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Refresh current data"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Second Row: Single-Line Stepper + Secondary Tools */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          
          {/* Linear Sequential Workflow Steps */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'status', num: '1', title: 'Check Submissions', meta: stepStatuses.s1, disabled: false },
              { id: 'generate', num: '2', title: 'Generate Gradesheet', meta: stepStatuses.s2, disabled: false },
              { id: 'view', num: '3', title: 'Review Results', meta: stepStatuses.s3, disabled: stepStatuses.s3.status === 'locked' },
              { id: 'publish', num: '4', title: 'Publish', meta: stepStatuses.s4, disabled: stepStatuses.s4.status === 'locked' },
            ].map((s, idx, arr) => {
              const isActive = tab === s.id;
              const isDone = s.meta.status === 'done';
              const isAttention = s.meta.status === 'attention';

              return (
                <React.Fragment key={s.id}>
                  <button
                    type="button"
                    onClick={() => { if (!s.disabled) setTab(s.id); }}
                    disabled={s.disabled}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-sm font-semibold'
                        : s.disabled
                          ? 'text-slate-400 bg-slate-50/50 cursor-not-allowed opacity-60'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : isDone
                          ? 'bg-emerald-100 text-emerald-700'
                          : isAttention
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isDone ? '✓' : s.num}
                    </span>
                    <span>{s.title}</span>
                    {!isActive && !s.disabled && (
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isDone ? 'bg-emerald-500' : isAttention ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'
                      }`} />
                    )}
                  </button>
                  {idx < arr.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 hidden sm:inline" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Secondary Auxiliary Tools Pill */}
          <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('analytics')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === 'analytics' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-primary-600" />
              <span>Analytics</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('lookup')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === 'lookup' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-blue-600" />
              <span>Student Lookup</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('revaluation')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === 'revaluation' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
              <span>Revaluations</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── STEP 1: CHECK SUBMISSIONS & APPROVE MARKS ────────────────────── */}
      {tab === 'status' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {loading ? (
            <div className="card p-12 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Checking faculty submissions...</p>
            </div>
          ) : statusData ? (
            <div className="space-y-4">
              {/* Summary Metrics */}
              {(() => {
                const total = statusData.totalSubjects || 0;
                const completed = statusData.completedSubjects || 0;
                const pendingCount = (statusData.subjects || []).filter(s => (s.statusCounts?.pending || 0) > 0).length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="card p-3.5 border-slate-200">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total Subjects &amp; Labs</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">{total}</p>
                    </div>

                    <div className="card p-3.5 border-amber-200 bg-amber-50/30">
                      <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Pending Review</p>
                      <p className="text-2xl font-bold text-amber-800 mt-1">{pendingCount}</p>
                    </div>

                    <div className="card p-3.5 border-emerald-200 bg-emerald-50/30">
                      <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Approved</p>
                      <p className="text-2xl font-bold text-emerald-800 mt-1">{completed} / {total}</p>
                      <div className="w-full bg-emerald-100 rounded-full h-1 mt-1.5 overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="card p-3.5 border-purple-200 bg-purple-50/30">
                      <p className="text-[11px] font-semibold text-purple-700 uppercase tracking-wide">Expected Students</p>
                      <p className="text-2xl font-bold text-purple-800 mt-1">{statusData.totalStudents || 0}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Action Banner (Only if ready or actionable) */}
              {statusData.allComplete ? (
                <div className="p-3.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-semibold">
                      All marks approved. You are ready to generate gradesheets in Step 2.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('generate')}
                    className="btn-primary text-xs px-3.5 py-1.5 shadow-sm"
                  >
                    Proceed to Step 2 →
                  </button>
                </div>
              ) : null}

              {/* Table Toolbar */}
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
                  <div className="card space-y-3.5 p-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      {/* Search */}
                      <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          className="input !pl-9 !py-1.5 text-xs w-full bg-slate-50"
                          placeholder="Search code, subject, faculty..."
                          value={statusSearch}
                          onChange={(e) => setStatusSearch(e.target.value)}
                        />
                      </div>

                      {/* Filter Pills */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setStatusFilter('all')}
                          className={`px-2.5 py-1 rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
                        >
                          All ({statusData.subjects?.length || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('pending')}
                          className={`px-2.5 py-1 rounded-lg transition-colors ${statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'hover:text-slate-900'}`}
                        >
                          Pending ({pendingItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('approved')}
                          className={`px-2.5 py-1 rounded-lg transition-colors ${statusFilter === 'approved' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
                        >
                          Approved ({approvedItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter('rejected')}
                          className={`px-2.5 py-1 rounded-lg transition-colors ${statusFilter === 'rejected' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
                        >
                          Returned ({rejectedItems.length})
                        </button>
                      </div>

                      {/* Bulk Approve Action */}
                      {pendingItems.length > 0 && (
                        <button
                          type="button"
                          onClick={handleBulkApprove}
                          disabled={bulkApproving}
                          className="btn-primary text-xs px-3.5 py-1.5 flex items-center justify-center gap-1.5 shadow-sm"
                          title="Bulk approve all pending subject marks"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>{bulkApproving ? 'Approving...' : `Bulk Approve (${pendingItems.length})`}</span>
                        </button>
                      )}
                    </div>

                    {/* Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                              <th className="py-2.5 px-3">Subject / Lab</th>
                              <th className="py-2.5 px-3">Assigned Faculty</th>
                              <th className="py-2.5 px-3">Marks Progress</th>
                              <th className="py-2.5 px-3">Review Status</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
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
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-800 font-mono">{s.code}</span>
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${isLab ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {isLab ? 'Lab' : 'Theory'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">{s.name}</p>
                                  </td>

                                  <td className="py-3 px-3">
                                    <span className="font-medium text-slate-700">{s.faculty || '—'}</span>
                                    {Array.isArray(s.submittedBy) && s.submittedBy.length > 0 && (
                                      <p className="text-[11px] text-slate-400 mt-0.5">
                                        Submitted by {s.submittedBy.join(', ')}
                                      </p>
                                    )}
                                  </td>

                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="font-bold text-slate-800">{s.studentsWithMarks}</span>
                                      <span className="text-slate-400">/ {s.totalStudents}</span>
                                    </div>
                                    {s.totalStudents > 0 && (
                                      <div className="w-28 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                                        <div 
                                          className={`h-full rounded-full transition-all ${s.isComplete ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                          style={{ width: `${Math.min(100, (s.studentsWithMarks / s.totalStudents) * 100)}%` }}
                                        />
                                      </div>
                                    )}
                                  </td>

                                  <td className="py-3 px-3">
                                    {s.isComplete ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Approved
                                      </span>
                                    ) : hasPending ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending ({s.statusCounts?.pending})
                                      </span>
                                    ) : hasRejected ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Returned ({s.statusCounts?.rejected})
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-xs">Not Started</span>
                                    )}
                                  </td>

                                  <td className="py-3 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedReviewSubject(s)}
                                        className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 hover:border-primary-300 hover:text-primary-700"
                                        title="Inspect student marks list"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Review</span>
                                      </button>

                                      {s.studentsWithMarks > 0 && (s.statusCounts?.pending > 0 || s.statusCounts?.rejected > 0) && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => reviewSubmission(s, 'approved')}
                                            disabled={reviewingItem === s._id}
                                            className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 font-medium border border-emerald-200 transition-colors"
                                            title="Quick accept marks"
                                          >
                                            Accept
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => reviewSubmission(s, 'rejected')}
                                            disabled={reviewingItem === s._id}
                                            className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 font-medium border border-rose-200 transition-colors"
                                            title="Return marks with comment"
                                          >
                                            Return
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
                                <td colSpan="5" className="text-center py-8 text-slate-500">
                                  <Search className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                                  <p className="font-medium text-slate-600">No subjects match this filter</p>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="card text-center py-12 text-slate-500 space-y-3">
              <p className="text-sm">Click below to check marks submission status.</p>
              <button onClick={loadStatus} className="btn-primary text-xs mx-auto">
                <Search className="w-4 h-4 mr-1.5" /> Check Submissions
              </button>
            </div>
          )}

          {/* Admin Subject Review Modal */}
          <AdminSubjectReviewModal
            isOpen={Boolean(selectedReviewSubject)}
            onClose={() => setSelectedReviewSubject(null)}
            subject={selectedReviewSubject}
            semester={semester}
            session={session}
            term={term}
            branch={branch}
            section={section}
            onReviewComplete={loadStatus}
          />
        </div>
      )}

      {/* ─── STEP 2: GENERATE GRADESHEET ──────────────────────────────────── */}
      {tab === 'generate' && (
        <div className="max-w-xl mx-auto space-y-4 animate-in fade-in duration-150">
          <div className="card p-6 text-center space-y-3 border-slate-200">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto shadow-sm">
              <Calculator className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Generate Gradesheet</h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Calculates Total Marks, Letter Grades, Grade Points, SGPA, CGPA, Percentage, and Rank for all students in the selected semester.
            </p>

            <div className="pt-2">
              <button 
                type="button" 
                onClick={() => setConfirmGenerateOpen(true)}
                disabled={generating || statusData?.allComplete === false} 
                className="btn-primary text-xs px-6 py-2.5 shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Calculator className="w-4 h-4" />
                <span>{generating ? 'Calculating...' : 'Generate Gradesheet'}</span>
              </button>
            </div>

            {statusData?.allComplete === false && (
              <p className="text-[11px] text-amber-700 font-medium">
                ⚠️ All subject marks must be approved in Step 1 before generating gradesheets.
              </p>
            )}

            {resultsData && resultsData.length > 0 && (
              <p className="text-[11px] text-slate-400">
                Note: Gradesheets already exist ({resultsData.length} records). Generating again will recalculate and overwrite.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── STEP 3: REVIEW RESULTS ───────────────────────────────────────── */}
      {tab === 'view' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {loading ? (
            <div className="card p-12 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Loading student gradesheets...</p>
            </div>
          ) : resultsData && resultsData.length > 0 ? (
            <>
              {/* Derived Summary Metrics */}
              {reviewStats && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="card p-3.5 border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Students</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{reviewStats.total}</p>
                  </div>
                  <div className="card p-3.5 border-emerald-200 bg-emerald-50/30">
                    <p className="text-[11px] font-semibold text-emerald-700 uppercase">Passed</p>
                    <p className="text-2xl font-bold text-emerald-800 mt-1">{reviewStats.passed}</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      {Math.round((reviewStats.passed / reviewStats.total) * 100)}% Pass Rate
                    </p>
                  </div>
                  <div className="card p-3.5 border-rose-200 bg-rose-50/30">
                    <p className="text-[11px] font-semibold text-rose-700 uppercase">Failed / ATKT</p>
                    <p className="text-2xl font-bold text-rose-800 mt-1">{reviewStats.failed}</p>
                  </div>
                  <div className="card p-3.5 border-primary-200 bg-primary-50/30">
                    <p className="text-[11px] font-semibold text-primary-700 uppercase">Average SGPA</p>
                    <p className="text-2xl font-bold text-primary-800 mt-1">{reviewStats.avgSgpa}</p>
                  </div>
                  <div className="card p-3.5 border-purple-200 bg-purple-50/30 col-span-2 sm:col-span-1">
                    <p className="text-[11px] font-semibold text-purple-700 uppercase">Highest SGPA</p>
                    <p className="text-2xl font-bold text-purple-800 mt-1">{reviewStats.highestSgpa}</p>
                  </div>
                </div>
              )}

              {/* Table Toolbar */}
              <div className="card p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Search */}
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="input !pl-9 !py-1.5 text-xs w-full bg-slate-50"
                      placeholder="Search enrollment no or student name..."
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                    />
                  </div>

                  {/* Status Filter Pills */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
                    <button
                      type="button"
                      onClick={() => setReviewStatusFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${reviewStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
                    >
                      All ({resultsData.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewStatusFilter('pass')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${reviewStatusFilter === 'pass' ? 'bg-emerald-600 text-white shadow-sm' : 'hover:text-slate-900'}`}
                    >
                      Passed ({resultsData.filter(r => (r.status || '').toLowerCase() === 'pass').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewStatusFilter('fail')}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${reviewStatusFilter === 'fail' ? 'bg-rose-600 text-white shadow-sm' : 'hover:text-slate-900'}`}
                    >
                      Failed ({resultsData.filter(r => (r.status || '').toLowerCase() !== 'pass').length})
                    </button>
                  </div>

                  {/* Forward to Step 4 */}
                  <button
                    type="button"
                    onClick={() => setTab('publish')}
                    className="btn-primary text-xs px-3.5 py-1.5 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>Proceed to Step 4: Publish →</span>
                  </button>
                </div>

                {/* Results Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[550px]">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200 text-slate-700 text-xs uppercase font-semibold tracking-wider">
                        <tr>
                          <th 
                            className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={() => handleSortToggle('rank')}
                          >
                            <div className="flex items-center gap-1">
                              <span>Rank</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th 
                            className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={() => handleSortToggle('enrollment')}
                          >
                            <div className="flex items-center gap-1">
                              <span>Enrollment No</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th 
                            className="py-2.5 px-3 cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={() => handleSortToggle('name')}
                          >
                            <div className="flex items-center gap-1">
                              <span>Student Name</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-2.5 px-3 text-center">Earned Credits</th>
                          <th 
                            className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={() => handleSortToggle('sgpa')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>SGPA</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th 
                            className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={() => handleSortToggle('cgpa')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>CGPA</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th 
                            className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={() => handleSortToggle('percentage')}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <span>Percentage</span>
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </div>
                          </th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {processedResults.map((r) => {
                          const isPass = (r.status || '').toLowerCase() === 'pass';
                          const enroll = r.studentId?.enrollmentNo;
                          const fullName = `${r.studentId?.firstName || ''} ${r.studentId?.lastName || ''}`.trim();

                          return (
                            <tr key={r._id} className={`hover:bg-slate-50/80 transition-colors ${r.rank <= 3 ? 'bg-amber-50/20' : ''}`}>
                              <td className="py-2.5 px-3 font-bold text-slate-700">
                                {r.rank === 1 ? (
                                  <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-100/80 px-2 py-0.5 rounded-full" aria-label="Rank 1 Gold">
                                    🥇 1
                                  </span>
                                ) : r.rank === 2 ? (
                                  <span className="inline-flex items-center gap-1 text-slate-700 font-bold bg-slate-200/80 px-2 py-0.5 rounded-full" aria-label="Rank 2 Silver">
                                    🥈 2
                                  </span>
                                ) : r.rank === 3 ? (
                                  <span className="inline-flex items-center gap-1 text-amber-900 font-bold bg-amber-200/80 px-2 py-0.5 rounded-full" aria-label="Rank 3 Bronze">
                                    🥉 3
                                  </span>
                                ) : (
                                  <span className="text-slate-600 pl-2">{r.rank || '—'}</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 font-mono text-xs">
                                {enroll ? (
                                  <span className="font-semibold text-slate-800">{enroll}</span>
                                ) : (
                                  <span className="text-slate-400 italic">Missing Enrollment</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3">
                                {fullName ? (
                                  <span className="font-semibold text-slate-800">{fullName}</span>
                                ) : (
                                  <span className="text-slate-400 italic">Unlinked Student Record</span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-center text-slate-600">
                                {r.earnedCredits || 0} / {r.totalCredits || 0}
                              </td>

                              <td className="py-2.5 px-3 text-center font-bold text-primary-700">
                                {typeof r.sgpa === 'number' ? r.sgpa.toFixed(2) : '—'}
                              </td>

                              <td className="py-2.5 px-3 text-center font-bold text-indigo-700">
                                {typeof r.cgpa === 'number' ? r.cgpa.toFixed(2) : '—'}
                              </td>

                              <td className="py-2.5 px-3 text-center text-slate-700 font-medium">
                                {typeof r.percentage === 'number' ? `${r.percentage.toFixed(1)}%` : '—'}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                  isPass 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}>
                                  {(r.status || 'pending').toUpperCase()}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={r.remarks || ''}>
                                {r.remarks ? (
                                  <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                                    {r.remarks}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {processedResults.length === 0 && (
                          <tr>
                            <td colSpan="9" className="text-center py-8 text-slate-500">
                              <Search className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                              <p className="font-medium text-slate-600">No results found matching query</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center py-12 space-y-3">
              <Eye className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-700 text-sm">No Gradesheet Generated Yet</h3>
              <button 
                type="button" 
                onClick={() => setTab('generate')} 
                className="btn-primary text-xs px-3.5 py-1.5"
              >
                Go to Step 2: Generate Gradesheet
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── STEP 4: PUBLISH / UNPUBLISH CONTROL ───────────────────────────── */}
      {tab === 'publish' && (
        <div className="max-w-xl mx-auto space-y-4 animate-in fade-in duration-150">
          {loading ? (
            <div className="card p-12 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Checking publish status...</p>
            </div>
          ) : resultsData && resultsData.length > 0 ? (
            (() => {
              const totalCount = resultsData.length;
              const publishedCount = resultsData.filter(r => r.isPublished).length;
              const isFullyPublished = publishedCount === totalCount;

              return (
                <div className="card p-6 text-center space-y-5 border-slate-200">
                  <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-sm ${
                    isFullyPublished 
                      ? 'bg-emerald-100 text-emerald-600' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isFullyPublished ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      {isFullyPublished ? 'Results are Published' : 'Results are Unpublished'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {totalCount} total results · {publishedCount} currently visible to students.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center gap-2.5 pt-1">
                    <button 
                      type="button" 
                      onClick={() => setConfirmPublishModal({ isOpen: true, publish: true })}
                      disabled={isFullyPublished}
                      className="btn-primary py-2.5 px-6 text-xs font-semibold shadow-sm disabled:opacity-50"
                    >
                      Publish Results
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setConfirmPublishModal({ isOpen: true, publish: false })}
                      disabled={publishedCount === 0}
                      className="btn-secondary py-2.5 px-6 text-xs font-semibold border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Unpublish Results
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="card text-center py-12 space-y-3">
              <Lock className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-700 text-sm">Cannot Publish Yet</h3>
              <p className="text-xs text-slate-500">
                Generate gradesheets in Step 2 before publishing.
              </p>
              <button onClick={() => setTab('status')} className="btn-primary text-xs px-3.5 py-1.5">
                Go to Step 1
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: ANALYTICS ──────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {loading ? (
            <div className="card p-12 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Computing analytics...</p>
            </div>
          ) : analyticsData ? (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card p-3.5 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <p className="text-blue-700 text-[11px] font-semibold uppercase">Total Students</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{analyticsData.totalStudents}</p>
                </div>
                <div className="card p-3.5 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <p className="text-green-700 text-[11px] font-semibold uppercase">Pass Rate</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">{analyticsData.passPercentage}%</p>
                  <p className="text-[10px] text-green-700 mt-0.5">{analyticsData.passCount} Passed</p>
                </div>
                <div className="card p-3.5 bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200">
                  <p className="text-rose-700 text-[11px] font-semibold uppercase">Fail / ATKT</p>
                  <p className="text-2xl font-bold text-rose-900 mt-1">{analyticsData.failCount}</p>
                </div>
                <div className="card p-3.5 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <p className="text-purple-700 text-[11px] font-semibold uppercase">Average SGPA</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">{analyticsData.avgSgpa}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Grade Distribution */}
                <div className="card p-4">
                  <h3 className="font-bold text-slate-800 text-xs mb-3">Letter Grade Distribution</h3>
                  <div className="space-y-2">
                    {Object.entries(analyticsData.gradeDistribution || {}).map(([grade, count]) => (
                      <div key={grade} className="flex items-center text-xs">
                        <div className="w-8 font-bold text-slate-700">{grade}</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 mx-3 overflow-hidden">
                          <div 
                            className={`h-full ${grade === 'F' ? 'bg-rose-500' : 'bg-primary-500'}`}
                            style={{ 
                              width: `${analyticsData.totalStudents ? Math.min(100, (count / (analyticsData.totalStudents * (analyticsData.subjectWise?.length || 1))) * 100 * 2) : 0}%` 
                            }}
                          />
                        </div>
                        <div className="w-10 text-right font-semibold text-slate-600">{count}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Performers */}
                <div className="card p-4">
                  <h3 className="font-bold text-slate-800 text-xs mb-3">Top Performers</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase">
                          <th className="pb-1.5">Rank</th>
                          <th className="pb-1.5">Student</th>
                          <th className="pb-1.5 text-right">SGPA</th>
                          <th className="pb-1.5 text-right">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(analyticsData.topStudents || []).map((s, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 font-bold text-slate-700">#{s.rank}</td>
                            <td className="py-2">
                              <div className="font-semibold text-slate-800">{s.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{s.enrollmentNo}</div>
                            </td>
                            <td className="py-2 text-right font-bold text-primary-700">{s.sgpa?.toFixed(2)}</td>
                            <td className="py-2 text-right text-slate-600">{s.percentage?.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-10 text-slate-500 text-xs">
              No analytics data available. Generate gradesheets first.
            </div>
          )}
        </div>
      )}

      {/* ─── STUDENT RESULT & MARKS LOOKUP ────────────────────────────────── */}
      {tab === 'lookup' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="card p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Student Result &amp; Marks Lookup</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search by student name or enrollment number to check whether marks and results have been updated.
                </p>
              </div>
            </div>

            <form onSubmit={runStudentLookup} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="input !pl-9 text-sm w-full"
                  placeholder="Enter student name or enrollment number..."
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                />
              </div>
              <button type="submit" disabled={lookupLoading} className="btn-primary text-xs px-5 py-2.5 flex items-center justify-center gap-1.5">
                <Search className="w-4 h-4" />
                <span>{lookupLoading ? 'Searching...' : 'Search Student'}</span>
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
              <span>Session: <strong className="text-slate-700">{session}</strong></span>
              <span>Term: <strong className="text-slate-700">{term === 'july-december' ? 'July-December' : 'January-June'}</strong></span>
              <span>Semester: <strong className="text-slate-700">{semester}</strong></span>
              <span>Department: <strong className="text-slate-700">{currentBranchLabel}</strong></span>
              <span>Section: <strong className="text-slate-700">{section || 'All'}</strong></span>
            </div>
          </div>

          {lookupLoading ? (
            <div className="card p-12 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Checking student marks and result status...</p>
            </div>
          ) : lookupSearched ? (
            lookupResults.length === 0 ? (
              <div className="card text-center py-12 text-slate-500 space-y-2">
                <Search className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No matching student found</p>
                <p className="text-xs">Try another name or enrollment number, or clear the department/section filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 px-1">{lookupResults.length} student(s) found</p>
                {lookupResults.map((entry) => {
                  const student = entry.student;
                  const result = entry.result;
                  const resultStatusLabel = RESULT_STATUS_LABELS[entry.resultStatus] || entry.resultStatus;
                  const resultStatusStyle = RESULT_STATUS_STYLES[entry.resultStatus] || RESULT_STATUS_STYLES.not_started;
                  const marksStatusLabel = MARKS_STATUS_LABELS[entry.marksStatus] || entry.marksStatus;
                  const marksStatusStyle = MARKS_STATUS_STYLES[entry.marksStatus] || MARKS_STATUS_STYLES.not_started;

                  return (
                    <div key={entry._id} className="card p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800">{student.firstName} {student.lastName}</h4>
                            <span className="font-mono text-[11px] text-slate-500">{student.enrollmentNo}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {student.email || 'No email'} · Semester {student.currentSemester} · Section {student.section || '—'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${marksStatusStyle}`}>
                            {marksStatusLabel}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${resultStatusStyle}`}>
                            {resultStatusLabel}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase text-slate-500">Marks Uploaded</p>
                          <p className="text-lg font-bold text-slate-800 mt-0.5">{entry.marks.uploaded} / {entry.marks.totalItems}</p>
                          <p className="text-[10px] text-slate-500">Approved: {entry.marks.approved} · Pending: {entry.marks.pending} · Returned: {entry.marks.rejected}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase text-slate-500">Result</p>
                          {result ? (
                            <>
                              <p className="text-lg font-bold text-slate-800 mt-0.5">
                                {typeof result.sgpa === 'number' ? result.sgpa.toFixed(2) : '—'} SGPA
                              </p>
                              <p className="text-[10px] text-slate-500">
                                CGPA {typeof result.cgpa === 'number' ? result.cgpa.toFixed(2) : '—'} · {(result.status || 'pending').toUpperCase()}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-slate-700 mt-0.5">Not generated</p>
                              <p className="text-[10px] text-slate-500">No gradesheet exists for this semester.</p>
                            </>
                          )}
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase text-slate-500">Marks Last Updated</p>
                          <p className="text-xs font-semibold text-slate-800 mt-1">{formatDateTime(entry.marks.updatedAt)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase text-slate-500">Result Last Updated</p>
                          <p className="text-xs font-semibold text-slate-800 mt-1">{formatDateTime(result?.updatedAt)}</p>
                        </div>
                      </div>

                      <details className="rounded-xl border border-slate-200 overflow-hidden">
                        <summary className="cursor-pointer bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 select-none">
                          Subject-wise marks ({entry.marks.items.length} submitted)
                        </summary>
                        {entry.marks.items.length === 0 ? (
                          <p className="px-3 py-4 text-xs text-slate-500">No subject marks have been submitted for this student yet.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500 bg-white">
                                  <th className="text-left px-3 py-2">Code</th>
                                  <th className="text-left px-3 py-2">Subject / Lab</th>
                                  <th className="text-center px-3 py-2">Marks</th>
                                  <th className="text-center px-3 py-2">Grade</th>
                                  <th className="text-center px-3 py-2">Status</th>
                                  <th className="text-left px-3 py-2">Updated</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {entry.marks.items.map((mark, index) => (
                                  <tr key={`${mark.code}-${index}`} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 font-mono font-semibold text-slate-700">{mark.code || '—'}</td>
                                    <td className="px-3 py-2 text-slate-700">
                                      {mark.name || '—'}
                                      <span className={`ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${mark.itemType === 'lab' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {mark.itemType === 'lab' ? 'Lab' : 'Theory'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center font-bold text-slate-800">{mark.totalMarks ?? '—'}</td>
                                    <td className="px-3 py-2 text-center font-semibold text-primary-700">{mark.grade || '—'}</td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                        mark.submissionStatus === 'approved'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : mark.submissionStatus === 'rejected'
                                            ? 'bg-rose-100 text-rose-700'
                                            : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        {mark.submissionStatus === 'approved' ? 'Approved' : mark.submissionStatus === 'rejected' ? 'Returned' : 'Pending'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-slate-500">{formatDateTime(mark.updatedAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </details>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="card text-center py-12 text-slate-500 space-y-2">
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Search a student to begin</p>
              <p className="text-xs">Use the current session, term, semester, department and section filters for an accurate status.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 6: REVALUATION REQUESTS ──────────────────────────────────── */}
      {tab === 'revaluation' && (
        <div className="card p-4 space-y-3.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm">Student Revaluation Requests</h3>
            <button type="button" onClick={loadRevaluations} className="btn-secondary text-xs px-3 py-1">
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                  <th className="py-2 px-3 text-left">Student</th>
                  <th className="py-2 px-3 text-left">Subject</th>
                  <th className="py-2 px-3 text-left">Reason</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {revaluations.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-400">
                      No revaluation requests found
                    </td>
                  </tr>
                ) : (
                  revaluations.map(r => (
                    <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-800">{r.studentId?.firstName} {r.studentId?.lastName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{r.studentId?.enrollmentNo}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-slate-700">{r.subjectId?.name}</p>
                        <p className="text-[10px] text-slate-400">{r.subjectId?.code} · Sem {r.semester}</p>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-600" title={r.reason || ''}>
                        {r.reason || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          r.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {r.status === 'pending' && (
                          <div className="flex justify-end gap-1.5">
                            <button 
                              type="button"
                              onClick={() => {
                                setSelectedReval(r);
                                setRevalMarks({ internal: '', external: '' });
                              }}
                              className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-semibold hover:bg-emerald-700 transition-colors"
                            >
                              Approve
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleUpdateReval(r._id, 'rejected')}
                              className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-semibold hover:bg-rose-700 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── CONFIRMATION DIALOG: GENERATE GRADESHEET ────────────────────── */}
      <ConfirmationDialog
        isOpen={confirmGenerateOpen}
        title="Generate Gradesheet?"
        description="Calculates marks, SGPA, CGPA, and ranks for students in this semester."
        details={[
          ['Semester', `Semester ${semester}`],
          ['Session', session],
          ['Term', term === 'july-december' ? 'July-December' : 'January-June'],
          ['Branch', currentBranchLabel],
          ['Section', section || 'All Sections'],
          ['Expected Students', statusData?.totalStudents ?? 'All enrolled']
        ]}
        confirmText="Confirm & Calculate"
        confirmVariant="primary"
        loading={generating}
        onConfirm={handleConfirmGenerate}
        onCancel={() => setConfirmGenerateOpen(false)}
      />

      {/* ─── CONFIRMATION DIALOG: PUBLISH / UNPUBLISH ─────────────────────── */}
      <ConfirmationDialog
        isOpen={confirmPublishModal.isOpen}
        title={confirmPublishModal.publish ? 'Publish Results to Student Portal?' : 'Unpublish Results?'}
        description={
          confirmPublishModal.publish
            ? 'Results will become immediately visible to students on their portal.'
            : 'Results will be hidden from the student portal. You can republish at any time.'
        }
        details={[
          ['Action', confirmPublishModal.publish ? 'Make Visible' : 'Hide from Students'],
          ['Semester', `Semester ${semester}`],
          ['Session', session],
          ['Term', term === 'july-december' ? 'July-December' : 'January-June'],
          ['Branch', currentBranchLabel],
          ['Section', section || 'All Sections'],
          ['Total Records', `${resultsData?.length || 0} students`]
        ]}
        confirmText={confirmPublishModal.publish ? 'Confirm & Publish' : 'Confirm & Unpublish'}
        confirmVariant={confirmPublishModal.publish ? 'primary' : 'danger'}
        loading={loading}
        onConfirm={executePublishToggle}
        onCancel={() => setConfirmPublishModal({ isOpen: false, publish: true })}
      />

      {/* ─── MODAL: APPROVE REVALUATION & UPDATE MARKS ────────────────────── */}
      {selectedReval && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Update Marks on Revaluation</h3>
              <button 
                type="button" 
                onClick={() => setSelectedReval(null)} 
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-slate-50 p-2.5 rounded-lg text-xs space-y-0.5">
                <p className="text-slate-500">Student: <strong className="text-slate-800">{selectedReval.studentId?.firstName} {selectedReval.studentId?.lastName}</strong></p>
                <p className="text-slate-500">Subject: <strong className="text-slate-800">{selectedReval.subjectId?.name}</strong></p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="label text-[11px]">New Internal</label>
                  <input 
                    type="number" 
                    className="input text-xs" 
                    placeholder="Keep old"
                    value={revalMarks.internal}
                    onChange={e => setRevalMarks({...revalMarks, internal: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label text-[11px]">New External</label>
                  <input 
                    type="number" 
                    className="input text-xs" 
                    placeholder="Keep old"
                    value={revalMarks.external}
                    onChange={e => setRevalMarks({...revalMarks, external: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setSelectedReval(null)} 
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => handleUpdateReval(selectedReval._id, 'approved', revalMarks)}
                disabled={updating}
                className="btn-primary text-xs px-3.5 py-1.5"
              >
                {updating ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
