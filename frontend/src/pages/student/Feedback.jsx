import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { MessageSquare, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDepartmentLabel } from '../../constants/departments';

const initialRatings = { knowledge: 0, clarity: 0, punctuality: 0, interaction: 0, doubtSolving: 0, fairness: 0 };
const ratingLabels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
const ratingFields = [
  ['knowledge', 'Subject knowledge'],
  ['clarity', 'Clarity of explanation'],
  ['punctuality', 'Punctuality'],
  ['interaction', 'Class interaction'],
  ['doubtSolving', 'Doubt solving'],
  ['fairness', 'Fairness and respect'],
];

export default function StudentFeedback() {
  const [options, setOptions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [myFeedback, setMyFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('submit');
  const [form, setForm] = useState({ facultyId: '', subjectId: '', ratings: initialRatings, comments: '' });
  const [editingId, setEditingId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(true);
  const allRatingsSelected = Object.values(form.ratings).every(rating => rating >= 1 && rating <= 5);

  const load = () => Promise.all([
    api.get('/student/feedback/options').then(r => {
      setOptions(r.data.data.subjects || []);
      setProfile(r.data.data.student);
      setFeedbackOpen(r.data.data.feedbackOpen !== false);
    }),
    api.get('/student/feedback').then(r => setMyFeedback(r.data.data.feedback || [])),
  ]).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subjectId || !form.facultyId) return toast.error('Select a subject and faculty');
    if (!allRatingsSelected) return toast.error('Please rate every area before submitting');
    setSubmitting(true);
    try {
      if (editingId) {
        await api.patch(`/student/feedback/${editingId}`, form);
        toast.success('Feedback updated');
      } else {
        await api.post('/student/feedback', form);
        toast.success('Feedback submitted');
      }
      setEditingId('');
      setForm({ facultyId: '', subjectId: '', ratings: initialRatings, comments: '' });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const subjectOptions = [...new Map(options.map(item => [String(item._id), item])).values()];
  const facultyOptions = options
    .filter(item => String(item._id) === String(form.subjectId) && item.facultyId)
    .map(item => ({ ...item.facultyId, alreadySubmitted: item.alreadySubmitted }));

  const RatingInput = ({ label, value, onChange, disabled }) => (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        <span className={`text-[11px] font-medium ${disabled ? 'text-slate-300' : 'text-slate-400'}`}>{value ? `${value}/5` : 'Not rated'}</span>
      </div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" disabled={disabled} title={ratingLabels[n - 1]} aria-label={`${n} - ${ratingLabels[n - 1]}`} onClick={() => onChange(n)} className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all ${n === value ? 'border-primary-600 bg-primary-600 text-white shadow-sm' : disabled ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300' : 'border-slate-300 bg-white text-slate-600 hover:border-primary-500 hover:text-primary-700'}`}>
            {n}
          </button>
        ))}
        <span className={`ml-1 text-xs ${disabled ? 'text-slate-300' : 'text-slate-400'}`}>{value ? ratingLabels[value - 1] : 'Select a faculty member first'}</span>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-7 overflow-hidden rounded-2xl bg-[#151923] p-6 text-white shadow-lg shadow-slate-200">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white"><MessageSquare className="w-6 h-6" /></div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-sgsits-gold-400">Student voice</p>
            <h1 className="text-2xl font-bold">Faculty Feedback</h1>
            <p className="mt-1 text-sm text-slate-300">Help us improve teaching and learning at SGSITS.</p>
          </div>
        </div>
        {profile && <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-slate-200">
          {[`${getDepartmentLabel(profile.branch)} Department`, `Semester ${profile.semester}`, `Session ${profile.session}`].map(item => <span key={item} className="rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/10">{item}</span>)}
        </div>}
      </div>

      <div className="mb-6 inline-flex rounded-lg bg-slate-100 p-1">
        <button onClick={() => setTab('submit')} className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === 'submit' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>Give feedback</button>
        <button onClick={() => setTab('history')} className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === 'history' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>Submitted feedback</button>
      </div>

      {tab === 'submit' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4">
            <h2 className="font-bold text-slate-800">Review a faculty member</h2>
            <p className="mt-1 text-xs text-slate-500">Your feedback is linked to the selected subject and faculty member.</p>
          </div>
          <div className="p-6">
          {!feedbackOpen && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Feedback is currently closed by the administration.</div>}
          {loading ? <p className="text-slate-500">Loading your subjects...</p> : (
            <form onSubmit={handleSubmit} className={`space-y-6 ${!feedbackOpen ? 'pointer-events-none opacity-60' : ''}`}>
              <div>
                <label className="label">1. Select subject <span className="text-rose-500">*</span></label>
                <select className="input" required value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value, facultyId: '', ratings: initialRatings, comments: '' })}>
                  <option value="">Choose the subject you want to review</option>
                  {subjectOptions.map(subject => <option key={subject._id} value={subject._id}>{subject.code} — {subject.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">2. Select faculty <span className="text-rose-500">*</span></label>
                <select className="input" required value={form.facultyId} disabled={!form.subjectId} onChange={e => setForm({ ...form, facultyId: e.target.value, ratings: initialRatings, comments: '' })}>
                  <option value="">{form.subjectId ? 'Choose the faculty member' : 'Select a subject first'}</option>
                  {facultyOptions.map(faculty => <option key={faculty._id} value={faculty._id} disabled={faculty.alreadySubmitted}>{faculty.firstName} {faculty.lastName}{faculty.alreadySubmitted ? ' (Submitted)' : ''}</option>)}
                </select>
              </div>
              <div className="border-t border-slate-100 pt-6">
                <h2 className="font-semibold text-slate-800 mb-1">{editingId ? 'Edit your feedback' : '3. Rate your faculty member'}</h2>
                <p className="text-xs text-slate-500 mb-4">{form.facultyId ? 'Choose one rating for each area.' : 'Select a faculty member above to enable ratings.'}</p>
                <div className={`grid gap-x-8 sm:grid-cols-2 ${!form.facultyId ? 'rounded-xl bg-slate-50 px-4' : ''}`}>
                  {ratingFields.map(([key, label]) => <RatingInput key={key} label={label} value={form.ratings[key]} disabled={!form.facultyId} onChange={v => setForm({ ...form, ratings: { ...form.ratings, [key]: v } })} />)}
                </div>
              </div>
              <div><label className="label">Additional comments <span className="font-normal text-slate-400">(optional)</span></label><textarea className="input min-h-[100px]" disabled={!form.facultyId} maxLength={1000} value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} placeholder={form.facultyId ? 'Share constructive feedback about this faculty member...' : 'Select a faculty member first'} /></div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-5">
                <p className="text-xs text-slate-400">All ratings are required.</p>
                <button type="submit" disabled={submitting || !form.subjectId || !form.facultyId || !allRatingsSelected} className="btn-primary"><Send className="w-4 h-4" /> {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Submit feedback'}</button>
              </div>
            </form>
          )}
          </div>
        </div>
      )}

      {tab === 'history' && (myFeedback.length === 0 ? (
        <div className="card text-center py-12"><MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No feedback submitted yet</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{myFeedback.map(item => (
          <div key={item._id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">{item.subjectId?.code}</span>
                <h3 className="mt-1 font-semibold text-slate-800">{item.subjectId?.name}</h3>
                <p className="mt-1 text-sm text-slate-500">Prof. {item.facultyId?.firstName} {item.facultyId?.lastName}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-slate-400">{new Date(item.submittedAt || item.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ['Knowledge', item.ratings?.knowledge],
                ['Clarity', item.ratings?.clarity],
                ['Punctuality', item.ratings?.punctuality],
                ['Interaction', item.ratings?.interaction],
                ['Doubt solving', item.ratings?.doubtSolving],
                ['Fairness', item.ratings?.fairness],
              ].map(([label, rating]) => (
                <span key={label} className="rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                  {label} <strong className="text-slate-800">{rating}/5</strong>
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400 capitalize">Status: {String(item.status || 'submitted').replace('_', ' ')}</p>
            {item.status === 'submitted' && feedbackOpen && <button type="button" className="mt-3 text-xs font-semibold text-primary-600 hover:underline" onClick={() => { setEditingId(item._id); setForm({ subjectId: item.subjectId?._id || '', facultyId: item.facultyId?._id || '', ratings: item.ratings || initialRatings, comments: item.comments || '' }); setTab('submit'); }}>Edit feedback</button>}
            {item.comments && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm italic text-slate-600">“{item.comments}”</p>}
          </div>
        ))}</div>
      ))}
    </div>
  );
}
