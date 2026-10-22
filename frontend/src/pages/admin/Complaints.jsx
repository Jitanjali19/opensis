import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  HelpCircle,
  MessageSquare,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'subject', label: 'Subject / Academic Issue' },
  { value: 'class_discipline', label: 'Class Discipline' },
  { value: 'student', label: 'Complaint Against a Student' },
  { value: 'faculty', label: 'Complaint Against a Faculty Member' },
  { value: 'college', label: 'Campus / Infrastructure' },
  { value: 'administration', label: 'Administration' },
  { value: 'website', label: 'Website / ERP' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Clock,
  },
  in_review: {
    label: 'In Review',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: HelpCircle,
  },
  resolved: {
    label: 'Resolved',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: XCircle,
  },
};

const emptyFilters = {
  category: '',
  status: '',
  faculty: '',
  assignedTo: '',
  from: '',
  to: '',
  search: '',
  page: 1,
};

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [handlers, setHandlers] = useState([]);
  const [summary, setSummary] = useState({
    overview: { total: 0, pending: 0, inReview: 0, resolved: 0, rejected: 0, adminQueueCount: 0, facultyAssignedCount: 0 },
    categoryCounts: {},
    facultyCounts: [],
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Selected complaint for modal
  const [activeComplaint, setActiveComplaint] = useState(null);
  const [modalForm, setModalForm] = useState({
    status: 'pending',
    adminResponse: '',
    assignedTo: '',
    assignmentReason: '',
  });

  const loadData = async (filterParams = filters) => {
    try {
      setLoading(true);
      const params = {};
      if (filterParams.category) params.category = filterParams.category;
      if (filterParams.status) params.status = filterParams.status;
      if (filterParams.faculty) params.faculty = filterParams.faculty;
      if (filterParams.assignedTo) params.assignedTo = filterParams.assignedTo;
      if (filterParams.from) params.from = filterParams.from;
      if (filterParams.to) params.to = filterParams.to;
      if (filterParams.search) params.search = filterParams.search;
      params.page = filterParams.page || 1;
      params.limit = 10;

      const [complaintsRes, summaryRes, handlersRes] = await Promise.all([
        api.get('/admin/complaints', { params }),
        api.get('/admin/complaints/summary'),
        api.get('/admin/complaints/faculty-handlers').catch(() => ({ data: { data: { handlers: [] } } })),
      ]);

      setComplaints(complaintsRes.data?.data?.complaints || []);
      setPagination(complaintsRes.data?.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      setSummary(summaryRes.data?.data || {
        overview: { total: 0, pending: 0, inReview: 0, resolved: 0, rejected: 0, adminQueueCount: 0, facultyAssignedCount: 0 },
        categoryCounts: {},
        facultyCounts: [],
      });
      setHandlers(handlersRes.data?.data?.handlers || []);
    } catch (err) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(filters);
  }, [filters.page, filters.category, filters.status, filters.faculty, filters.assignedTo, filters.from, filters.to]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, page: 1 }));
    loadData({ ...filters, page: 1 });
  };

  const handleResetFilters = () => {
    setFilters(emptyFilters);
    loadData(emptyFilters);
  };

  const openModal = (complaint) => {
    setActiveComplaint(complaint);
    setModalForm({
      status: complaint.status || 'pending',
      adminResponse: complaint.adminResponse || '',
      assignedTo: complaint.assignedTo ? complaint.assignedTo.toString() : 'admin',
      assignmentReason: complaint.assignmentReason || '',
    });
  };

  const closeModal = () => {
    setActiveComplaint(null);
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!activeComplaint) return;

    setUpdating(true);
    try {
      const payload = {
        status: modalForm.status,
        adminResponse: modalForm.adminResponse,
        assignedTo: modalForm.assignedTo === 'admin' ? null : modalForm.assignedTo,
        assignmentReason: modalForm.assignmentReason,
      };

      const { data } = await api.patch(`/admin/complaints/${activeComplaint._id}`, payload);
      toast.success(data.message || 'Complaint updated successfully');

      const updatedItem = data?.data?.complaint;
      if (updatedItem) {
        setComplaints(prev => prev.map(c => (c._id === updatedItem._id ? { ...c, ...updatedItem } : c)));
      }

      closeModal();
      const sumRes = await api.get('/admin/complaints/summary');
      setSummary(sumRes.data?.data || summary);
    } catch (err) {
      // Axios toast handler
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-7 pb-16">
      {/* Hero Header */}
      <div className="overflow-hidden rounded-2xl bg-[#151923] p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-sgsits-gold-400">
                Institutional Oversight & Routing
              </p>
              <h1 className="text-2xl font-bold tracking-tight">Institutional Complaints Management</h1>
              <p className="mt-1 text-sm text-slate-300">
                Review, delegate, and resolve student & faculty grievances with institutional confidentiality.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-medium text-emerald-300 ring-1 ring-white/15">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Strict Complainant Anonymity Enforced</span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{summary.overview.total}</div>
          <p className="mt-1 text-[11px] text-slate-400">All recorded grievances</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">Pending</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-900">{summary.overview.pending}</div>
          <p className="mt-1 text-[11px] text-amber-700">Awaiting initial action</p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800">In Review</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <HelpCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-blue-900">{summary.overview.inReview}</div>
          <p className="mt-1 text-[11px] text-blue-700">Under active investigation</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Resolved</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-900">{summary.overview.resolved}</div>
          <p className="mt-1 text-[11px] text-emerald-700">Successfully addressed</p>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-800">Faculty Handled</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-purple-900">{summary.overview.facultyAssignedCount || 0}</div>
          <p className="mt-1 text-[11px] text-purple-700">Delegated to faculty</p>
        </div>
      </div>

      {/* Analytics Breakdown Row: Category Pills & Faculty Complaints */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Category Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">By Category</h3>
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </div>
          <div className="space-y-2.5">
            {CATEGORIES.map(cat => {
              const count = summary.categoryCounts[cat.value] || 0;
              const pct = summary.overview.total > 0
                ? Math.round((count / summary.overview.total) * 100)
                : 0;

              return (
                <div key={cat.value} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{cat.label}</span>
                    <span className="font-bold text-slate-900">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary-600 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Faculty Complaints Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Complaints Against Faculty Members
              </h3>
              <p className="text-xs text-slate-400">Strictly handled by institutional administration only</p>
            </div>
            <UserCheck className="h-4 w-4 text-slate-400" />
          </div>

          {summary.facultyCounts.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-slate-400">
              <CheckCircle2 className="mb-1 h-6 w-6 text-emerald-500" />
              <span>No complaints filed against any faculty members.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {summary.facultyCounts.map(item => (
                <div
                  key={item.facultyId}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{item.name}</h4>
                    <p className="text-[11px] text-slate-500">{item.department || 'Department'}</p>
                  </div>
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
                    {item.count} {item.count === 1 ? 'complaint' : 'complaints'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {/* Search Input */}
            <div>
              <label htmlFor="filter-search" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Search Text
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  id="filter-search"
                  type="text"
                  placeholder="Subject or content..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 pl-8 pr-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label htmlFor="filter-category" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Category
              </label>
              <select
                id="filter-category"
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value, page: 1 }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="filter-status" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Status
              </label>
              <select
                id="filter-status"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_review">In Review</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Assigned Handler Filter */}
            <div>
              <label htmlFor="filter-handler" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Handler / Queue
              </label>
              <select
                id="filter-handler"
                value={filters.assignedTo}
                onChange={(e) => setFilters(prev => ({ ...prev, assignedTo: e.target.value, page: 1 }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">All Handlers</option>
                <option value="admin">Admin Queue</option>
                {handlers.map(h => (
                  <option key={h.id} value={h.id}>Faculty: {h.name}</option>
                ))}
              </select>
            </div>

            {/* From Date Filter */}
            <div>
              <label htmlFor="filter-from" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                From Date
              </label>
              <input
                id="filter-from"
                type="date"
                value={filters.from}
                onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value, page: 1 }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* To Date Filter */}
            <div>
              <label htmlFor="filter-to" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                To Date
              </label>
              <input
                id="filter-to"
                type="date"
                value={filters.to}
                onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value, page: 1 }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <Filter className="h-3.5 w-3.5" />
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      {/* Complaints Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Subject & Content</th>
                <th className="py-3.5 px-4">Target / Scope</th>
                <th className="py-3.5 px-4">Handler & Routing Reason</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                      <span>Loading complaints...</span>
                    </div>
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <MessageSquare className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No complaints found</p>
                    <p className="text-[11px] text-slate-400">Try adjusting your filters.</p>
                  </td>
                </tr>
              ) : (
                complaints.map(item => {
                  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                  const StatusIcon = status.icon;

                  return (
                    <tr key={item._id} className="transition hover:bg-slate-50/80">
                      {/* Category */}
                      <td className="py-3.5 px-4 font-medium">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                          {item.category.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Subject & snippet */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-bold text-slate-900 truncate">{item.subject}</p>
                        <p className="text-slate-500 line-clamp-1 text-[11px]">{item.description}</p>
                      </td>

                      {/* Scope / Target */}
                      <td className="py-3.5 px-4">
                        {item.targetSubject?.code ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-indigo-700">
                              Subject: {item.targetSubject.code}
                            </span>
                            {item.targetSubject.name && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                                {item.targetSubject.name}
                              </span>
                            )}
                          </div>
                        ) : item.category === 'faculty' && item.faculty?.name ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">
                              Against: {item.faculty.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {item.faculty.department}
                            </span>
                          </div>
                        ) : item.category === 'student' && item.targetStudent?.name ? (
                          <span className="font-semibold text-amber-800">
                            Student: {item.targetStudent.name}
                          </span>
                        ) : (
                          <span className="text-slate-500 capitalize">{item.category.replace('_', ' ')} General</span>
                        )}
                      </td>

                      {/* Handler & Routing Reason */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div>
                          {item.assignedHandler?.name ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">
                              <Briefcase className="h-3 w-3" />
                              {item.assignedHandler.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                              Admin Queue
                            </span>
                          )}
                        </div>
                        {item.assignmentReason && (
                          <p className="mt-1 text-[11px] text-slate-500 line-clamp-2" title={item.assignmentReason}>
                            {item.assignmentReason}
                          </p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${status.badge}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-primary-700 shadow-sm transition hover:border-primary-500 hover:bg-primary-50"
                        >
                          Review & Assign
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold">{complaints.length}</span> of{' '}
            <span className="font-semibold">{pagination.total}</span> complaints
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="text-xs">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Review, Assign & Respond Modal */}
      {activeComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
                    {activeComplaint.category.replace('_', ' ')}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Anonymous Complainant
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {activeComplaint.subject}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Target Details if Faculty */}
            {activeComplaint.category === 'faculty' && activeComplaint.faculty && (
              <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50/50 p-3 text-xs text-primary-900">
                <span className="font-bold">Targeted Faculty: </span>
                {activeComplaint.faculty.name} ({activeComplaint.faculty.department})
              </div>
            )}

            {/* Target Details if Student */}
            {activeComplaint.category === 'student' && activeComplaint.targetStudent && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                <span className="font-bold">Student Involved: </span>
                {activeComplaint.targetStudent.name} ({activeComplaint.targetStudent.enrollmentNo || activeComplaint.targetStudent.branch})
              </div>
            )}

            {/* Target Details if Subject */}
            {activeComplaint.targetSubject?.code && (
              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-900">
                <span className="font-bold">Targeted Academic Subject: </span>
                {activeComplaint.targetSubject.code} {activeComplaint.targetSubject.name ? `(${activeComplaint.targetSubject.name})` : ''}
              </div>
            )}

            {/* Full Complaint Description */}
            <div className="mt-4 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Complaint Details
              </span>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                {activeComplaint.description}
              </div>
            </div>

            {/* Assignment & Routing Reason Notice */}
            {activeComplaint.assignmentReason && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-700">
                <span className="font-bold text-slate-900">Current Routing Reason: </span>
                <span className="text-slate-600">{activeComplaint.assignmentReason}</span>
              </div>
            )}

            {/* Submission metadata */}
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                Submitted on {new Date(activeComplaint.createdAt).toLocaleString('en-US')}
              </span>
              {activeComplaint.respondedAt && (
                <span>
                  Last response on {new Date(activeComplaint.respondedAt).toLocaleString('en-US')}
                </span>
              )}
            </div>

            {/* Admin Form: Status, Assignment & Response */}
            <form onSubmit={handleSaveModal} className="mt-6 space-y-4 border-t border-slate-100 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Status */}
                <div>
                  <label htmlFor="modal-status" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Status
                  </label>
                  <select
                    id="modal-status"
                    value={modalForm.status}
                    onChange={(e) => setModalForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_review">In Review</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {/* Handler Assignment */}
                <div>
                  <label htmlFor="modal-handler" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Assign Handler
                  </label>
                  {activeComplaint.category === 'faculty' ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                      Restricted to Admin (Faculty complaints cannot be assigned to faculty)
                    </div>
                  ) : (
                    <select
                      id="modal-handler"
                      value={modalForm.assignedTo}
                      onChange={(e) => setModalForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="admin">Admin Queue (Institutional Administration)</option>
                      {handlers.map(h => (
                        <option key={h.id} value={h.id}>
                          Faculty: {h.name} ({h.department || 'Dept'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Assignment Reason Input */}
              {activeComplaint.category !== 'faculty' && (
                <div>
                  <label htmlFor="modal-reason" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Assignment Reason / Routing Note
                  </label>
                  <input
                    id="modal-reason"
                    type="text"
                    value={modalForm.assignmentReason}
                    onChange={(e) => setModalForm(prev => ({ ...prev, assignmentReason: e.target.value }))}
                    placeholder="Enter reason for assignment or leave blank to keep system explanation..."
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              )}

              <div>
                <label htmlFor="modal-response" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Administrative / Official Response (Visible to complainant)
                </label>
                <textarea
                  id="modal-response"
                  rows={4}
                  value={modalForm.adminResponse}
                  onChange={(e) => setModalForm(prev => ({ ...prev, adminResponse: e.target.value }))}
                  placeholder="State the findings, resolution, or institutional action taken regarding this complaint..."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
                >
                  {updating ? 'Updating...' : 'Save & Publish Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
