import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart3, CheckCircle2, Download, MessageSquare, PlayCircle, Search, Star, TrendingDown, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import academicConfig from '../../../../shared/academicConfig.json';

const DEPARTMENTS = academicConfig.DEPARTMENTS;
const DEPT_LABELS = academicConfig.DEPARTMENT_LABELS || {};

const emptyFilters = {
  department: '', year: '', session: '', term: '', semester: '', subjectId: '', facultyId: '',
};
const criteria = [
  ['knowledge', 'Subject knowledge'],
  ['clarity', 'Clarity'],
  ['punctuality', 'Punctuality'],
  ['interaction', 'Interaction'],
  ['doubtSolving', 'Doubt solving'],
  ['fairness', 'Fairness'],
];
const termLabel = value => value === 'july-december' ? 'Jul-Dec' : value === 'january-june' ? 'Jan-Jun' : value;
const yearLabel = year => ({ 1: 'First Year', 2: 'Second Year', 3: 'Third Year', 4: 'Final Year' }[year] || `Year ${year}`);
const termParity = term => term === 'july-december' ? 1 : term === 'january-june' ? 0 : null;

export default function AdminFeedback() {
  const { sessions, selectedSession } = useAuth();
  const [data, setData] = useState({ feedback: [], analytics: [], overview: {} });
  const [config, setConfig] = useState({ isOpen: true, startsAt: '', endsAt: '', requireCommentForLowRating: true });
  const [configScope, setConfigScope] = useState({ session: selectedSession || '', term: 'july-december' });
  const [filters, setFilters] = useState(emptyFilters);
  const [filterOptions, setFilterOptions] = useState({ departments: [], semesters: [], sessions: [], subjects: [], faculties: [] });
  const [facultyRanking, setFacultyRanking] = useState('highest');
  const [facultySearch, setFacultySearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const loadConfig = (session, term) => api.get('/admin/feedback/config', { params: { session, term } })
    .then(({ data: response }) => {
      const next = response.data.config || {};
      setConfig({
        ...next,
        startsAt: next.startsAt ? new Date(next.startsAt).toISOString().slice(0, 16) : '',
        endsAt: next.endsAt ? new Date(next.endsAt).toISOString().slice(0, 16) : '',
      });
    })
    .catch(() => {});

  const load = (nextFilters = filters) => {
    const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value));
    return api.get('/admin/feedback', { params }).then(({ data: response }) => {
      setData(response.data);
      if (response.data.filterOptions) setFilterOptions(response.data.filterOptions);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!configScope.session && selectedSession) {
      setConfigScope(current => ({ ...current, session: selectedSession }));
      return;
    }
    if (configScope.session && configScope.term) loadConfig(configScope.session, configScope.term);
  }, [configScope.session, configScope.term, selectedSession]);
  useEffect(() => {
    if (!filters.subjectId) return;
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    api.get('/admin/feedback', { params }).then(({ data: response }) => {
      if (response.data.filterOptions) {
        setFilterOptions(current => ({ ...current, faculties: response.data.filterOptions.faculties || [] }));
      }
    }).catch(() => {});
  }, [filters.subjectId, filters.session, filters.term, filters.semester]);

  const saveConfig = async event => {
    event.preventDefault();
    if (!configScope.session) return toast.error('Select a session first');
    setSavingConfig(true);
    try {
      await api.put('/admin/feedback/config', { ...config, session: configScope.session, term: configScope.term });
      toast.success('Feedback settings saved');
      loadConfig(configScope.session, configScope.term);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Settings update failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/feedback/${id}/status`, { status });
      toast.success('Status updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const exportFeedback = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const response = await api.get('/admin/feedback/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'feedback-report.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not export feedback');
    }
  };

  const seedDemoFeedback = async () => {
    try {
      const response = await api.post('/admin/feedback/seed-demo', { session: '2026-2027', term: 'july-december' });
      toast.success(response.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not seed demo feedback');
    }
  };

  const overview = data.overview || {};
  const sessionOptions = [...new Set([...(sessions || []), ...(filterOptions.sessions || [])].filter(Boolean))].sort().reverse();
  const selectedYear = Number(filters.year);
  const selectedTermParity = termParity(filters.term);
  const filteredSemesters = filterOptions.semesters.filter(semester => {
    const sem = Number(semester);
    if (selectedYear && Math.ceil(sem / 2) !== selectedYear) return false;
    if (selectedTermParity !== null && sem % 2 !== selectedTermParity) return false;
    return true;
  });
  const filteredSubjects = filterOptions.subjects.filter(subject => {
    const sem = Number(subject.semester);
    if (filters.department && subject.branch !== filters.department) return false;
    if (selectedYear && Math.ceil(sem / 2) !== selectedYear) return false;
    if (selectedTermParity !== null && sem % 2 !== selectedTermParity) return false;
    if (filters.semester && sem !== Number(filters.semester)) return false;
    return true;
  });
  const filteredFaculties = filters.subjectId ? filterOptions.faculties : [];
  const searchedAnalytics = data.analytics.filter(item => `${item.faculty?.firstName || ''} ${item.faculty?.lastName || ''}`.toLowerCase().includes(facultySearch.trim().toLowerCase()));
  const lowRatedAnalytics = searchedAnalytics.filter(item => item.average <= 2.5).sort((a, b) => a.average - b.average);
  const facultySummary = Object.values(searchedAnalytics.reduce((result, item) => {
    const key = String(item.faculty?._id || item.faculty);
    if (!result[key]) result[key] = { faculty: item.faculty, total: 0, count: 0 };
    result[key].total += Number(item.average) * Number(item.count);
    result[key].count += Number(item.count);
    return result;
  }, {})).map(item => ({ ...item, average: item.count ? Number((item.total / item.count).toFixed(2)) : 0 }))
    .sort((a, b) => facultyRanking === 'highest' ? b.average - a.average : a.average - b.average);
  const ratingText = item => criteria.map(([key, label]) => `${label} ${item.ratings?.[key] || '-'}/5`).join(' · ');
  const setFilter = (key, value, reset = {}) => setFilters(current => ({ ...current, ...reset, [key]: value }));
  const clearFilters = () => { setFilters(emptyFilters); load(emptyFilters); };
  const subjectCode = filters.subjectId ? filterOptions.subjects.find(item => item._id === filters.subjectId)?.code : '';
  const facultyName = filters.facultyId ? `${filterOptions.faculties.find(item => item._id === filters.facultyId)?.firstName || ''} ${filterOptions.faculties.find(item => item._id === filters.facultyId)?.lastName || ''}`.trim() : '';
  const activeScope = [
    filters.department,
    filters.year ? yearLabel(Number(filters.year)) : '',
    filters.session,
    termLabel(filters.term),
    filters.semester ? `Sem ${filters.semester}` : '',
    subjectCode,
    facultyName,
  ].filter(Boolean);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Feedback analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Review teaching quality by session, term, faculty and subject.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-xs" onClick={seedDemoFeedback}><PlayCircle className="h-4 w-4" /> Fill demo feedback</button>
        <button type="button" className="btn-secondary text-xs" onClick={exportFeedback}><Download className="h-4 w-4" /> Export Excel</button>
      </div>
    </div>

    {loading ? <div className="card">Loading feedback...</div> : <>
      <form onSubmit={saveConfig} className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-800">Feedback window</h2>
            <p className="mt-1 text-xs text-slate-500">Open or close the form for a specific session and term.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${config.isOpen !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {config.isOpen !== false ? 'Open' : 'Closed'}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="label">Session
            <select className="input mt-1" value={configScope.session} onChange={e => setConfigScope({ ...configScope, session: e.target.value })}>
              <option value="">Choose session</option>
              {sessions.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="label">Term
            <select className="input mt-1" value={configScope.term} onChange={e => setConfigScope({ ...configScope, term: e.target.value })}>
              <option value="july-december">Jul-Dec</option>
              <option value="january-june">Jan-Jun</option>
            </select>
          </label>
          <label className="label">Starts at
            <input className="input mt-1" type="datetime-local" value={config.startsAt || ''} onChange={e => setConfig({ ...config, startsAt: e.target.value })} />
          </label>
          <label className="label">Ends at
            <input className="input mt-1" type="datetime-local" value={config.endsAt || ''} onChange={e => setConfig({ ...config, endsAt: e.target.value })} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={config.isOpen !== false} onChange={e => setConfig({ ...config, isOpen: e.target.checked })} /> Feedback open</label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={config.requireCommentForLowRating !== false} onChange={e => setConfig({ ...config, requireCommentForLowRating: e.target.checked })} /> Require comment for ratings 1–2</label>
          </div>
          <button className="btn-primary text-xs" type="submit" disabled={savingConfig}>{savingConfig ? 'Saving...' : 'Save settings'}</button>
        </div>
      </form>

      <form onSubmit={event => { event.preventDefault(); load(filters); }} className="card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-800">Analytics scope</h2>
            <p className="mt-1 text-xs text-slate-500">Choose a complete academic context for meaningful comparisons.</p>
            {activeScope.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{activeScope.map(item => <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{item}</span>)}</div>}
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-xs" type="submit">Apply</button>
            <button className="btn-secondary text-xs" type="button" onClick={clearFilters}>Clear</button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="label">Department
            <select className="input mt-1" value={filters.department} onChange={e => setFilter('department', e.target.value, { year: '', session: '', term: '', semester: '', subjectId: '', facultyId: '' })}>
              <option value="">All departments</option>
              {DEPARTMENTS.map(item => <option key={item} value={item}>{item} – {DEPT_LABELS[item] || item}</option>)}
            </select>
          </label>
          <label className="label">Year
            <select className="input mt-1" disabled={!filters.department} value={filters.year} onChange={e => setFilter('year', e.target.value, { session: '', term: '', semester: '', subjectId: '', facultyId: '' })}>
              <option value="">All years</option>
              {[1, 2, 3, 4].map(item => <option key={item} value={item}>{yearLabel(item)}</option>)}
            </select>
          </label>
          <label className="label">Session
            <select className="input mt-1" value={filters.session} onChange={e => setFilter('session', e.target.value, { term: '', semester: '', subjectId: '', facultyId: '' })}>
              <option value="">All sessions</option>
              {sessionOptions.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="label">Term
            <select className="input mt-1" value={filters.term} onChange={e => setFilter('term', e.target.value, { semester: '', subjectId: '', facultyId: '' })}>
              <option value="">All terms</option>
              <option value="july-december">Jul-Dec</option>
              <option value="january-june">Jan-Jun</option>
            </select>
          </label>
          <label className="label">Semester
            <select className="input mt-1" disabled={!filters.year && !filters.term} value={filters.semester} onChange={e => setFilter('semester', e.target.value, { subjectId: '', facultyId: '' })}>
              <option value="">All semesters</option>
              {filteredSemesters.map(item => <option key={item} value={item}>Semester {item}</option>)}
            </select>
          </label>
          <label className="label">Subject
            <select className="input mt-1" disabled={!filters.semester && !filters.department} value={filters.subjectId} onChange={e => setFilter('subjectId', e.target.value, { facultyId: '' })}>
              <option value="">All subjects</option>
              {filteredSubjects.map(item => <option key={item._id} value={item._id}>{item.code} — {item.name}</option>)}
            </select>
          </label>
          <label className="label">Faculty
            <select className="input mt-1" disabled={!filters.subjectId || !filteredFaculties.length} value={filters.facultyId} onChange={e => setFilter('facultyId', e.target.value)}>
              <option value="">{filters.subjectId ? (filteredFaculties.length ? 'All faculty' : 'No faculty assigned') : 'Select a subject first'}</option>
              {filteredFaculties.map(item => <option key={item._id} value={item._id}>{item.firstName} {item.lastName}</option>)}
            </select>
          </label>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [MessageSquare, 'Total responses', overview.totalResponses || 0, 'text-primary-600'],
          [Star, 'Overall average', `${overview.overallAverage || 0}/5`, 'text-amber-500'],
          [Users, 'With comments', `${overview.commentsCount || 0} (${overview.commentRate || 0}%)`, 'text-sky-600'],
          [CheckCircle2, 'Closed / actioned', (overview.statusCounts?.closed || 0) + (overview.statusCounts?.action_taken || 0), 'text-emerald-600'],
        ].map(([Icon, label, value, tone]) => <div className="card" key={label}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <Icon className={`h-5 w-5 ${tone}`} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
        </div>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-800"><BarChart3 className="h-5 w-5 text-primary-600" /> How students rated teaching</h2>
              <p className="mt-1 text-xs text-slate-500">Average score per criterion across all responses.</p>
            </div>
            <div className="rounded-lg bg-primary-50 px-4 py-2 text-right">
              <p className="text-xs text-primary-700">Overall</p>
              <p className="text-xl font-bold text-primary-800">{overview.overallAverage || 0} / 5</p>
            </div>
          </div>
          {criteria.map(([key, label]) => <div className="mb-3" key={key}>
            <div className="mb-1 flex justify-between text-xs"><span>{label}</span><strong>{overview.criterionAverages?.[key] || 0} / 5</strong></div>
            <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-primary-600" style={{ width: `${((overview.criterionAverages?.[key] || 0) / 5) * 100}%` }} /></div>
          </div>)}
        </div>
        <div className="card">
          <h2 className="mb-1 font-semibold text-slate-800">Rating breakdown</h2>
          <p className="mb-4 text-xs text-slate-500">Number of individual criterion ratings at each level.</p>
          {[5, 4, 3, 2, 1].map(rating => <div className="mb-3 flex items-center gap-3 text-sm" key={rating}>
            <span className="w-12 text-slate-600">{rating} / 5</span>
            <div className="h-3 flex-1 rounded-full bg-slate-100"><div className={`h-3 rounded-full ${rating <= 2 ? 'bg-rose-500' : rating === 3 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${overview.totalResponses ? ((overview.ratingDistribution?.[rating] || 0) / (overview.totalResponses * 6)) * 100 : 0}%` }} /></div>
            <span className="w-20 text-right text-xs text-slate-500">{overview.ratingDistribution?.[rating] || 0} ratings</span>
          </div>)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-800">Faculty ranking</h2>
              <p className="mt-1 text-xs text-slate-500">Overall faculty score across the selected subjects.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input className="input pl-9 text-xs" placeholder="Search faculty" value={facultySearch} onChange={e => setFacultySearch(e.target.value)} />
              </label>
              <select className="input w-auto text-xs" value={facultyRanking} onChange={e => setFacultyRanking(e.target.value)}>
                <option value="highest">Highest first</option>
                <option value="lowest">Lowest first</option>
              </select>
            </div>
          </div>
          {facultySummary.length === 0 ? <p className="text-sm text-slate-500">No faculty ratings match your search.</p> : <div className="space-y-2">
            {facultySummary.map((item, index) => <div className={`flex items-center justify-between rounded-lg p-3 ${index === 0 ? 'bg-primary-50' : 'bg-slate-50'}`} key={item.faculty?._id || item.faculty || index}>
              <div>
                <p className="font-medium text-slate-800">{item.faculty?.firstName} {item.faculty?.lastName}</p>
                <p className="text-xs text-slate-500">{item.count} response(s)</p>
              </div>
              <p className={`font-semibold ${item.average <= 2.5 ? 'text-rose-700' : 'text-primary-700'}`}>{item.average}/5</p>
            </div>)}
          </div>}
        </div>
        <div className="card">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800"><TrendingDown className="h-5 w-5 text-rose-600" /> Needs attention</h2>
          <p className="mt-1 text-xs text-slate-500">Subjects with an overall average of 2.5/5 or lower.</p>
          {lowRatedAnalytics.length === 0 ? <p className="mt-4 text-sm text-slate-500">No low-rated subjects in this scope.</p> : <div className="mt-4 space-y-2">
            {lowRatedAnalytics.slice(0, 10).map(item => <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50/60 p-3" key={`${item.subject?._id}:${item.faculty?._id}`}>
              <div>
                <p className="font-medium text-slate-800">{item.subject?.code} — {item.subject?.name}</p>
                <p className="text-xs text-slate-500">{item.faculty?.firstName} {item.faculty?.lastName} · {item.count} response(s)</p>
              </div>
              <p className="font-semibold text-rose-700">{item.average}/5</p>
            </div>)}
          </div>}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold text-slate-800">Faculty and subject performance</h2>
        {data.analytics.length === 0 ? <p className="text-sm text-slate-500">No feedback available for this scope.</p> : <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-slate-500">
                <th className="py-2">Subject</th><th>Faculty</th><th>Responses</th>
                {criteria.map(([, label]) => <th key={label}>{label}</th>)}
                <th>Overall</th>
              </tr>
            </thead>
            <tbody>
              {data.analytics.map(item => <tr className={`border-b last:border-0 ${item.average <= 2.5 ? 'bg-rose-50' : ''}`} key={`${item.subject?._id}:${item.faculty?._id}`}>
                <td className="py-3 font-medium">{item.subject?.code} — {item.subject?.name}</td>
                <td>{item.faculty?.firstName} {item.faculty?.lastName}</td>
                <td>{item.count}</td>
                {criteria.map(([key]) => <td key={key}>{item[key]}/5</td>)}
                <td className="font-semibold">{item.average}/5</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold text-slate-800">Recent responses</h2>
        {data.feedback.length === 0 ? <div className="py-10 text-center">
          <MessageSquare className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">No feedback submitted for this scope.</p>
        </div> : <div className="space-y-3">
          {data.feedback
            .filter(item => !facultySearch.trim() || `${item.facultyId?.firstName || ''} ${item.facultyId?.lastName || ''}`.toLowerCase().includes(facultySearch.trim().toLowerCase()))
            .map(item => <div className="rounded-xl border border-slate-200 p-4" key={item._id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-800">{item.subjectId?.code} — {item.subjectId?.name}</p>
                  <p className="text-xs text-slate-500">{item.facultyId?.firstName} {item.facultyId?.lastName} · {termLabel(item.term)} · {item.session}</p>
                  <p className="mt-1 text-xs text-slate-500">{ratingText(item)}</p>
                  {item.comments && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm italic text-slate-600">“{item.comments}”</p>}
                </div>
                <select className="input w-auto text-xs" value={item.status} onChange={e => updateStatus(item._id, e.target.value)}>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under review</option>
                  <option value="action_taken">Action taken</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>)}
        </div>}
      </div>
    </>}
  </div>;
}
