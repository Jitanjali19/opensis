import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Search, ChevronLeft, ChevronRight, Pencil, Trash2, X, Download } from 'lucide-react';

const SESSION_OPTIONS = Array.from({ length: 4 }, (_, index) => {
  const startYear = new Date().getFullYear() - index;
  return `${startYear}-${startYear + 1}`;
});

const BRANCH_OPTIONS = ['CSE', 'IT', 'ECE', 'IP', 'BM', 'CIVIL', 'MC', 'ME', 'CE'];
const SEMESTER_SESSION_OPTIONS = [
  { value: 'july-december', label: 'July-December' },
  { value: 'january-june', label: 'January-June' },
];
const SEMESTER_SESSION_MAP = {
  'july-december': [1, 3, 5, 7],
  'january-june': [2, 4, 6, 8],
};
const FIRST_YEAR_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const OTHER_YEAR_SECTIONS = ['A', 'B'];

const YEAR_OPTIONS = [
  { value: '1', label: '1st Year' },
  { value: '2', label: '2nd Year' },
  { value: '3', label: '3rd Year' },
  { value: '4', label: '4th Year' },
];

const YEAR_SEMESTER_MAP = {
  '1': [1, 2],
  '2': [3, 4],
  '3': [5, 6],
  '4': [7, 8],
};

