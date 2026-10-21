import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  MessageSquare,
  Send,
  ShieldCheck,
  User,
  UserX,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'faculty', label: 'Faculty Member' },
  { value: 'student', label: 'Student / Class Discipline' },
  { value: 'subject', label: 'Subject / Academic Issue' },
  { value: 'college', label: 'Campus / Infrastructure' },
  { value: 'website', label: 'ERP / Website' },
  { value: 'other', label: 'Other Institutional Concern' },
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

export default function StudentComplaints() {
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [studentOptions, setStudentOptions] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    category: 'faculty',
    faculty: '',
    targetStudent: '',
    subject: '',
    description: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [facRes, stuRes, complaintsRes] = await Promise.all([
        api.get('/complaints/faculty-options').catch(() => ({ data: { data: { faculty: [] } } })),
        api.get('/complaints/student-options').catch(() => ({ data: { data: { students: [] } } })),
        api.get('/complaints/mine').catch(() => ({ data: { data: { complaints: [] } } })),
      ]);

      setFacultyOptions(facRes.data?.data?.faculty || []);
      setStudentOptions(stuRes.data?.data?.students || []);
      setComplaints(complaintsRes.data?.data?.complaints || []);
    } catch (err) {
      toast.error('Failed to load complaint data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'category') {
        if (value !== 'faculty') next.faculty = '';
        if (value !== 'student') next.targetStudent = '';
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.category) {
      return toast.error('Please select a category');
    }

    if (form.category === 'faculty' && !form.faculty) {
      return toast.error('Please select a faculty member');
    }

    if (!form.subject.trim()) {
      return toast.error('Please enter a subject');
    }
    if (form.subject.trim().length > 120) {
      return toast.error('Subject must be at most 120 characters');
    }

    if (!form.description.trim()) {
      return toast.error('Please describe your complaint');
    }
    if (form.description.trim().length > 2000) {
      return toast.error('Description must be at most 2000 characters');
    }

    setSubmitting(true);
    try {
      const payload = {
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim(),
        faculty: form.category === 'faculty' ? form.faculty : null,
        targetStudent: form.category === 'student' ? (form.targetStudent || null) : null,
      };

      const { data } = await api.post('/complaints', payload);
      toast.success(data.message || 'Your complaint has been submitted. Your identity is not shared with the administrator.');

      setForm({
        category: 'faculty',
        faculty: '',
        targetStudent: '',
        subject: '',
        description: '',
      });

      // Reload list
      const myRes = await api.get('/complaints/mine');
      setComplaints(myRes.data?.data?.complaints || []);
    } catch (err) {
      // Axios interceptor handles toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="overflow-hidden rounded-2xl bg-[#151923] p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-sgsits-gold-400">
                Confidential Reporting
              </p>
              <h1 className="text-2xl font-bold tracking-tight">Student Complaints</h1>
              <p className="mt-1 text-sm text-slate-300">
                Submit academic, faculty, peer discipline, or infrastructure grievances safely with guaranteed anonymity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-medium text-emerald-300 ring-1 ring-white/15">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Anonymous to Administrator & Faculty</span>
          </div>
        </div>
      </div>

      {/* Complaint Submission Form Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">File a New Complaint</h2>
            <p className="text-xs text-slate-500">
              Your identity (name, roll number, email) is never disclosed to administrators or handlers.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <UserX className="h-4 w-4 text-slate-400" />
            <span>Anonymous Mode Active</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Category Dropdown */}
            <div>
              <label htmlFor="complaint-category" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                id="complaint-category"
                name="category"
                value={form.category}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                required
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Target Faculty Dropdown - Only if Category is 'faculty' */}
            {form.category === 'faculty' && (
              <div>
                <label htmlFor="complaint-faculty" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Faculty Member <span className="text-rose-500">*</span>
                </label>
                <select
                  id="complaint-faculty"
                  name="faculty"
                  value={form.faculty}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  required={form.category === 'faculty'}
                >
                  <option value="">-- Select Faculty Member --</option>
                  {facultyOptions.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.department ? `(${f.department})` : ''}
                    </option>
                  ))}
                </select>
                {facultyOptions.length === 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    No faculty found in your department.
                  </p>
                )}
              </div>
            )}

            {/* Target Student Dropdown - Only if Category is 'student' */}
            {form.category === 'student' && (
              <div>
                <label htmlFor="complaint-student" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Student Concerned (Optional)
                </label>
                <select
                  id="complaint-student"
                  name="targetStudent"
                  value={form.targetStudent}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">-- Select Student (or leave unassigned) --</option>
                  {studentOptions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.enrollmentNo || s.branch})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Class/peer issues are routed directly to the responsible section faculty.
                </p>
              </div>
            )}
          </div>

          {/* Subject Field */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="complaint-subject" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Subject / Title <span className="text-rose-500">*</span>
              </label>
              <span className={`text-xs font-medium ${form.subject.length > 120 ? 'text-rose-600' : 'text-slate-400'}`}>
                {form.subject.length}/120
              </span>
            </div>
            <input
              id="complaint-subject"
              type="text"
              name="subject"
              value={form.subject}
              onChange={handleChange}
              maxLength={120}
              placeholder="Brief summary of your complaint"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              required
            />
          </div>

          {/* Description Field */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="complaint-description" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Description <span className="text-rose-500">*</span>
              </label>
              <span className={`text-xs font-medium ${form.description.length > 2000 ? 'text-rose-600' : 'text-slate-400'}`}>
                {form.description.length}/2000
              </span>
            </div>
            <textarea
              id="complaint-description"
              name="description"
              rows={5}
              value={form.description}
              onChange={handleChange}
              maxLength={2000}
              placeholder="Provide specific details about the issue. Please maintain a professional and objective tone..."
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              required
            />
          </div>

          {/* Privacy Notice & Submit Button */}
          <div className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between border border-slate-100">
            <div className="flex items-center gap-2.5 text-xs text-slate-600">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
              <span>
                Your identity is stripped at submission time. Administrators and handlers only see the complaint content.
              </span>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Submit Complaint</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* My Complaints List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">My Complaints</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {complaints.length} Submitted
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">No complaints filed yet</p>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              Any complaints you submit will appear here along with status updates and institutional responses.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {complaints.map(item => {
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
                        <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                          {item.category}
                        </span>
                        {item.faculty?.name && (
                          <span className="rounded-md bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700 border border-primary-200">
                            Faculty: {item.faculty.name}
                          </span>
                        )}
                        {item.targetStudent?.name && (
                          <span className="rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                            Student: {item.targetStudent.name}
                          </span>
                        )}
                        {item.assignedHandler?.name && (
                          <span className="text-xs text-slate-500">
                            · Handler: {item.assignedHandler.name}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          · {new Date(item.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-slate-900">{item.subject}</h3>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-xs font-semibold ${status.badge}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      {status.label}
                    </span>
                  </div>

                  <p className="mt-2.5 whitespace-pre-wrap text-sm text-slate-600">
                    {item.description}
                  </p>

                  {/* Administrative / Handler Response Section */}
                  {item.adminResponse ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Official Response</span>
                        </div>
                        {item.respondedAt && (
                          <span className="text-[11px] font-normal text-emerald-700">
                            {new Date(item.respondedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
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
                      <span>Pending review by assigned handler</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
