import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { isValidPhone, PHONE_ERROR_MESSAGE } from '../../utils/phoneValidation';

const BRANCHES = ['IT', 'CSE', 'ECE', 'ME', 'CE'];
const SEMESTERS = [1,2,3,4,5,6,7,8];
const YEAR_OPTIONS = [
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
];
const normalizeSessionValue = (value) => {
  const session = String(value || '').trim();
  const canonicalMatch = session.match(/^(\d{4})-(\d{4})$/);
  if (canonicalMatch) return session;
  const legacyMatch = session.match(/^(\d{4})-(\d{2})$/);
  if (legacyMatch) return `${legacyMatch[1]}-${Number(legacyMatch[1]) + 1}`;
  return session;
};

export default function EditStudent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    api.get(`/admin/students/${id}`).then(r => {
      const s = r.data.data.student;
      setForm({
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        dob: s.dob ? s.dob.slice(0, 10) : '',
        gender: s.gender || 'female',
        phone: s.phone || '',
        address: s.address || '',
        fatherName: s.fatherName || '',
        motherName: s.motherName || '',
        branch: s.branch || 'IT',
        currentSemester: s.currentSemester || 1,
        section: s.section || '',
        year: s.year || Math.ceil((Number(s.currentSemester) || 1) / 2),
        session: normalizeSessionValue(s.session),
      });
    }).finally(() => setLoading(false));
  }, [id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidPhone(form.phone)) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }
    setPhoneError('');
    setSaving(true);
    try {
      await api.patch(`/admin/students/${id}`, form);
      toast.success('Student updated successfully!');
      navigate(`/admin/students/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/admin/students/${id}`} className="text-slate-400 hover:text-slate-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Edit Student</h1>
          <p className="text-slate-500 text-sm">Email and password cannot be changed here</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Personal Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">First Name *</label><input className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} required /></div>
            <div><label className="label">Last Name *</label><input className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} required /></div>
            <div><label className="label">Date of Birth</label><input className="input" type="date" value={form.dob} onChange={e => set('dob', e.target.value)} /></div>
            <div><label className="label">Gender</label>
              <select className="input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
              </select>
            </div>
            <div><label className="label">Phone</label><input className={`input ${phoneError ? 'border-red-500' : ''}`} inputMode="numeric" value={form.phone} onChange={e => { set('phone', e.target.value); setPhoneError(''); }} />{phoneError && <p className="text-sm text-red-600 mt-1">{phoneError}</p>}</div>
            <div><label className="label">Father's Name</label><input className="input" value={form.fatherName} onChange={e => set('fatherName', e.target.value)} /></div>
            <div><label className="label">Mother's Name</label><input className="input" value={form.motherName} onChange={e => set('motherName', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label">Address</label><textarea className="input resize-none h-16" value={form.address} onChange={e => set('address', e.target.value)} /></div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Academic Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Branch *</label>
              <select className="input" value={form.branch} onChange={e => set('branch', e.target.value)}>
                {BRANCHES.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div><label className="label">Current Semester *</label>
              <select className="input" value={form.currentSemester} onChange={e => set('currentSemester', Number(e.target.value))}>
                {SEMESTERS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="label">Section</label><input className="input" value={form.section} onChange={e => set('section', e.target.value)} /></div>
            <div><label className="label">Session</label><input className="input" value={form.session} onChange={e => set('session', e.target.value)} placeholder="2026-2027" /></div>
            <div><label className="label">Year</label>
              <select className="input" value={form.year} onChange={e => set('year', Number(e.target.value))}>
                {YEAR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          <Link to={`/admin/students/${id}`} className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