function DeleteModal({ name, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Delete Student</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <span className="font-semibold text-slate-800">{name}</span>? This will also remove their login access. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onConfirm} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-xl disabled:opacity-60">
            {loading ? 'Deleting...' : 'Yes, Delete'}
          </button>
          <button onClick={onCancel} className="flex-1 btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [session, setSession] = useState('');
  const [semesterSession, setSemesterSession] = useState('');
  const [year, setYear] = useState('');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterApplied, setFilterApplied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const requestId = useRef(0);

  const yearSemesters = year ? YEAR_SEMESTER_MAP[String(year)] || [] : [];
  const sessionSemesters = semesterSession ? SEMESTER_SESSION_MAP[semesterSession] || [] : [];
  const allowedSemesters = semesterSession
    ? yearSemesters.filter(semesterNumber => sessionSemesters.includes(semesterNumber))
    : yearSemesters;
  const allowedSections = year === '1' ? FIRST_YEAR_SECTIONS : OTHER_YEAR_SECTIONS;

  const handleSessionChange = (value) => {
    setSession(value);
    setSemesterSession('');
    setYear('');
    setBranch('');
    setSemester('');
    setSection('');
    setPage(1);
  };

  const handleSemesterSessionChange = (value) => {
    setSemesterSession(value);
    setYear('');
    setBranch('');
    setSemester('');
    setSection('');
    setPage(1);
  };

  const handleYearChange = (value) => {
    setYear(value);
    setBranch('');
    setSemester('');
    setSection('');
    setPage(1);
  };

  const handleBranchChange = (value) => {
    setBranch(value);
    setSemester('');
    setSection('');
    setPage(1);
  };

  const handleSemesterChange = (value) => {
    setSemester(value);
    setSection('');
    setPage(1);
  };

  const handleSectionChange = (value) => {
    setSection(value);
    setPage(1);
  };

  const load = async () => {
    if (!session && !year && !branch && !semester && !section && !search.trim()) return;
    const currentRequestId = ++requestId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (search.trim()) params.set('search', search.trim());
      if (session) params.set('session', session);
      if (semesterSession) params.set('semesterSession', semesterSession);
      if (year) params.set('year', year);
      if (branch) params.set('branch', branch);
      if (semester) params.set('semester', semester);
      if (section) params.set('section', section);
      if (search.trim()) params.set('search', search.trim());
      const { data } = await api.get(`/admin/students?${params}`);
      if (currentRequestId !== requestId.current) return;
      setStudents(data.data.students);
      setTotal(data.data.total);
      setPages(data.data.pages);
    } catch (err) {
      if (currentRequestId === requestId.current) {
        toast.error(err.response?.data?.message || 'Failed to load students');
      }
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    const hasFilter = session || semesterSession || year || branch || semester || section || search.trim();
    if (hasFilter) {
      setFilterApplied(true);
      load();
    } else {
      requestId.current += 1;
      setFilterApplied(false);
      setStudents([]);
      setTotal(0);
      setPages(1);
      setLoading(false);
    }
  }, [page, session, semesterSession, year, branch, semester, section, search]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/students/${deleteTarget._id}`);
      toast.success('Student deleted');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (session) params.set('session', session);
      if (semesterSession) params.set('semesterSession', semesterSession);
      if (year) params.set('year', year);
      if (branch) params.set('branch', branch);
      if (semester) params.set('semester', semester);
      if (section) params.set('section', section);

      const response = await api.get(`/admin/students/export?${params}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `students_export_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Excel file downloaded');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleBackfillHistory = async () => {
    setBackfilling(true);
    try {
      const { data } = await api.post('/admin/students/academic-history/backfill');
      toast.success(`${data.data.recordsCreated} academic history records created`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Academic history backfill failed');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div>
      {deleteTarget && (
        <DeleteModal
          name={`${deleteTarget.firstName} ${deleteTarget.lastName}`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Students</h1>
          <p className="text-slate-500 text-sm">{total} total enrolled</p>
        </div>
        <button onClick={handleBackfillHistory} disabled={backfilling} className="btn-secondary text-sm">
          {backfilling ? 'Syncing history...' : 'Sync Academic History'}
        </button>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search name, enrollment no. or email"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select className="input w-auto" value={session} onChange={e => handleSessionChange(e.target.value)}>
            <option value="">All Sessions</option>
            {SESSION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input w-auto" value={semesterSession} onChange={e => handleSemesterSessionChange(e.target.value)} disabled={!session}>
            <option value="">All Semester Sessions</option>
            {SEMESTER_SESSION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="input w-auto" value={year} onChange={e => handleYearChange(e.target.value)}>
            <option value="">All Years</option>
            {YEAR_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select className="input w-auto" value={branch} onChange={e => handleBranchChange(e.target.value)} disabled={!year}>
            <option value="">All Branches</option>
            {BRANCH_OPTIONS.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="input w-auto" value={semester} onChange={e => handleSemesterChange(e.target.value)} disabled={!year}>
            <option value="">All Semesters</option>
            {allowedSemesters.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input w-auto" value={section} onChange={e => handleSectionChange(e.target.value)} disabled={!year}>
            <option value="">All Sections</option>
            {allowedSections.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <button
            onClick={handleExportExcel}
            disabled={exporting || total === 0}
            className="btn-secondary flex items-center gap-2 py-2 px-4 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Enrollment No.', 'Name', 'Email', 'Branch', 'Sem', 'Term', 'Section', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!filterApplied ? (
                <tr><td colSpan={8} className="text-center py-14 text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">🔍</span>
                    <p className="font-medium text-slate-500">Select a filter above to view students</p>
                    <p className="text-xs text-slate-400">Choose a session, year, branch, semester, or section</p>
                  </div>
                </td></tr>
              ) : loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : students.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No students found</td></tr>
              ) : (
                students.map(s => (
                  <tr key={s._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{s.enrollmentNo}</td>
                    <td className="px-4 py-3 font-medium">{s.firstName} {s.lastName}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.email || '—'}</td>
                    <td className="px-4 py-3"><span className="badge-blue">{s.branch}</span></td>
                    <td className="px-4 py-3">{s.currentSemester}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {s.term === 'january-june' || (!s.term && Number(s.currentSemester) % 2 === 0)
                        ? 'Jan-Jun'
                        : s.term === 'july-december' || (!s.term && Number(s.currentSemester) % 2 === 1)
                          ? 'Jul-Dec'
                          : '—'}
                    </td>
                    <td className="px-4 py-3">{s.section || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link to={`/admin/students/${s._id}`} className="text-primary-600 hover:underline text-xs">View</Link>
                        <Link to={`/admin/students/${s._id}/edit`} className="text-slate-500 hover:text-slate-700" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => setDeleteTarget(s)} className="text-red-400 hover:text-red-600" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === pages} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
