import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { CheckCircle2, FileText, Search, Trash2, XCircle } from 'lucide-react';
import academicConfig from '../../../../shared/academicConfig.json';
import { useAuth } from '../../context/AuthContext';

const currentSession = () => {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
};

const currentTerm = () => (new Date().getMonth() >= 6 ? 'july-december' : 'january-june');

const SEMESTERS_BY_TERM = {
  'july-december': [1, 3, 5, 7],
  'january-june': [2, 4, 6, 8],
};

export default function AdminAdmitCards() {
  const { selectedSession, selectedTerm } = useAuth();
  const [filters, setFilters] = useState({
    session: selectedSession || currentSession(),
    term: selectedTerm || currentTerm(),
    branch: '',
    semester: '',
    section: '',
  });
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!selectedSession) return;
    setFilters(prev => ({ ...prev, session: selectedSession, term: selectedTerm || prev.term }));
    setStudents([]);
    setLoaded(false);
  }, [selectedSession, selectedTerm]);

  const set = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setStudents([]);
    setLoaded(false);
  };

  const semesterOptions = SEMESTERS_BY_TERM[filters.term] || [];
  const sections = filters.semester
    ? academicConfig.SECTIONS_BY_YEAR[String(Math.ceil(Number(filters.semester) / 2))] || []
    : [];

  const loadStudents = async () => {
    if (!filters.session) {
      toast.error('Select a session');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/admin/admit-cards/eligible', { params: filters });
      setStudents(data.data.students || []);
      setLoaded(true);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const generateAll = async () => {
    if (students.length === 0) {
      toast.error('No students found');
      return;
    }
    setGenerating(true);
    try {
      const { data } = await api.post('/admin/admit-cards/generate', {
        ...filters,
        studentIds: students.map(student => student._id),
      });
      const skipped = data.data.skipped?.length || 0;
      toast.success(`${data.data.generated} admit card(s) generated${skipped ? `, ${skipped} skipped` : ''}`);
      if (skipped) {
        data.data.skipped.forEach(item => toast.error(`${item.name}: ${item.reason}`));
      }
      await loadStudents();
    } finally {
      setGenerating(false);
    }
  };

  const deleteAll = async () => {
    if (!window.confirm('Delete all generated admit cards for the selected class? Students will no longer be able to view them.')) {
      return;
    }
    setDeleting(true);
    try {
      const { data } = await api.delete('/admin/admit-cards', { params: filters });
      toast.success(`${data.data.deleted} admit card(s) deleted`);
      await loadStudents();
    } finally {
      setDeleting(false);
    }
  };

  const issuedCount = students.filter(student => student.issued).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Admit Cards</h1>
        <p className="text-slate-500 text-sm">
          Select the class and generate end semester admit cards for all students. Generated cards are available to students.
        </p>
      </div>

      <div className="card mb-6">
        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-36">
            <label className="label">Academic Session *</label>
            <select className="input" value={filters.session} onChange={e => set('session', e.target.value)}>
              {academicConfig.ACADEMIC_YEARS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-36">
            <label className="label">Term *</label>
            <select className="input" value={filters.term} onChange={e => { set('term', e.target.value); set('semester', ''); set('section', ''); }}>
              <option value="july-december">July-December</option>
              <option value="january-june">January-June</option>
            </select>
          </div>
          <div className="flex-1 min-w-32">
            <label className="label">Department</label>
            <select className="input" value={filters.branch} onChange={e => set('branch', e.target.value)}>
              <option value="">All Departments</option>
              {academicConfig.DEPARTMENTS.map(department => (
                <option key={department} value={department}>{academicConfig.DEPARTMENT_LABELS[department] || department}</option>
              ))}
            </select>
          </div>
          <div className="w-36">
            <label className="label">Semester</label>
            <select className="input" value={filters.semester} onChange={e => { set('semester', e.target.value); set('section', ''); }}>
              <option value="">All Semesters</option>
              {semesterOptions.map(semester => <option key={semester} value={semester}>{semester}</option>)}
            </select>
          </div>
          <div className="w-32">
            <label className="label">Section</label>
            <select className="input" value={filters.section} onChange={e => set('section', e.target.value)}>
              <option value="">All</option>
              {sections.map(section => <option key={section} value={section}>{section}</option>)}
            </select>
          </div>
          <button onClick={loadStudents} disabled={loading} className="btn-primary">
            <Search className="w-4 h-4" /> {loading ? 'Loading...' : 'Load Students'}
          </button>
        </div>
      </div>

      {loaded && (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-slate-700">Students</h2>
              <p className="text-sm text-slate-500">{students.length} students · {issuedCount} admit card(s) generated</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={deleteAll}
                disabled={deleting || issuedCount === 0}
                className="btn-secondary text-rose-600"
              >
                <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting...' : 'Delete All'}
              </button>
              <button
                onClick={generateAll}
                disabled={generating || students.length === 0}
                className="btn-primary"
              >
                <FileText className="w-4 h-4" /> {generating ? 'Generating...' : 'Generate All'}
              </button>
            </div>
          </div>

          <div className="card overflow-x-auto mb-6">
            {students.length === 0 ? (
              <p className="text-center py-8 text-slate-400">No students found for this selection</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-3 pr-3 font-medium">Enrollment No</th>
                    <th className="py-3 pr-3 font-medium">Name</th>
                    <th className="py-3 pr-3 font-medium">Section</th>
                    <th className="py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr key={student._id} className="border-b border-slate-50">
                      <td className="py-3 pr-3 font-mono text-xs text-slate-600">{student.enrollmentNo}</td>
                      <td className="py-3 pr-3 font-medium text-slate-800">{student.name}</td>
                      <td className="py-3 pr-3 text-slate-600">{student.sectionName || '—'}</td>
                      <td className="py-3">
                        {student.issued ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                            <CheckCircle2 className="w-4 h-4" /> Generated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                            <XCircle className="w-4 h-4" /> Not generated
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
