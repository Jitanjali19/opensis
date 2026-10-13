import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import {
  BarChart3, CheckCircle2, Download, MessageSquare, PlayCircle, Search, Star, TrendingDown, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';

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

export default function AdminFeedback() {
  const [data, setData] = useState({ feedback: [], analytics: [], overview: {} });
  const [config, setConfig] = useState({ isOpen: true, startsAt: '', endsAt: '', requireCommentForLowRating: true });
  const [filters, setFilters] = useState(emptyFilters);
  const [filterOptions, setFilterOptions] = useState({ departments: [], semesters: [], sessions: [], subjects: [], faculties: [] });
  const [facultyRanking, setFacultyRanking] = useState('highest');
  const [facultySearch, setFacultySearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (nextFilters = filters) => {
    const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value));
    return Promise.all([
      api.get('/admin/feedback', { params }).then(({ data: response }) => {
        setData(response.data);
        if (response.data.filterOptions) setFilterOptions(response.data.filterOptions);
      }),
      api.get('/admin/feedback/config').then(({ data: response }) => {
        const next = response.data.config;
        setConfig({
          ...next,
          startsAt: next.startsAt ? new Date(next.startsAt).toISOString().slice(0, 16) : '',
          endsAt: next.endsAt ? new Date(next.endsAt).toISOString().slice(0, 16) : '',
        });
      }),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!filters.subjectId) return;
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    api.get('/admin/feedback', { params }).then(({ data: response }) => {
      if (response.data.filterOptions) {
        setFilterOptions(current => ({ ...current, faculties: response.data.filterOptions.faculties || [] }));
      }
    }).catch(() => {
      toast.error('Could not load faculty options for this subject');
    });
  }, [filters.subjectId, filters.session, filters.term, filters.semester]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/feedback/${id}/status`, { status });
      toast.success('Status updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };
  const saveConfig = async event => {
    event.preventDefault();
    try {
      await api.put('/admin/feedback/config', config);
      toast.success('Feedback settings saved');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Settings update failed');
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

  const overview = data.overview || {};
  const selectedYear = Number(filters.year);
  const filteredSemesters = filterOptions.semesters.filter(semester => !selectedYear || Math.ceil(Number(semester) / 2) === selectedYear);
  const filteredSubjects = filterOptions.subjects.filter(subject => (
    (!filters.department || subject.branch === filters.department)
    && (!selectedYear || Math.ceil(Number(subject.semester) / 2) === selectedYear)
    && (!filters.semester || Number(subject.semester) === Number(filters.semester))
  ));
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
  const seedDemoFeedback = async () => {
    try {
      const response = await api.post('/admin/feedback/seed-demo', { session: '2026-2027', term: 'july-december' });
      toast.success(response.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not seed demo feedback');
    }
  };

  return <div>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-slate-800">Feedback analytics</h1><p className="mt-1 text-sm text-slate-500">Review teaching quality by session, term, faculty and subject.</p></div>
      <div className="flex gap-2"><button type="button" className="btn-secondary text-xs" onClick={seedDemoFeedback}><PlayCircle className="h-4 w-4" /> Fill demo feedback</button><button type="button" className="btn-secondary text-xs" onClick={exportFeedback}><Download className="h-4 w-4" /> Export Excel</button></div>
    </div>
    {loading ? <div className="card">Loading feedback...</div> : <>
      <form onSubmit={saveConfig} className="card mb-6">
        <div className="mb-4"><h2 className="font-semibold text-slate-800">Feedback settings</h2><p className="mt-1 text-xs text-slate-500">Control availability and response guidelines.</p></div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={config.isOpen !== false} onChange={e => setConfig({ ...config, isOpen: e.target.checked })} /> Feedback open</label>
          <label className="text-xs text-slate-500">Starts at<input className="input mt-1" type="datetime-local" value={config.startsAt || ''} onChange={e => setConfig({ ...config, startsAt: e.target.value })} /></label>
          <label className="text-xs text-slate-500">Ends at<input className="input mt-1" type="datetime-local" value={config.endsAt || ''} onChange={e => setConfig({ ...config, endsAt: e.target.value })} /></label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={config.requireCommentForLowRating !== false} onChange={e => setConfig({ ...config, requireCommentForLowRating: e.target.checked })} /> Require a constructive comment for ratings of 1 or 2</label>
        <button className="btn-primary mt-4 text-xs" type="submit">Save settings</button>
      </form>
      <form onSubmit={event => { event.preventDefault(); load(filters); }} className="card mb-6">
        <div className="mb-4"><h2 className="font-semibold text-slate-800">Analytics scope</h2><p className="mt-1 text-xs text-slate-500">Choose a complete academic context for meaningful comparisons.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select className="input" required value={filters.department} onChange={e => setFilter('department', e.target.value, { year: '', session: '', term: '', semester: '', subjectId: '', facultyId: '' })}><option value="">Choose department</option>{filterOptions.departments.map(item => <option key={item}>{item}</option>)}</select>
          <select className="input" required disabled={!filters.department} value={filters.year} onChange={e => setFilter('year', e.target.value, { session: '', term: '', semester: '', subjectId: '', facultyId: '' })}><option value="">Choose year</option>{[1, 2, 3, 4].map(item => <option key={item} value={item}>{yearLabel(item)}</option>)}</select>
          <select className="input" required disabled={!filters.year} value={filters.session} onChange={e => setFilter('session', e.target.value, { term: '', semester: '', subjectId: '', facultyId: '' })}><option value="">Choose session</option>{filterOptions.sessions.map(item => <option key={item}>{item}</option>)}</select>
          <select className="input" disabled={!filters.session} value={filters.term} onChange={e => setFilter('term', e.target.value, { semester: '', subjectId: '', facultyId: '' })}><option value="">All terms</option><option value="july-december">Jul-Dec</option><option value="january-june">Jan-Jun</option></select>
          <select className="input" required disabled={!filters.session} value={filters.semester} onChange={e => setFilter('semester', e.target.value, { subjectId: '', facultyId: '' })}><option value="">Choose semester</option>{filteredSemesters.map(item => <option key={item} value={item}>Semester {item}</option>)}</select>
          <select className="input" required disabled={!filters.semester} value={filters.subjectId} onChange={e => setFilter('subjectId', e.target.value, { facultyId: '' })}><option value="">Choose subject</option>{filteredSubjects.map(item => <option key={item._id} value={item._id}>{item.code} — {item.name}</option>)}</select>
          <select className="input" required disabled={!filters.subjectId || !filteredFaculties.length} value={filters.facultyId} onChange={e => setFilter('facultyId', e.target.value)}><option value="">{filters.subjectId ? (filteredFaculties.length ? 'Choose faculty for this subject' : 'No faculty assigned to this subject') : 'Choose subject first'}</option>{filteredFaculties.map(item => <option key={item._id} value={item._id}>{item.firstName} {item.lastName}</option>)}</select>
        </div>
        <div className="mt-4 flex gap-2"><button className="btn-primary text-xs" type="submit">Apply scope</button><button className="btn-secondary text-xs" type="button" onClick={clearFilters}>Clear</button></div>
      </form>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [MessageSquare, 'Total responses', overview.totalResponses || 0],
          [Star, 'Overall average', `${overview.overallAverage || 0}/5`],
          [Users, 'With comments', `${overview.commentsCount || 0} (${overview.commentRate || 0}%)`],
          [CheckCircle2, 'Closed / actioned', (overview.statusCounts?.closed || 0) + (overview.statusCounts?.action_taken || 0)],
        ].map(([Icon, label, value]) => <div className="card" key={label}><Icon className="mb-3 h-5 w-5 text-primary-600" /><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-800">{value}</p></div>)}
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="card"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold text-slate-800"><BarChart3 className="h-5 w-5 text-primary-600" /> How students rated teaching</h2><p className="mt-1 text-xs text-slate-500">Each bar is the average score from all responses for one teaching criterion.</p></div><div className="rounded-lg bg-primary-50 px-4 py-2 text-right"><p className="text-xs text-primary-700">Overall rating</p><p className="text-xl font-bold text-primary-800">{overview.overallAverage || 0} / 5</p></div></div>{criteria.map(([key, label]) => <div className="mb-3" key={key}><div className="mb-1 flex justify-between text-xs"><span>{label}</span><strong>{overview.criterionAverages?.[key] || 0} / 5</strong></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-primary-600" style={{ width: `${((overview.criterionAverages?.[key] || 0) / 5) * 100}%` }} /></div></div>)}</div>
        <div className="card"><h2 className="mb-1 font-semibold text-slate-800">Rating breakdown</h2><p className="mb-4 text-xs text-slate-500">Number of individual criterion ratings at each level.</p>{[5, 4, 3, 2, 1].map(rating => <div className="mb-3 flex items-center gap-3 text-sm" key={rating}><span className="w-14">{rating} / 5</span><div className="h-3 flex-1 rounded-full bg-slate-100"><div className={`h-3 rounded-full ${rating <= 2 ? 'bg-rose-500' : rating === 3 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${overview.totalResponses ? ((overview.ratingDistribution?.[rating] || 0) / (overview.totalResponses * 6)) * 100 : 0}%` }} /></div><span className="w-16 text-right text-xs text-slate-500">{overview.ratingDistribution?.[rating] || 0} ratings</span></div>)}</div>
      </div>
      <div className="card mb-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-800">Faculty ranking</h2><p className="mt-1 text-xs text-slate-500">Overall faculty score across the selected subjects.</p></div><div className="flex flex-wrap gap-2"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="input pl-9 text-xs" placeholder="Search faculty name" value={facultySearch} onChange={e => setFacultySearch(e.target.value)} /></label><select className="input w-auto text-xs" value={facultyRanking} onChange={e => setFacultyRanking(e.target.value)}><option value="highest">Highest rated first</option><option value="lowest">Lowest rated first</option></select></div></div>{facultySummary.length === 0 ? <p className="text-sm text-slate-500">No faculty ratings match your search.</p> : <div className="space-y-2">{facultySummary.map((item, index) => <div className={`flex items-center justify-between rounded-lg p-3 ${index === 0 ? 'bg-primary-50' : 'bg-slate-50'}`} key={item.faculty?._id}><div><p className="font-medium text-slate-800">{item.faculty?.firstName} {item.faculty?.lastName}</p><p className="text-xs text-slate-500">{item.count} response(s)</p></div><p className={`font-semibold ${item.average <= 2.5 ? 'text-rose-700' : 'text-primary-700'}`}>{item.average}/5</p></div>)}</div>}</div>
      <div className="card mb-6"><h2 className="mb-4 font-semibold text-slate-800">Faculty and subject performance</h2>{data.analytics.length === 0 ? <p className="text-sm text-slate-500">No feedback available for this scope.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-2">Subject</th><th>Faculty</th><th>Responses</th>{criteria.map(([, label]) => <th key={label}>{label}</th>)}<th>Overall</th></tr></thead><tbody>{data.analytics.map(item => <tr className={`border-b last:border-0 ${item.average <= 2.5 ? 'bg-rose-50' : ''}`} key={`${item.subject?._id}:${item.faculty?._id}`}><td className="py-3 font-medium">{item.subject?.code} — {item.subject?.name}</td><td>{item.faculty?.firstName} {item.faculty?.lastName}</td><td>{item.count}</td>{criteria.map(([key]) => <td key={key}>{item[key]}/5</td>)}<td className="font-semibold">{item.average}/5</td></tr>)}</tbody></table></div>}</div>
      {lowRatedAnalytics.length > 0 && <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/70 p-5"><h2 className="flex items-center gap-2 font-semibold text-rose-800"><TrendingDown className="h-5 w-5" /> Needs attention ({lowRatedAnalytics.length})</h2><p className="mt-1 text-xs text-rose-700">Only subjects with an overall average of 2.5/5 or lower are shown.</p>{lowRatedAnalytics.slice(0, 10).map(item => <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-white p-3" key={`${item.subject?._id}:${item.faculty?._id}`}><div><p className="font-medium">{item.subject?.code} — {item.subject?.name}</p><p className="text-xs text-slate-500">{item.faculty?.firstName} {item.faculty?.lastName} · {item.count} response(s)</p></div><p className="font-semibold text-rose-700">{item.average}/5</p></div>)}</div>}
      <div className="space-y-3"><h2 className="font-semibold text-slate-800">Recent responses</h2>{data.feedback.filter(item => !facultySearch.trim() || `${item.facultyId?.firstName || ''} ${item.facultyId?.lastName || ''}`.toLowerCase().includes(facultySearch.trim().toLowerCase())).map(item => <div className="card" key={item._id}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-medium">{item.subjectId?.code} — {item.subjectId?.name}</p><p className="text-xs text-slate-500">{item.facultyId?.firstName} {item.facultyId?.lastName} · {termLabel(item.term)} · {item.session}</p><p className="mt-1 text-xs text-slate-500">{ratingText(item)}</p>{item.comments && <p className="mt-2 text-sm text-slate-600">{item.comments}</p>}</div><select className="input w-auto text-xs" value={item.status} onChange={e => updateStatus(item._id, e.target.value)}><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="action_taken">Action taken</option><option value="closed">Closed</option></select></div></div>)}</div>
      {data.feedback.length === 0 && <div className="card py-12 text-center"><MessageSquare className="mx-auto mb-3 h-12 w-12 text-slate-300" /><p className="text-slate-500">No feedback submitted for this scope.</p></div>}
    </>}
  </div>;
}
