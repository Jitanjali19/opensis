import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Search, 
  BookOpen, 
  FlaskConical, 
  UserCheck, 
  CornerDownLeft, 
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSubjectReviewModal({
  isOpen,
  onClose,
  subject,
  semester,
  session,
  branch,
  onReviewComplete,
}) {
  const [loading, setLoading] = useState(true);
  const [studentMarks, setStudentMarks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    if (!isOpen || !subject) return;

    const loadMarks = async () => {
      setLoading(true);
      try {
        const q = `?semester=${semester}&session=${encodeURIComponent(session)}${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`;
        const { data } = await api.get(`/admin/results${q}`);
        const allResults = data.data?.results || [];

        const isLab = subject.itemType === 'lab';
        const marks = allResults.map((r) => {
          const mark = (r.subjectMarks || []).find((sm) => (
            isLab
              ? String(sm.labId?._id || sm.labId) === String(subject._id)
              : String(sm.subjectId?._id || sm.subjectId) === String(subject._id)
          ));

          if (!mark || mark.totalMarks == null) return null;

          return {
            studentId: r.studentId?._id,
            enrollmentNo: r.studentId?.enrollmentNo || '—',
            studentName: r.studentId 
              ? `${r.studentId.firstName || ''} ${r.studentId.lastName || ''}`.trim() || r.studentId.enrollmentNo
              : 'Unknown / Deleted Student',
            cw: mark.cw ?? mark.internalMarks,
            sw: mark.sw,
            theory: mark.theory ?? mark.externalMarks,
            practical: mark.practical ?? mark.externalMarks,
            totalMarks: mark.totalMarks,
            grade: mark.grade || '—',
            gradePoints: mark.gradePoints,
            submittedAt: mark.submittedAt,
            submissionStatus: mark.submissionStatus || 'pending',
            rejectionReason: mark.rejectionReason,
          };
        }).filter(Boolean);

        setStudentMarks(marks);
      } catch (err) {
        toast.error('Failed to load marks for this subject');
      } finally {
        setLoading(false);
      }
    };

    loadMarks();
  }, [isOpen, subject, semester, session, branch]);

  if (!isOpen || !subject) return null;

  const isLab = subject.itemType === 'lab';
  const labelPrimary = isLab ? 'SW' : 'CW';
  const labelSecondary = isLab ? 'Practical' : 'Theory';

  const handleApprove = async () => {
    if (!window.confirm(`Approve marks for ${subject.code} (${subject.name})?`)) return;

    setReviewing(true);
    try {
      const { data } = await api.patch('/admin/results/submission-status/review', {
        itemId: subject._id,
        itemType: subject.itemType,
        semester: Number(semester),
        session,
        status: 'approved',
      });
      toast.success(data.message || `Approved marks for ${subject.code}`);
      if (onReviewComplete) onReviewComplete();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve marks');
    } finally {
      setReviewing(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectionComment.trim()) {
      return toast.error('Please enter a reason for returning the marks to faculty');
    }

    setReviewing(true);
    try {
      const { data } = await api.patch('/admin/results/submission-status/review', {
        itemId: subject._id,
        itemType: subject.itemType,
        semester: Number(semester),
        session,
        status: 'rejected',
        rejectionReason: rejectionComment.trim(),
      });
      toast.success(data.message || `Returned marks for ${subject.code} to faculty`);
      if (onReviewComplete) onReviewComplete();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to return marks');
    } finally {
      setReviewing(false);
    }
  };

  const filteredMarks = studentMarks.filter(
    (m) =>
      m.enrollmentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.studentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isLab ? 'bg-purple-50 text-purple-600' : 'bg-primary-50 text-primary-600'}`}>
              {isLab ? <FlaskConical className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-lg">
                  {subject.code} — {subject.name}
                </h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${isLab ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {isLab ? 'Lab' : 'Class'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Faculty: <strong className="text-slate-700">{subject.faculty}</strong></span>
                <span>•</span>
                <span>Semester {semester} ({session})</span>
                <span>•</span>
                <span>{studentMarks.length} students submitted</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Overview Bar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input !pl-9 !py-1.5 text-xs w-full bg-white"
              placeholder="Search student or roll number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>
              Scheme: <strong>{isLab ? 'SW (40) + Practical (60)' : 'CW (30) + Theory (70)'} = 100</strong>
            </span>
          </div>
        </div>

        {/* Content Body: Student Marks Table */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Loading submitted student marks...</p>
            </div>
          ) : studentMarks.length === 0 ? (
            <div className="py-16 text-center">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h4 className="font-semibold text-slate-700">No marks submitted yet</h4>
              <p className="text-xs text-slate-500 mt-1">The faculty has not submitted marks for this subject yet.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 w-36">Enrollment No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3 w-28 text-center">{labelPrimary}</th>
                    <th className="py-2.5 px-3 w-28 text-center">{labelSecondary}</th>
                    <th className="py-2.5 px-3 w-24 text-center">Total</th>
                    <th className="py-2.5 px-3 w-20 text-center">Grade</th>
                    <th className="py-2.5 px-3 w-28 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredMarks.map((m, idx) => {
                    const primaryVal = isLab ? m.sw : m.cw;
                    const secondaryVal = isLab ? m.practical : m.theory;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">{m.enrollmentNo}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{m.studentName}</td>
                        <td className="py-2.5 px-3 text-center font-medium text-slate-700">{primaryVal}</td>
                        <td className="py-2.5 px-3 text-center font-medium text-slate-700">{secondaryVal}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900">{m.totalMarks}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-primary-600">{m.grade}</td>
                        <td className="py-2.5 px-3 text-center">
                          {m.submissionStatus === 'approved' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Approved
                            </span>
                          ) : m.submissionStatus === 'rejected' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full" title={m.rejectionReason}>
                              <AlertCircle className="w-3 h-3" /> Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Rejection Comment Form */}
          {showRejectForm && (
            <form onSubmit={handleReject} className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800">Return Marks to Faculty</span>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="text-rose-400 hover:text-rose-600 text-xs"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-rose-700">
                Please enter the reason for rejection. This comment will be displayed directly to the faculty member on their dashboard so they can make corrections.
              </p>
              <textarea
                className="input bg-white text-xs min-h-[70px] w-full"
                placeholder="e.g. Please verify CW marks for roll numbers 0801IT221001-0801IT221005 as assignments were not attached."
                value={rejectionComment}
                onChange={(e) => setRejectionComment(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewing || !rejectionComment.trim()}
                  className="btn-danger text-xs px-4 py-2"
                >
                  Confirm & Return to Faculty
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {!showRejectForm && (
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={reviewing || studentMarks.length === 0}
                className="btn-secondary text-xs px-4 py-2 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
              >
                Return with Comment
              </button>
            )}

            <button
              type="button"
              onClick={handleApprove}
              disabled={reviewing || studentMarks.length === 0}
              className="btn-primary text-xs px-5 py-2.5 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {reviewing ? 'Approving...' : 'Approve Marks'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
