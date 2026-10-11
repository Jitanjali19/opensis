import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { isValidPhone, PHONE_ERROR_MESSAGE } from '../../utils/phoneValidation';

const BRANCHES = ['IT', 'CSE', 'ECE', 'ME', 'CE'];
const SEMESTERS = [1,2,3,4,5,6,7,8];
const YEAR_OPTIONS = [
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
];
const DEFAULT_SESSION = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

export default function EnrollStudent() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '', password: '', enrollmentNo: '', firstName: '', lastName: '',
    branch: 'IT', currentSemester: 1, section: 'A', year: 1,
    session: DEFAULT_SESSION, gender: 'female', phone: '', fatherName: '', motherName: '', address: '', dob: '',
  });
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.edu$/.test(email);

  const handleEmailChange = (e) => {
    const email = e.target.value;
    set('email', email);

    if (email && !isValidEmail(email)) {
      setEmailError('Enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (form.email && !isValidEmail(form.email)) {
      setEmailError('Enter a valid email address');
      return;
    }
    if (!isValidPhone(form.phone)) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }
    setPhoneError('');

    setLoading(true);
    try {
      await api.post('/admin/students', form);
      toast.success('Student enrolled successfully!');
      navigate('/admin/students');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/students" className="text-slate-400 hover:text-slate-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Enroll Student</h1>
          <p className="text-slate-500 text-sm">Add a new student to the system</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Login Credentials</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Email *</label>
              <input 
                className={`input ${emailError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                type="email" 
                value={form.email} 
                onChange={handleEmailChange}
                placeholder="student@college.edu"
                required 
              />
              {emailError && (
                <p className="text-sm font-medium text-red-600 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {emailError}
                </p>
              )}
            </div>
            <div><label className="label">Password</label><input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Default: Student@123" /></div>
          </div>
        </div>

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
            <div><label className="label">Enrollment No. *</label><input className="input font-mono" value={form.enrollmentNo} onChange={e => set('enrollmentNo', e.target.value)} required placeholder="0801IT221001" /></div>
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
            <div><label className="label">Year</label>
              <select className="input" value={form.year} onChange={e => set('year', Number(e.target.value))}>
                {YEAR_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div><label className="label">Session</label><input className="input" value={form.session} onChange={e => set('session', e.target.value)} placeholder="2026-2027" /></div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Enrolling...' : 'Enroll Student'}</button>
          <Link to="/admin/students" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
