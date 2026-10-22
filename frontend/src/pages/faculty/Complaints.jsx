import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { getDepartmentLabel } from '../../constants/departments';
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Clock,
  Filter,
  HelpCircle,
  Inbox,
  MessageSquare,
  PlusCircle,
  Send,
  ShieldCheck,
  User,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const FACULTY_CATEGORIES = [
  { value: 'student', label: 'Student Discipline / Class Concern' },
  { value: 'class_discipline', label: 'Class Discipline' },
  { value: 'faculty', label: 'Faculty Colleague (Admin Review Only)' },
  { value: 'subject', label: 'Subject / Academic Resource' },
  { value: 'college', label: 'Campus / Facility / Infrastructure' },
  { value: 'administration', label: 'Administration' },
  { value: 'website', label: 'ERP / Website / IT Issue' },
  { value: 'other', label: 'Other Administrative Matter' },
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

export default function FacultyComplaints() {
  const [activeTab, setActiveTab] = useState('assigned'); // 'assigned' | 'submit' | 'mine'

  // Data states
  const [assignedComplaints, setAssignedComplaints] = useState([]);
  const [myComplaints, setMyComplaints] = useState([]);
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [studentOptions, setStudentOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [allTerms, setAllTerms] = useState(false);

  // Selected complaint for resolution modal
  const [selectedAssigned, setSelectedAssigned] = useState(null);
  const [resolutionForm, setResolutionForm] = useState({
    status: 'in_review',
    adminResponse: '',
  });

  // Submission form state
  const [form, setForm] = useState({
    category: 'student',
    faculty: '',
    targetStudent: '',
    targetSubject: '',
    subject: '',
    description: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [assignedRes, mineRes, facRes, stuRes, subRes] = await Promise.all([
        api.get(`/complaints/assigned${allTerms ? '?allTerms=true' : ''}`).catch(() => ({ data: { data: { complaints: [] } } })),
        api.get(`/complaints/mine${allTerms ? '?allTerms=true' : ''}`).catch(() => ({ data: { data: { complaints: [] } } })),
        api.get('/complaints/faculty-options').catch(() => ({ data: { data: { faculty: [] } } })),
        api.get('/complaints/student-options').catch(() => ({ data: { data: { students: [] } } })),
        api.get('/complaints/subject-options').catch(() => ({ data: { data: { subjects: [] } } })),
      ]);

      setAssignedComplaints(assignedRes.data?.data?.complaints || []);
      setMyComplaints(mineRes.data?.data?.complaints || []);
      setFacultyOptions(facRes.data?.data?.faculty || []);
      setStudentOptions(stuRes.data?.data?.students || []);
      setSubjectOptions(subRes.data?.data?.subjects || []);
    } catch (err) {
      toast.error('Failed to load complaints data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [allTerms]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'category') {
        if (value !== 'faculty') next.faculty = '';
        if (value !== 'student') next.targetStudent = '';
        if (value !== 'subject' && value !== 'class_discipline' && value !== 'student') {
          next.targetSubject = '';
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.category) return toast.error('Please select a category');
    if (form.category === 'faculty' && !form.faculty) return toast.error('Please select a faculty member');
    if (!form.subject.trim()) return toast.error('Please enter a complaint title');
    if (form.subject.trim().length > 120) return toast.error('Title must be at most 120 characters');
    if (!form.description.trim()) return toast.error('Please describe your concern');
    if (form.description.trim().length > 2000) return toast.error('Description must be at most 2000 characters');

    setSubmitting(true);
    try {
      const payload = {
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim(),
        faculty: form.category === 'faculty' ? form.faculty : null,
        targetStudent: form.category === 'student' ? (form.targetStudent || null) : null,
        targetSubject: ['subject', 'class_discipline', 'student'].includes(form.category) ? (form.targetSubject || null) : null,
      };

      const { data } = await api.post('/complaints', payload);
      toast.success(data.message || 'Your complaint has been submitted.');

      setForm({
        category: 'student',
        faculty: '',
        targetStudent: '',
        targetSubject: '',
        subject: '',
        description: '',
      });

      // Reload mine list and switch to My Complaints tab
      const myRes = await api.get(`/complaints/mine${allTerms ? '?allTerms=true' : ''}`);
      setMyComplaints(myRes.data?.data?.complaints || []);
      setActiveTab('mine');
    } catch (err) {
      // Axios toast handler
    } finally {
      setSubmitting(false);
    }
  };

  const openResolutionModal = (complaint) => {
    setSelectedAssigned(complaint);
    setResolutionForm({
      status: complaint.status || 'in_review',
      adminResponse: complaint.adminResponse || '',
    });
  };

  const closeResolutionModal = () => {
    setSelectedAssigned(null);
  };

  const handleSaveResolution = async (e) => {
    e.preventDefault();
    if (!selectedAssigned) return;

    setUpdating(true);
    try {
      const { data } = await api.patch(`/complaints/assigned/${selectedAssigned._id}`, resolutionForm);
      toast.success(data.message || 'Resolution updated successfully');

      const updated = data?.data?.complaint;
      if (updated) {
        setAssignedComplaints(prev => prev.map(c => c._id === updated._id ? { ...c, ...updated } : c));
      }

      closeResolutionModal();
    } catch (err) {
      // Axios toast
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-16">
      {/* Hero Header */}
      <div className="overflow-hidden rounded-2xl bg-[#151923] p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-sgsits-gold-400">
                Department & Academic Redressal
              </p>
              <h1 className="text-2xl font-bold tracking-tight">Faculty Complaints & Resolution</h1>
              <p className="mt-1 text-sm text-slate-300">
                Handle assigned student grievances confidentially and submit institutional concerns.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-medium text-emerald-300 ring-1 ring-white/15">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Anonymous Complainant Protection</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('assigned')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'assigned'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Assigned to Me</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
              {assignedComplaints.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('submit')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'submit'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            <PlusCircle className="h-4 w-4" />
            <span>File a Complaint</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mine')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'mine'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Inbox className="h-4 w-4" />
            <span>My Submitted Complaints</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
              {myComplaints.length}
            </span>
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={allTerms} onChange={e => setAllTerms(e.target.checked)} />
          Show all terms
        </label>
      </div>

      {/* TAB 1: Assigned Complaints */}
      {activeTab === 'assigned' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Complaints Assigned to You</h2>
              <p className="text-xs text-slate-500">
                You have been designated to resolve these academic or class concerns. The student identity is strictly protected.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {assignedComplaints.length} Total
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              ))}
            </div>
          ) : assignedComplaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
              <p className="font-semibold text-slate-800">No pending complaints assigned</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Any student academic or class concerns routed to you will appear here for review and resolution.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignedComplaints.map(item => {
                const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={item._id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
                            {item.category.replace('_', ' ')}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            Anonymous Student
                          </span>
                          {item.targetSubject?.code && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                              <BookOpen className="h-3 w-3" />
                              Subject: {item.targetSubject.code}
                            </span>
                          )}
                          {item.targetStudent?.name && (
                            <span className="rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                              Concern: {item.targetStudent.name}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            · {new Date(item.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <h3 className="mt-2 text-base font-semibold text-slate-900">{item.subject}</h3>
                        {item.assignmentReason && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/70 px-2.5 py-1 text-xs text-purple-900">
                            <Briefcase className="h-3.5 w-3.5 shrink-0 text-purple-700" />
                            <span><strong className="font-semibold text-purple-950">Assignment Reason:</strong> {item.assignmentReason}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.badge}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => openResolutionModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
                        >
                          Resolve / Respond
                        </button>
                      </div>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                      {item.description}
                    </p>

                    {item.adminResponse ? (
                      <div className="mt-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                          <span>Your Response</span>
                          {item.respondedAt && (
                            <span className="font-normal text-emerald-700">
                              {new Date(item.respondedAt).toLocaleDateString('en-US')}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-emerald-950">
                          {item.adminResponse}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-amber-700 font-medium">
                        Awaiting your response. Click "Resolve / Respond" to add remarks.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Submit a Complaint */}
      {activeTab === 'submit' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Submit a Formal Concern</h2>
              <p className="text-xs text-slate-500">
                Report student discipline, campus infrastructure, ERP issues, or colleague concerns.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Identity Protected</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Category */}
              <div>
                <label htmlFor="faculty-category" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  id="faculty-category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  required
                >
                  {FACULTY_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Target Faculty - If category is 'faculty' */}
              {form.category === 'faculty' && (
                <div>
                  <label htmlFor="faculty-target" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Faculty Member <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="faculty-target"
                    name="faculty"
                    value={form.faculty}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    required
                  >
                    <option value="">-- Select Faculty Member --</option>
                    {facultyOptions.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({getDepartmentLabel(f.department) || 'Dept'})</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-amber-700">
                    Complaints against faculty are strictly routed to Admin only and never shown to the colleague.
                  </p>
                </div>
              )}

              {/* Target Student - If category is 'student' */}
              {form.category === 'student' && (
                <div>
                  <label htmlFor="student-target" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Student Concerned (Optional)
                  </label>
                  <select
                    id="student-target"
                    name="targetStudent"
                    value={form.targetStudent}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">-- Select Student (or general class issue) --</option>
                    {studentOptions.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.enrollmentNo || getDepartmentLabel(s.branch)})</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">
                    Select a student or describe a general section/class discipline matter.
                  </p>
                </div>
              )}

              {/* Academic Subject - If category is 'subject' or 'class_discipline' */}
              {['subject', 'class_discipline'].includes(form.category) && (
                <div>
                  <label htmlFor="faculty-target-subject" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Academic Subject (Optional)
                  </label>
                  <select
                    id="faculty-target-subject"
                    name="targetSubject"
                    value={form.targetSubject}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">-- Select Academic Subject --</option>
                    {subjectOptions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Title / Summary */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="faculty-subject" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Complaint Title / Summary <span className="text-rose-500">*</span>
                </label>
                <span className={`text-xs font-medium ${form.subject.length > 120 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {form.subject.length}/120
                </span>
              </div>
              <input
                id="faculty-subject"
                type="text"
                name="subject"
                value={form.subject}
                onChange={handleChange}
                maxLength={120}
                placeholder="Brief summary of the issue"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="faculty-description" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Description <span className="text-rose-500">*</span>
                </label>
                <span className={`text-xs font-medium ${form.description.length > 2000 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {form.description.length}/2000
                </span>
              </div>
              <textarea
                id="faculty-description"
                name="description"
                rows={5}
                value={form.description}
                onChange={handleChange}
                maxLength={2000}
                placeholder="Provide detailed information regarding the matter..."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                required
              />
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                <span>{submitting ? 'Submitting...' : 'Submit Complaint'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: My Submitted Complaints */}
      {activeTab === 'mine' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Your Submitted Complaints</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {myComplaints.length} Total
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              ))}
            </div>
          ) : myComplaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
              <Inbox className="h-10 w-10 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-800">No complaints filed yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Use the "File a Complaint" tab to report any institutional issues.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {myComplaints.map(item => {
                const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={item._id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
                            {item.category.replace('_', ' ')}
                          </span>
                          {item.targetSubject?.code && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                              <BookOpen className="h-3 w-3" />
                              Subject: {item.targetSubject.code}
                            </span>
                          )}
                          {item.faculty?.name && (
                            <span className="rounded-md bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700 border border-primary-200">
                              Against: {item.faculty.name}
                            </span>
                          )}
                          {item.targetStudent?.name && (
                            <span className="rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                              Student: {item.targetStudent.name}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            · {new Date(item.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <h3 className="mt-2 text-base font-semibold text-slate-900">{item.subject}</h3>
                      </div>

                      <span className={`inline-flex items-center gap-1 self-start rounded-full border px-3 py-1 text-xs font-semibold ${status.badge}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </span>
                    </div>

                    <p className="mt-2.5 whitespace-pre-wrap text-sm text-slate-600">
                      {item.description}
                    </p>

                    {item.adminResponse ? (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>Institutional Response</span>
                          </div>
                          {item.respondedAt && (
                            <span className="font-normal text-emerald-700">
                              {new Date(item.respondedAt).toLocaleDateString('en-US')}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm text-emerald-950">
                          {item.adminResponse}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Pending administrative review</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Faculty Resolution Modal */}
      {selectedAssigned && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
                    {selectedAssigned.category.replace('_', ' ')}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Anonymous Student
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-bold text-slate-900">
                  {selectedAssigned.subject}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeResolutionModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedAssigned.targetSubject?.code && (
              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-900">
                <span className="font-bold">Subject: </span>
                {selectedAssigned.targetSubject.code} {selectedAssigned.targetSubject.name ? `(${selectedAssigned.targetSubject.name})` : ''}
              </div>
            )}

            {selectedAssigned.targetStudent?.name && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                <span className="font-bold">Student Involved: </span>
                {selectedAssigned.targetStudent.name} ({selectedAssigned.targetStudent.enrollmentNo || getDepartmentLabel(selectedAssigned.targetStudent.branch)})
              </div>
            )}

            {selectedAssigned.assignmentReason && (
              <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/70 p-3 text-xs text-purple-900">
                <span className="font-bold text-purple-950">Assignment Reason: </span>
                <span>{selectedAssigned.assignmentReason}</span>
              </div>
            )}

            <div className="mt-4 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Complaint Details
              </span>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                {selectedAssigned.description}
              </div>
            </div>

            <form onSubmit={handleSaveResolution} className="mt-6 space-y-4 border-t border-slate-100 pt-4">
              <div>
                <label htmlFor="res-status" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Status
                </label>
                <select
                  id="res-status"
                  value={resolutionForm.status}
                  onChange={(e) => setResolutionForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="pending">Pending</option>
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label htmlFor="res-response" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Resolution Notes / Response to Student
                </label>
                <textarea
                  id="res-response"
                  rows={4}
                  value={resolutionForm.adminResponse}
                  onChange={(e) => setResolutionForm(prev => ({ ...prev, adminResponse: e.target.value }))}
                  placeholder="Explain the steps taken or outcome regarding this matter..."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeResolutionModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
                >
                  {updating ? 'Saving...' : 'Save Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
