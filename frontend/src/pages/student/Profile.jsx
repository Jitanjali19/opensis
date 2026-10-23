import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { User, Save, Mail, Phone, MapPin, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { isValidPhone, PHONE_ERROR_MESSAGE } from '../../utils/phoneValidation';
import { getDepartmentLabel } from '../../constants/departments';

export default function StudentProfile() {
  const { user, selectedSession, selectedTerm } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ personalEmail: '', phone: '', address: '', gender: '', dob: '' });
  const [errors, setErrors] = useState({}); // Validation error messages
  const [profilePreview, setProfilePreview] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [profileFile, setProfileFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Helper function to format date to YYYY-MM-DD for date input
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  };

  // Helper function to validate email format
  const validateEmail = (email) => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Helper function to validate phone number
  const validatePhone = (phone) => {
    return isValidPhone(phone);
  };

  // Helper function to calculate age
  const calculateAge = (dob) => {
    if (!dob) return 0;
    const dobDate = new Date(dob);
    return Math.floor((new Date() - dobDate) / (365.25 * 24 * 60 * 60 * 1000));
  };

  // Helper function to validate DOB
  const validateDOB = (dob) => {
    if (!dob) return true;
    const age = calculateAge(dob);
    return age >= 15 && age <= 100;
  };

  const formatYearLabel = (value) => {
    const year = Number(value);
    if (year === 1) return '1st Year';
    if (year === 2) return '2nd Year';
    if (year === 3) return '3rd Year';
    if (year === 4) return '4th Year';
    return '—';
  };

  useEffect(() => {
    let active = true;
    api.get('/student/profile').then(r => {
      if (!active) return;
      setProfile(r.data.data.student);
      const s = r.data.data.student;
      setForm({
        personalEmail: s.personalEmail || (r.data.data.student.userEmail || ''),
        phone: s.phone || '',
        address: s.address || '',
        gender: s.gender || '',
        dob: formatDateForInput(s.dob),
      });
      setProfilePreview(s.profilePhotoUrl || null);
      setSignaturePreview(s.signatureUrl || null);
    }).catch(() => { if (active) toast.error('Failed to load profile'); });
    return () => { active = false; };
  }, [selectedSession, selectedTerm]);

  // Frontend validation before submit
  const validateForm = () => {
    const newErrors = {};

    if (!validateEmail(form.personalEmail)) {
      newErrors.personalEmail = 'Please enter a valid email address';
    }

    if (!validatePhone(form.phone)) {
      newErrors.phone = PHONE_ERROR_MESSAGE;
    }

    if (form.dob && !validateDOB(form.dob)) {
      const age = calculateAge(form.dob);
      if (age < 15) {
        newErrors.dob = 'You must be at least 15 years old';
      } else {
        newErrors.dob = 'Please enter a valid date of birth';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    // Run validation first
    if (!validateForm()) {
      toast.error('Please fix validation errors');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.keys(form).forEach(k => {
        if (form[k] !== undefined && form[k] !== '') {
          fd.append(k, form[k]);
        }
      });
      if (profileFile) fd.append('profilePhoto', profileFile);
      if (signatureFile) fd.append('signature', signatureFile);

      const { data } = await api.patch('/student/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile(data.data.student);
      setEditing(false);
      setErrors({});
      toast.success('Profile updated successfully');
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to update profile';
      setErrors({ submit: errorMsg });
      toast.error(errorMsg);
    }
    setSaving(false);
  };

  if (!profile) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">View and manage your personal information</p>
      </div>

      {/* Global validation error */}
      {errors.submit && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errors.submit}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="card flex flex-col items-center text-center">
          {profile.profilePhotoUrl ? (
            <img src={profile.profilePhotoUrl} alt="profile" className="w-20 h-20 object-cover rounded-full mb-4" />
          ) : (
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-primary-600" />
            </div>
          )}
          <h2 className="text-lg font-bold text-slate-800">{profile.firstName} {profile.lastName}</h2>
          <p className="text-sm text-slate-500">{profile.enrollmentNo}</p>
          <div className="mt-3 space-y-1 text-sm text-slate-500">
            <p>{getDepartmentLabel(profile.branch)} · Semester {profile.currentSemester}</p>
            <p>Section {profile.section && profile.section !== 'N/A' ? profile.section : '—'}</p>
            <p>Session: {profile.session && profile.session !== 'N/A' ? profile.session : '—'}</p>
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-slate-800">Personal Details</h2>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn-primary text-xs">Edit</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setErrors({}); }} className="btn-secondary text-xs">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">
                  <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Personal Email */}
            <div>
              <label className="label flex items-center gap-1"><Mail className="w-3 h-3" /> Personal Email</label>
              {editing ? (
                <div>
                  <input
                    className={`input ${errors.personalEmail ? 'border-red-500' : ''}`}
                    type="email"
                    value={form.personalEmail}
                    onChange={e => setForm({ ...form, personalEmail: e.target.value })}
                    placeholder="your.email@example.com"
                  />
                  {errors.personalEmail && <p className="text-xs text-red-600 mt-1">{errors.personalEmail}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{form.personalEmail || profile.userEmail || '—'}</p>
              )}
            </div>

            {/* First Name (Read-only) */}
            <div>
              <label className="label">First Name</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.firstName}</p>
            </div>

            {/* Last Name (Read-only) */}
            <div>
              <label className="label">Last Name</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.lastName}</p>
            </div>

            {/* Enrollment No (Read-only) */}
            <div>
              <label className="label">Enrollment No</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.enrollmentNo}</p>
            </div>

            {/* Gender */}
            <div>
              <label className="label">Gender</label>
              {editing ? (
                <select className="input" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              ) : (
                <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg capitalize">{profile.gender || '—'}</p>
              )}
            </div>

            {/* Date of Birth (Editable with date picker) */}
            <div>
              <label className="label">Date of Birth</label>
              {editing ? (
                <div>
                  <input
                    type="date"
                    className={`input ${errors.dob ? 'border-red-500' : ''}`}
                    value={form.dob}
                    onChange={e => setForm({ ...form, dob: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {errors.dob && <p className="text-xs text-red-600 mt-1">{errors.dob}</p>}
                  {form.dob && !errors.dob && (
                    <p className="text-xs text-slate-500 mt-1">Age: {calculateAge(form.dob)} years</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">
                  {profile.dob ? new Date(profile.dob).toLocaleDateString() : '—'}
                </p>
              )}
            </div>

            {/* Year (Read-only) */}
            <div>
              <label className="label">Year</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">
                {formatYearLabel(profile.year || Math.ceil((Number(profile.currentSemester) || 1) / 2))}
              </p>
            </div>

            {/* Father's Name (Read-only) */}
            <div>
              <label className="label">Father's Name</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.fatherName || '—'}</p>
            </div>

            {/* Mother's Name (Read-only) */}
            <div>
              <label className="label">Mother's Name</label>
              <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.motherName || '—'}</p>
            </div>

            {/* Phone */}
            <div>
              <label className="label flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</label>
              {editing ? (
                <div>
                  <input
                    className={`input ${errors.phone ? 'border-red-500' : ''}`}
                    value={form.phone}
                    inputMode="numeric"
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                  />
                  {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.phone || '—'}</p>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="label flex items-center gap-1"><MapPin className="w-3 h-3" /> Address</label>
              {editing ? (
                <input
                  className="input"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="Your full address"
                />
              ) : (
                <p className="text-sm text-slate-800 bg-slate-50 px-3 py-2 rounded-lg">{profile.address || '—'}</p>
              )}
            </div>

            {/* Profile Photo Upload */}
            <div className="sm:col-span-2">
              <label className="label">Profile Photo</label>
              {editing ? (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Please upload a formal passport-size photograph only (JPG/PNG, max 5MB).</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={e => {
                        const f = e.target.files[0];
                        if (!f) return;
                        if (f.size > 5 * 1024 * 1024) {
                          toast.error('File size must be less than 5MB');
                          return;
                        }
                        setProfileFile(f);
                        setProfilePreview(URL.createObjectURL(f));
                      }}
                    />
                    {profilePreview && <img src={profilePreview} alt="preview" className="w-20 h-20 object-cover rounded" />}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {profile.profilePhotoUrl ? (
                    <img src={profile.profilePhotoUrl} alt="profile" className="w-20 h-20 object-cover rounded" />
                  ) : (
                    <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-8 h-8 text-primary-600" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Signature Upload */}
            <div className="sm:col-span-2">
              <label className="label">Signature</label>
              {editing ? (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Upload your digital signature (JPG/PNG).</p>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={e => {
                      const f = e.target.files[0];
                      if (!f) return;
                      if (f.size > 5 * 1024 * 1024) {
                        toast.error('File size must be less than 5MB');
                        return;
                      }
                      setSignatureFile(f);
                      setSignaturePreview(URL.createObjectURL(f));
                    }}
                  />
                  {signaturePreview && <img src={signaturePreview} alt="signature" className="h-12 object-contain mt-2" />}
                </div>
              ) : (
                <div>
                  {profile.signatureUrl ? <img src={profile.signatureUrl} alt="signature" className="h-12 object-contain" /> : <p className="text-sm text-slate-500">—</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
