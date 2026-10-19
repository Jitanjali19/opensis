import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/axios';
import { FileText, Upload, CheckCircle, Clock, AlertCircle, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';

const resolveAssetUrl = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
  return `${base}${value}`;
};

export default function StudentAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = () => {
    api.get('/student/assignments').then(r => {
      setAssignments(r.data.data.assignments);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const validateFile = (file) => {
    const allowed = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      toast.error('Invalid file format. Only PDF, DOC, DOCX, JPG, JPEG, and PNG are allowed.');
      return false;
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File size exceeds the 10MB limit.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (assignmentId, file) => {
    if (!file) return toast.error('Select a file first');
    if (!validateFile(file)) return;

    setSubmitting(assignmentId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/student/assignments/${assignmentId}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Submitted successfully!');
      loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit assignment');
    }
    setSubmitting(null);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  // Calculate unsubmitted status metrics for banners (due soon uses 3 days)
  const overdueCount = assignments.filter(a => {
    if (a.mySubmission && !a.mySubmission.resubmissionRequested) return false;
    if (a.isClosed) return false; // closed is handled separately
    return new Date(a.dueDate) < new Date();
  }).length;

  const dueSoonCount = assignments.filter(a => {
    if (a.mySubmission && !a.mySubmission.resubmissionRequested) return false;
    if (a.isClosed) return false; // closed is handled separately
    const timeDiff = new Date(a.dueDate) - new Date();
    return timeDiff > 0 && timeDiff <= 3 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Assignments</h1>
        <p className="text-slate-500 text-sm mt-1">View assignments and submit your work</p>
      </div>

      {/* Warning Banners at top of page */}
      {overdueCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg mb-6 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-rose-900">Overdue Assignments Notice</h4>
            <p className="text-sm mt-0.5">You have {overdueCount} assignment(s) past their due date. Please complete and submit your work immediately.</p>
          </div>
        </div>
      )}

      {dueSoonCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-6 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-900">Upcoming Deadlines Notice</h4>
            <p className="text-sm mt-0.5">You have {dueSoonCount} assignment(s) due within the next 3 days. Make sure to upload your files soon!</p>
          </div>
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No assignments available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...assignments].sort((a, b) => {
            const typeOrder = (a.itemType === 'lab' ? 1 : 0) - (b.itemType === 'lab' ? 1 : 0);
            if (typeOrder !== 0) return typeOrder;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          }).map((a, index, grouped) => {
            const isOverdue = new Date(a.dueDate) < new Date();
            const submitted = !!a.mySubmission;
            const resubmitRequested = !!a.mySubmission?.resubmissionRequested;
            const graded = !resubmitRequested && ((a.mySubmission?.marks !== undefined && a.mySubmission?.marks !== null) || a.mySubmission?.feedback);
            const submittedLate = submitted && a.mySubmission?.submittedAt && new Date(a.mySubmission.submittedAt) > new Date(a.dueDate);

            // Calculate if due soon (within 3 days)
            const timeDiff = new Date(a.dueDate) - new Date();
            const isDueSoon = (!submitted || resubmitRequested) && !a.isClosed && timeDiff > 0 && timeDiff <= 3 * 24 * 60 * 60 * 1000;

            return (
              <React.Fragment key={a._id}>
                {(index === 0 || (a.itemType === 'lab') !== (grouped[index - 1].itemType === 'lab')) && (
                  <h2 className={`text-lg font-bold pt-3 ${a.itemType === 'lab' ? 'text-amber-700' : 'text-primary-700'}`}>
                    {a.itemType === 'lab' ? 'Lab Assignments' : 'Class Assignments'}
                  </h2>
                )}
              <div className={`card border-l-4 transition-all duration-200 ${resubmitRequested ? 'border-l-amber-500 bg-amber-50/5' : submitted ? 'border-l-green-500' : a.isClosed ? 'border-l-slate-300 bg-slate-50/50' : isOverdue ? 'border-l-rose-500' : isDueSoon ? 'border-l-amber-500' : 'border-l-blue-400'}`}>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-semibold text-base ${a.isClosed && !submitted ? 'text-slate-600' : 'text-slate-800'}`}>{a.title}</h3>
                      {resubmitRequested && (
                        <span className="badge-yellow bg-amber-50 border border-amber-200 text-amber-700 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Resubmission Requested
                        </span>
                      )}
                      {submitted && !resubmitRequested && graded && <span className="badge-green"><CheckCircle className="w-3 h-3 inline mr-1" />Graded</span>}
                      {submitted && !resubmitRequested && !graded && (
                        <span className="badge-blue">
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                          Submitted {submittedLate && <span className="text-[10px] text-rose-200 font-bold ml-1">(Late)</span>}
                        </span>
                      )}
                      {!submitted && a.isClosed && <span className="badge-red bg-slate-100 border border-slate-200 text-slate-500"><AlertCircle className="w-3 h-3 inline mr-1" />Closed</span>}
                      {!submitted && !a.isClosed && isOverdue && <span className="badge-red"><AlertCircle className="w-3 h-3 inline mr-1" />Overdue</span>}
                      {!submitted && !a.isClosed && !isOverdue && isDueSoon && <span className="badge-yellow"><AlertTriangle className="w-3 h-3 inline mr-1" />Due Soon</span>}
                      {!submitted && !a.isClosed && !isOverdue && !isDueSoon && <span className="badge-blue"><Clock className="w-3 h-3 inline mr-1" />Pending</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-semibold">
                      {a.itemType === 'lab' ? a.labId?.code : a.subjectId?.code} — {a.itemType === 'lab' ? a.labId?.name : a.subjectId?.name}
                    </p>
                    {a.description && <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2.5 rounded border border-slate-100 whitespace-pre-wrap">{a.description}</p>}
                    
                    {a.fileUrl && (
                      <div className="mt-3 flex items-center gap-2 bg-slate-50 p-2.5 rounded border border-slate-100 w-fit">
                        <FileText className="w-4 h-4 text-primary-600" />
                        <div>
                          <a
                            href={resolveAssetUrl(a.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-primary-600 hover:underline inline-flex items-center gap-1"
                          >
                            Download Questions / Instructions
                          </a>
                          <span className="text-[10px] text-slate-400 ml-2">({a.fileUrl.split('.').pop().toUpperCase()} file)</span>
                        </div>
                      </div>
                    )}

                    {a.mySubmission?.fileUrl && (
                      <div className="mt-3 flex items-center gap-2 bg-slate-50 p-2.5 rounded border border-slate-100 w-fit">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <div>
                          <a
                            href={resolveAssetUrl(a.mySubmission.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-emerald-600 hover:underline inline-flex items-center gap-1"
                          >
                            Download Your Submitted File
                          </a>
                          <span className="text-[10px] text-slate-400 ml-2">
                            ({a.mySubmission.fileUrl.split('.').pop().toUpperCase()} file)
                          </span>
                        </div>
                      </div>
                    )}
 
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                      <span className="font-medium text-slate-500">Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                      <span>Max: {a.maxMarks} marks</span>
                      {a.facultyId && <span>Faculty: Prof. {a.facultyId.firstName} {a.facultyId.lastName}</span>}
                    </div>
 
                    {/* Warning Banners Inside Assignment Card */}
                    {resubmitRequested && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 flex flex-col gap-1 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <span>Resubmission Required:</span>
                        </div>
                        <p className="text-amber-800">The faculty has requested a revision of your submission. Please check the feedback below and upload your corrected file.</p>
                        {a.mySubmission.feedback && (
                          <div className="mt-2 p-2 bg-white/80 rounded border border-amber-200 text-slate-700">
                            <span className="font-semibold text-slate-800">Faculty Reason / Feedback:</span> {a.mySubmission.feedback}
                          </div>
                        )}
                      </div>
                    )}
 
                    {(!submitted || resubmitRequested) && !a.isClosed && isOverdue && (
                      <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 flex items-center gap-2 text-xs">
                        <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        <div>
                          <span className="font-semibold">Overdue Warning:</span> The deadline was on {new Date(a.dueDate).toLocaleDateString()}. Your submission will be flagged as late.
                        </div>
                      </div>
                    )}
 
                    {(!submitted || resubmitRequested) && !a.isClosed && isDueSoon && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 flex items-center gap-2 text-xs">
                        <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <div>
                          <span className="font-semibold">Attention:</span> This assignment is due within 3 days. Please prepare and submit your work before the deadline.
                        </div>
                      </div>
                    )}
 
                    {!submitted && a.isClosed && (
                      <div className="mt-3 p-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 flex items-center gap-2 text-xs">
                        <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div>
                          <span className="font-semibold">Closed:</span> Submissions for this assignment have been closed by the faculty. You can no longer upload your work.
                        </div>
                      </div>
                    )}
 
                    {/* Grading info */}
                    {graded && (
                      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <p className="text-sm font-semibold text-emerald-800">
                          {a.mySubmission.marks !== undefined && a.mySubmission.marks !== null ? (
                            `Score: ${a.mySubmission.marks} / ${a.maxMarks}`
                          ) : (
                            'Graded (Feedback Received)'
                          )}
                          {submittedLate && <span className="text-rose-600 text-xs ml-2">(Late Submission)</span>}
                        </p>
                        {a.mySubmission.feedback && <p className="text-xs text-emerald-600 mt-1"><span className="font-medium">Faculty Feedback:</span> {a.mySubmission.feedback}</p>}
                      </div>
                    )}
                  </div>

                  {/* Upload Section (Locked if submitted or closed, unless resubmission requested) */}
                  <div className="flex-shrink-0 flex items-center">
                    {submitted && !resubmitRequested ? (
                      <div className="text-xs text-slate-400 bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-center font-medium md:text-right w-full md:w-auto">
                        <p className="text-emerald-700 flex items-center justify-center md:justify-end gap-1">
                          <CheckCircle className="w-4 h-4 text-emerald-600" /> Submitted
                        </p>
                        <p className="text-[10px] mt-0.5 text-slate-500">Date: {new Date(a.mySubmission.submittedAt).toLocaleDateString()}</p>
                        {submittedLate && <p className="text-[10px] text-rose-600 font-bold">Late Submission</p>}
                        <p className="text-[10px] mt-0.5 text-slate-500 font-semibold">(Editing locked)</p>
                      </div>
                    ) : a.isClosed ? (
                      <div className="text-xs text-slate-400 bg-slate-100 border border-slate-200 text-slate-500 p-2.5 rounded-lg text-center font-medium w-full md:w-auto min-w-[150px]">
                        <p className="flex items-center justify-center gap-1 font-semibold">
                          <X className="w-4 h-4 text-slate-400" /> Submissions Closed
                        </p>
                      </div>
                    ) : (
                      <FileUploadButton
                        assignmentId={a._id}
                        onSubmit={handleSubmit}
                        isSubmitting={submitting === a._id}
                      />
                    )}
                  </div>
                </div>
              </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FileUploadButton({ assignmentId, onSubmit, isSubmitting }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto min-w-[200px]">
      <input 
        type="file" 
        ref={fileRef} 
        className="hidden" 
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={handleFileChange} 
      />
      <button 
        type="button" 
        onClick={() => fileRef.current?.click()} 
        className="btn-secondary text-xs flex items-center justify-center gap-1.5 py-2 px-3 border border-slate-200 bg-white hover:bg-slate-50 rounded"
      >
        <Upload className="w-3.5 h-3.5" /> 
        {file ? file.name.slice(0, 20) + (file.name.length > 20 ? '...' : '') : 'Choose File'}
      </button>
      <p className="text-[10px] text-slate-400 text-center md:text-right">
        Formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
      </p>
      {file && (
        <button 
          type="button" 
          onClick={() => onSubmit(assignmentId, file)} 
          disabled={isSubmitting} 
          className="btn-primary text-xs py-2 px-3 flex items-center justify-center gap-1.5"
        >
          {isSubmitting ? 'Uploading...' : 'Submit Assignment'}
        </button>
      )}
    </div>
  );
}
