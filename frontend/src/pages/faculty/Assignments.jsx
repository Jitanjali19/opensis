import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Plus, FileText, Upload, Eye, Check, X, Users, AlertCircle, Clock, Trash2, Edit2, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { resolveAssetUrl, resolveAssetDownloadUrl } from '../../utils/assetUrl';

export default function FacultyAssignments() {
  const { selectedSession, selectedTerm } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [viewSubs, setViewSubs] = useState(null); // assignment id for viewing submissions
  const [submissionsData, setSubmissionsData] = useState({
    submitted: [],
    unsubmitted: [],
    stats: { totalStudents: 0, submittedCount: 0, unsubmittedCount: 0 }
  });
  const [subTab, setSubTab] = useState('submitted'); // 'submitted' or 'unsubmitted'
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', itemType: 'class', subjectId: '', labId: '', dueDate: '', maxMarks: 20 });
  const fileRef = useRef(null);

  // Phase 2 editing states
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', dueDate: '', maxMarks: 20 });
  const [editFile, setEditFile] = useState(null);
  const [shouldDeleteAttachment, setShouldDeleteAttachment] = useState(false);
  const editFileRef = useRef(null);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    setShowCreate(false);
    setForm(prev => ({ ...prev, subjectId: '', labId: '' }));
    loadAssignments();
    api.get('/faculty/subjects').then(r => setSubjects(r.data.data.subjects || []));
  }, [selectedSession, selectedTerm]);

  const loadAssignments = () => {
    api.get('/faculty/assignments').then(r => setAssignments(r.data.data.assignments));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (fileRef.current?.files[0]) fd.append('file', fileRef.current.files[0]);
      await api.post('/faculty/assignments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Assignment created');
      setShowCreate(false);
      setForm({ title: '', description: '', itemType: 'class', subjectId: '', labId: '', dueDate: '', maxMarks: 20 });
      if (fileRef.current) fileRef.current.value = '';
      loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create assignment');
    }
    setCreating(false);
  };

  const startEdit = (assignment) => {
    const dateFormatted = assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : '';
    setEditForm({
      title: assignment.title,
      description: assignment.description || '',
      dueDate: dateFormatted,
      maxMarks: assignment.maxMarks || 20
    });
    setEditingAssignment(assignment._id);
    setEditFile(null);
    setShouldDeleteAttachment(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(editForm).forEach(([k, v]) => fd.append(k, v));
      if (shouldDeleteAttachment) {
        fd.append('deleteAttachment', 'true');
      }
      if (editFile) {
        fd.append('file', editFile);
      }
      await api.patch(`/faculty/assignments/${editingAssignment}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Assignment updated successfully!');
      setEditingAssignment(null);
      setEditFile(null);
      setShouldDeleteAttachment(false);
      loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update assignment');
    }
  };

  const handleDelete = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this assignment and all of its submissions? This action cannot be undone.')) return;
    try {
      await api.delete(`/faculty/assignments/${assignmentId}`);
      toast.success('Assignment deleted');
      if (viewSubs === assignmentId) setViewSubs(null);
      loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete assignment');
    }
  };

  const toggleCloseSubmissions = async (assignment) => {
    try {
      const updatedStatus = !assignment.isClosed;
      await api.patch(`/faculty/assignments/${assignment._id}`, { isClosed: updatedStatus });
      toast.success(updatedStatus ? 'Submissions manually closed' : 'Submissions opened');
      loadAssignments();
    } catch (err) {
      toast.error('Failed to change submission status');
    }
  };

  const loadSubmissions = async (assignmentId) => {
    if (viewSubs === assignmentId) { setViewSubs(null); return; }
    try {
      const { data } = await api.get(`/faculty/assignments/${assignmentId}/submissions`);
      setSubmissionsData(data.data.submissions || { submitted: [], unsubmitted: [], stats: { totalStudents: 0, submittedCount: 0, unsubmittedCount: 0 } });
      setViewSubs(assignmentId);
      setSubTab('submitted');
    } catch {
      toast.error('Failed to load submissions');
    }
  };

  const gradeSubmission = async (subId, marks, feedback) => {
    try {
      await api.patch(`/faculty/submissions/${subId}`, { marks: Number(marks), feedback });
      toast.success('Graded!');
      const { data } = await api.get(`/faculty/assignments/${viewSubs}/submissions`);
      setSubmissionsData(data.data.submissions || { submitted: [], unsubmitted: [], stats: { totalStudents: 0, submittedCount: 0, unsubmittedCount: 0 } });
    } catch {
      toast.error('Failed to grade');
    }
  };

  const handleResubmitRequest = async (subId, studentName, feedback) => {
    if (!window.confirm(`Are you sure you want to delete ${studentName}'s submission and request them to submit again? This will remove their current file.`)) return;
    try {
      await api.delete(`/faculty/submissions/${subId}`, { data: { feedback } });
      toast.success('Submission reset successfully. Student can now resubmit.');
      const { data } = await api.get(`/faculty/assignments/${viewSubs}/submissions`);
      setSubmissionsData(data.data.submissions || { submitted: [], unsubmitted: [], stats: { totalStudents: 0, submittedCount: 0, unsubmittedCount: 0 } });
      loadAssignments(); // Reload main stats count
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request resubmission');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Assignments</h1>
          <p className="text-slate-500 text-sm mt-1">Create and manage assignments</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Assignment
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card mb-6">
          <h3 className="font-semibold text-slate-800 mb-4">Create Assignment</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Assignment title" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="input min-h-[80px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description..." />
            </div>
            <div>
              <label className="label">Class / Lab</label>
              <select className="input" value={form.itemType} onChange={e => setForm({ ...form, itemType: e.target.value, subjectId: '', labId: '' })}>
                <option value="class">Class Subject</option>
                <option value="lab">Lab</option>
              </select>
            </div>
            <div>
              <label className="label">{form.itemType === 'lab' ? 'Lab' : 'Class Subject'}</label>
              <select
                className="input"
                required
                value={form.itemType === 'lab' ? form.labId : form.subjectId}
                onChange={e => setForm({ ...form, [form.itemType === 'lab' ? 'labId' : 'subjectId']: e.target.value })}
              >
                <option value="">Select {form.itemType === 'lab' ? 'lab' : 'subject'}</option>
                {subjects.filter(s => s.itemType === form.itemType).map(s => <option key={s._id} value={s._id}>{s.code} — {s.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">The selected {form.itemType === 'lab' ? 'lab' : 'subject'} is assigned to its listed semester.</p>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className="input" required value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Max Marks</label>
              <input type="number" className="input" value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })} />
            </div>
            <div>
              <label className="label">Attachment (optional)</label>
              <input type="file" ref={fileRef} className="input text-xs" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
              <p className="text-[10px] text-slate-400 mt-1">Allowed: PDF, DOC, DOCX, JPG, JPEG, PNG (Max 10MB)</p>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Assignments List */}
      {assignments.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No assignments created yet</p>
        </div>
      ) : (
        <div className="space-y-8">
          {['class', 'lab'].map(type => {
            const sectionAssignments = assignments
              .filter(a => (a.itemType || 'class') === type)
              .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

            if (sectionAssignments.length === 0) return null;

            return (
              <section key={type}>
                <h2 className={`text-lg font-bold uppercase tracking-wide mb-3 ${type === 'lab' ? 'text-amber-700' : 'text-primary-700'}`}>
                  {type === 'lab' ? 'Lab Assignments' : 'Class Assignments'}
                </h2>
                <div className="space-y-4">
          {sectionAssignments.map(a => {
            const isOverdue = new Date(a.dueDate) < new Date();
            const isEditing = editingAssignment === a._id;

            return (
              <div key={a._id} className="card">
                {isEditing ? (
                  /* Inline Edit Form */
                  <form onSubmit={handleEditSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <h3 className="font-semibold text-slate-800 sm:col-span-2 text-sm border-b pb-2">Edit Assignment</h3>
                    <div className="sm:col-span-2">
                      <label className="label text-[11px] font-semibold text-slate-500">Title</label>
                      <input className="input text-xs py-1.5" required value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label text-[11px] font-semibold text-slate-500">Description</label>
                      <textarea className="input text-xs py-1.5 min-h-[60px]" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                    </div>
                    <div>
                      <label className="label text-[11px] font-semibold text-slate-500">Due Date</label>
                      <input type="date" className="input text-xs py-1.5" required value={editForm.dueDate} onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="label text-[11px] font-semibold text-slate-500">Max Marks</label>
                      <input type="number" className="input text-xs py-1.5" value={editForm.maxMarks} onChange={e => setEditForm({ ...editForm, maxMarks: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label text-[11px] font-semibold text-slate-500">Attachment (optional)</label>
                      {a.fileUrl && !shouldDeleteAttachment ? (
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                          <FileText className="w-4 h-4 text-primary-600" />
                          <a href={resolveAssetUrl(a.fileUrl)} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline flex-1 truncate">
                            {a.fileUrl.split('/').pop()}
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setShouldDeleteAttachment(true);
                              setEditFile(null);
                            }}
                            className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                          >
                            Delete File
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {shouldDeleteAttachment && (
                            <div className="text-[10px] text-rose-600 font-semibold bg-rose-50 p-1.5 rounded border border-rose-100 flex items-center justify-between">
                              <span>File will be deleted on save.</span>
                              <button
                                type="button"
                                onClick={() => setShouldDeleteAttachment(false)}
                                className="text-primary-600 hover:underline"
                              >
                                Keep Existing File
                              </button>
                            </div>
                          )}
                          <input
                            type="file"
                            ref={editFileRef}
                            className="input text-xs"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={e => {
                              if (e.target.files?.[0]) {
                                setEditFile(e.target.files[0]);
                                setShouldDeleteAttachment(true);
                              }
                            }}
                          />
                          <p className="text-[10px] text-slate-400">Allowed: PDF, DOC, DOCX, JPG, JPEG, PNG (Max 10MB)</p>
                        </div>
                      )}
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 text-xs pt-2">
                      <button type="button" onClick={() => setEditingAssignment(null)} className="btn-secondary py-1.5 px-3">Cancel</button>
                      <button type="submit" className="btn-primary py-1.5 px-3">Save Changes</button>
                    </div>
                  </form>
                ) : (
                  /* Standard Card Layout */
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800 text-base">{a.title}</h3>
                        {a.isClosed && <span className="badge-red text-[10px]">Closed</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{a.itemType === 'lab' ? a.labId?.code : a.subjectId?.code} — {a.itemType === 'lab' ? a.labId?.name : a.subjectId?.name}</p>
                      {a.description && <p className="text-sm text-slate-600 mt-2 bg-slate-50/50 p-2.5 rounded border border-slate-100 whitespace-pre-wrap">{a.description}</p>}
                      {a.fileUrl && (
                        <div className="mt-2.5 flex items-center gap-1.5 bg-slate-50 p-2 rounded border border-slate-100 w-fit">
                          <FileText className="w-4 h-4 text-primary-600" />
                          <a href={resolveAssetDownloadUrl(a.fileUrl)} className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1 font-medium">
                            Download Question File
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                        <span className="font-medium text-slate-500">Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                        <span>Max: {a.maxMarks} marks</span>
                        <span>{a.submissions?.length || 0} submissions</span>
                        {(() => {
                          const gradedCount = a.submissions?.filter(s => !s.resubmissionRequested && s.marks !== undefined && s.marks !== null).length || 0;
                          return gradedCount > 0 ? (
                            <span className="text-emerald-600 font-semibold">• {gradedCount} graded</span>
                          ) : null;
                        })()}
                        {isOverdue && !a.isClosed && <span className="badge-red">Overdue</span>}
                      </div>
                    </div>
                    
                    {/* Management Action Buttons */}
                    <div className="flex flex-row md:flex-col items-stretch md:items-end gap-2 mt-2 md:mt-0 flex-wrap">
                      <button
                        onClick={() => toggleCloseSubmissions(a)}
                        className={`text-[10px] font-semibold py-1.5 px-2.5 rounded border transition-colors flex items-center justify-center gap-1 ${
                          a.isClosed
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        <CheckSquare className="w-3 h-3" />
                        {a.isClosed ? 'Reopen Submissions' : 'Close Submissions'}
                      </button>
                      <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => startEdit(a)} className="btn-secondary text-[10px] py-1.5 px-2.5 flex-1 md:flex-none inline-flex items-center justify-center gap-1">
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => handleDelete(a._id)} className="btn-secondary text-[10px] py-1.5 px-2.5 text-rose-600 hover:text-rose-700 flex-1 md:flex-none inline-flex items-center justify-center gap-1">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                      <button onClick={() => loadSubmissions(a._id)} className="btn-primary text-xs py-1.5 px-3 w-full md:w-auto mt-1">
                        <Eye className="w-3.5 h-3.5 inline mr-1" /> {viewSubs === a._id ? 'Hide' : 'Submissions'}
                      </button>
                    </div>
                  </div>
                )}
                                {/* Submissions panel */}
                {viewSubs === a._id && (() => {
                  const gradedSubmissions = submissionsData.submitted.filter(s => s.marks !== undefined && s.marks !== null);
                  const totalGraded = gradedSubmissions.length;
                  let avgScore = 0, maxScore = 0, minScore = 0;
                  if (totalGraded > 0) {
                    const scores = gradedSubmissions.map(s => s.marks);
                    avgScore = (scores.reduce((sum, val) => sum + val, 0) / totalGraded).toFixed(1);
                    maxScore = Math.max(...scores);
                    minScore = Math.min(...scores);
                  }

                  return (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      {/* Stats Cards */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Students</span>
                          <p className="text-lg font-bold text-slate-700 mt-0.5">{submissionsData.stats.totalStudents}</p>
                        </div>
                        <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 text-center">
                          <span className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">Submitted</span>
                          <p className="text-lg font-bold text-emerald-700 mt-0.5">{submissionsData.stats.submittedCount}</p>
                        </div>
                        <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100 text-center">
                          <span className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold">Not Submitted</span>
                          <p className="text-lg font-bold text-amber-700 mt-0.5">{submissionsData.stats.unsubmittedCount}</p>
                        </div>
                      </div>

                      {totalGraded > 0 && (
                        <div className="bg-primary-50/40 p-3.5 rounded-lg border border-primary-100 flex items-center justify-between gap-4 mb-4 text-xs">
                          <div className="flex items-center gap-2 text-primary-800 font-semibold">
                            <Check className="w-4 h-4 text-primary-600" />
                            <span>Grading Analytics ({totalGraded} Graded):</span>
                          </div>
                          <div className="flex gap-4 text-primary-700">
                            <span>Average: <strong className="text-primary-900">{avgScore}</strong> marks</span>
                            <span>Highest: <strong className="text-primary-900">{maxScore}</strong> marks</span>
                            <span>Lowest: <strong className="text-primary-900">{minScore}</strong> marks</span>
                          </div>
                        </div>
                      )}

                      {/* Tab Navigation */}
                      <div className="flex border-b border-slate-100 mb-4 gap-2">
                        <button
                          type="button"
                          onClick={() => setSubTab('submitted')}
                          className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors ${subTab === 'submitted' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                          Submitted ({submissionsData.stats.submittedCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubTab('unsubmitted')}
                          className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors ${subTab === 'unsubmitted' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                          Not Submitted ({submissionsData.stats.unsubmittedCount})
                        </button>
                      </div>

                      {subTab === 'submitted' ? (
                        submissionsData.submitted.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-6">No submissions yet</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-100 text-slate-500 font-medium">
                                  <th className="text-left py-2">Student</th>
                                  <th className="text-left py-2">Submitted</th>
                                  <th className="text-left py-2">File</th>
                                  <th className="text-left py-2">Marks</th>
                                  <th className="text-left py-2">Feedback</th>
                                  <th className="text-center py-2">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {submissionsData.submitted.map(s => (
                                  <SubmissionRow
                                    key={s._id}
                                    s={s}
                                    maxMarks={a.maxMarks}
                                    onGrade={gradeSubmission}
                                    onPreview={(url, name) => setPreviewFile({ url, name })}
                                    onResubmit={handleResubmitRequest}
                                  />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      ) : (
                        submissionsData.unsubmitted.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-6">All students have submitted! 🎉</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-100 text-slate-500 font-medium">
                                  <th className="text-left py-2">Student</th>
                                  <th className="text-left py-2">Enrollment No</th>
                                  <th className="text-center py-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {submissionsData.unsubmitted.map(s => (
                                  <tr key={s.studentId._id} className="border-b border-slate-50">
                                    <td className="py-3 text-slate-800 font-medium">{s.studentId.firstName} {s.studentId.lastName}</td>
                                    <td className="py-3 text-slate-500">{s.studentId.enrollmentNo}</td>
                                    <td className="py-3 text-center">
                                      {isOverdue ? (
                                        <span className="badge-red inline-flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Overdue</span>
                                      ) : (
                                        <span className="badge-yellow inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Submission Preview</h3>
                <p className="text-xs text-slate-500 mt-0.5">Student: {previewFile.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`${previewFile.url}${previewFile.url.includes('?') ? '&' : '?'}download=1`}
                  className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 bg-white"
                >
                  Download File
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 p-4 flex items-center justify-center overflow-hidden">
              {previewFile.url.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={`${previewFile.url}#toolbar=0`}
                  title="Document Preview"
                  className="w-full h-full rounded border shadow-sm bg-white"
                />
              ) : previewFile.url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <div className="w-full h-full overflow-auto flex items-center justify-center">
                  <img
                    src={previewFile.url}
                    alt="Submission Preview"
                    className="max-w-full max-h-full object-contain rounded shadow-sm bg-white"
                  />
                </div>
              ) : (
                <div className="text-center p-8 bg-white rounded-lg border shadow-sm max-w-md">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                  <p className="font-semibold text-slate-700">Preview not available</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">This file format cannot be rendered inline. Please download it to view.</p>
                  <a href={`${previewFile.url}${previewFile.url.includes('?') ? '&' : '?'}download=1`} className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5">
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ s, maxMarks, onGrade, onPreview, onResubmit }) {
  const [marks, setMarks] = useState(s.marks ?? '');
  const [feedback, setFeedback] = useState(s.feedback || '');
  const isGraded = s.marks !== undefined && s.marks !== null && !s.resubmissionRequested;

  return (
    <tr className="border-b border-slate-50">
      <td className="py-3 text-slate-800 font-medium">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>{s.studentId?.firstName} {s.studentId?.lastName}</span>
          {s.resubmissionRequested && (
            <span className="inline-flex items-center text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 font-semibold animate-pulse">
              Resubmit Requested
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-400">{s.studentId?.enrollmentNo}</span>
      </td>
      <td className="py-3 text-slate-500 text-xs">
        {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '—'}
        {s.isLate && (
          <span className="ml-2 inline-flex items-center text-[10px] bg-red-50 text-red-700 border border-red-100 rounded px-1.5 py-0.5 font-bold">
            Late
          </span>
        )}
      </td>
      <td className="py-3">
        {s.fileUrl ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPreview(resolveAssetUrl(s.fileUrl), `${s.studentId?.firstName} ${s.studentId?.lastName}`)}
              className="text-primary-600 text-xs font-semibold hover:underline inline-flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
            <a
              href={resolveAssetDownloadUrl(s.fileUrl)}
              className="text-slate-400 hover:text-slate-600"
              title="Download file"
            >
              <Upload className="w-3.5 h-3.5 rotate-180" />
            </a>
          </div>
        ) : '—'}
      </td>
      <td className="py-3">
        <input
          type="number"
          className="input w-16 text-center text-xs py-1 disabled:bg-slate-50 disabled:text-slate-400"
          max={maxMarks}
          min={0}
          value={marks}
          onChange={e => setMarks(e.target.value)}
          placeholder="—"
          disabled={isGraded}
        />
      </td>
      <td className="py-3">
        <input
          type="text"
          className="input text-xs py-1 w-full max-w-[180px] disabled:bg-slate-50 disabled:text-slate-400"
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          placeholder="Add feedback..."
          disabled={isGraded}
        />
      </td>
      <td className="py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          {isGraded ? (
            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded text-xs font-semibold inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Graded
            </span>
          ) : (
            <button
              onClick={() => onGrade(s._id, marks, feedback)}
              className="btn-primary text-xs py-1 px-3 inline-flex items-center gap-1 font-semibold"
            >
              Grade
            </button>
          )}
          <button
            onClick={() => onResubmit(s._id, `${s.studentId?.firstName} ${s.studentId?.lastName}`, feedback)}
            disabled={isGraded}
            className="btn-secondary text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-100 text-xs py-1 px-2.5 inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:border-slate-200 disabled:text-slate-400"
            title={isGraded ? "Cannot request resubmission for graded assignment" : "Request resubmission (removes current file)"}
          >
            <Trash2 className="w-3.5 h-3.5" /> Re-request
          </button>
        </div>
      </td>
    </tr>
  );
}
