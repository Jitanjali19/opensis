import React, { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Camera, Save, User, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { isValidPhone, PHONE_ERROR_MESSAGE } from '../../utils/phoneValidation';
import { getDepartmentLabel } from '../../constants/departments';

const GENDER_OPTIONS = [
  { value: '', label: 'Select gender' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resolveAssetUrl = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
  return `${base}${value}`;
};

const toDateInputValue = (value) => {
  if (!value) return '';
  try {
    return format(parseISO(value), 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

const todayValue = new Date().toISOString().split('T')[0];

export default function FacultyProfile() {
  const { user, setUser } = useAuth();
  const joinDateRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [form, setForm] = useState({
    email: '',
    phone: '',
    address: '',
    gender: '',
    qualification: '',
    experience: '',
    joiningDate: '',
  });

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const response = await api.get('/faculty/profile');
        if (!active) return;

        const faculty = response.data.data.faculty;
        setProfile(faculty);
        setForm({
          email: faculty.userId?.email || user?.email || '',
          phone: faculty.phone || '',
          address: faculty.address || '',
          gender: faculty.gender || '',
          qualification: faculty.qualification || '',
          experience: faculty.experience ?? '',
          joiningDate: toDateInputValue(faculty.joiningDate),
        });
        setPhotoPreview(resolveAssetUrl(faculty.profilePhotoUrl));
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load profile');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [user?.email]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const setField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const openDatePicker = () => {
    const input = joinDateRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
    input.click();
  };

  const handlePhoto = (file) => {
    if (!file) return;
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const nextErrors = {};
    if (!isValidPhone(form.phone)) nextErrors.phone = PHONE_ERROR_MESSAGE;

    if (!form.email || !EMAIL_REGEX.test(form.email.trim().toLowerCase())) {
      nextErrors.email = 'Enter a valid email address';
    }

    if (!form.joiningDate) {
      nextErrors.joiningDate = 'Joining date is required';
    } else if (form.joiningDate > todayValue) {
      nextErrors.joiningDate = 'Joining date cannot be in the future';
    }

    if (form.experience !== '' && (Number.isNaN(Number(form.experience)) || Number(form.experience) < 0)) {
      nextErrors.experience = 'Experience must be a non-negative number';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix the highlighted fields');
      return;
    }

    const payload = new FormData();
    payload.append('email', form.email.trim().toLowerCase());
    payload.append('phone', form.phone);
    payload.append('address', form.address);
    payload.append('gender', form.gender);
    payload.append('qualification', form.qualification);
    payload.append('experience', form.experience === '' ? '' : String(form.experience));
    payload.append('joiningDate', form.joiningDate);

    if (photoFile) payload.append('profilePhoto', photoFile);

    setSaving(true);
    try {
      const { data } = await api.patch('/faculty/profile', payload);
      const updated = data.data.faculty;
      setProfile(updated);
      setEditing(false);
      setPhotoFile(null);
      setPhotoPreview(resolveAssetUrl(updated.profilePhotoUrl));
      setForm({
        email: updated.userId?.email || updated.email || form.email,
        phone: updated.phone || '',
        address: updated.address || '',
        gender: updated.gender || '',
        qualification: updated.qualification || '',
        experience: updated.experience ?? '',
        joiningDate: toDateInputValue(updated.joiningDate),
      });
      setUser(prev => prev ? { ...prev, email: updated.userId?.email || form.email } : prev);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (profile) {
      setForm({
        email: profile.userId?.email || user?.email || '',
        phone: profile.phone || '',
        address: profile.address || '',
        gender: profile.gender || '',
        qualification: profile.qualification || '',
        experience: profile.experience ?? '',
        joiningDate: toDateInputValue(profile.joiningDate),
      });
      setPhotoPreview(resolveAssetUrl(profile.profilePhotoUrl));
    }
    setErrors({});
    setPhotoFile(null);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card max-w-2xl mx-auto text-center py-12">
        <p className="text-slate-600">Profile data could not be loaded.</p>
      </div>
    );
  }

  const emailLabel = profile.userId?.email || user?.email || '—';
  const joiningDateLabel = profile.joiningDate ? format(parseISO(profile.joiningDate), 'PPP') : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
          <p className="text-slate-500 text-sm mt-1">Edit your profile details in one form. Locked fields are shown as disabled.</p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="btn-primary text-xs self-start sm:self-auto">Edit Profile</button>
        ) : (
          <div className="flex gap-2 self-start sm:self-auto">
            <button onClick={cancelEdit} className="btn-secondary text-xs">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">
              <Save className="w-3 h-3" /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:sticky xl:top-6 h-fit space-y-5">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-primary-50 border border-primary-100 overflow-hidden flex items-center justify-center shadow-sm">
              {photoPreview ? <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-primary-600" />}
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-800">{profile.firstName} {profile.lastName}</h2>
            <p className="text-sm text-slate-500">{profile.employeeId}</p>
            <div className="mt-3 text-sm text-slate-600 space-y-1">
              <p>{getDepartmentLabel(profile.department) || '—'} Department</p>
              <p>{profile.designation || '—'}</p>
              <p>{profile.qualification || '—'}</p>
            </div>
          </div>

          {profile.subjectsTaught?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Subjects</p>
              <div className="flex flex-wrap gap-2">
                {profile.subjectsTaught.map(subject => (
                  <span key={subject._id} className="badge-indigo text-xs">{subject.code}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="xl:col-span-2">
          <div className="card space-y-6">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary-600" />
              <h2 className="font-semibold text-slate-800">Profile Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Employee ID</label>
                <input className="input bg-slate-50 text-slate-500" value={profile.employeeId} readOnly disabled />
              </div>

              <div>
                <label className="label flex items-center gap-2"><Mail className="w-3 h-3" />Email</label>
                <input
                  type="email"
                  className={`input ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  placeholder="name@example.com"
                  disabled={!editing}
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="label">Department</label>
                <input className="input bg-slate-50 text-slate-500" value={getDepartmentLabel(profile.department)} readOnly disabled />
              </div>

              <div>
                <label className="label">Designation</label>
                <input className="input bg-slate-50 text-slate-500" value={profile.designation || ''} readOnly disabled />
              </div>

              <div>
                <label className="label flex items-center gap-2"><Phone className="w-3 h-3" />Phone Number</label>
                <input
                className={`input ${errors.phone ? 'border-red-500' : ''}`}
                  value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                  placeholder="Enter phone number"
                  inputMode="numeric"
                  disabled={!editing}
                />
                {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={e => setField('gender', e.target.value)} disabled={!editing}>
                  {GENDER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="label flex items-center gap-2"><MapPin className="w-3 h-3" />Address</label>
                <textarea
                  className="input resize-none h-24"
                  value={form.address}
                  onChange={e => setField('address', e.target.value)}
                  placeholder="Enter your address"
                  disabled={!editing}
                />
              </div>

              <div>
                <label className="label">Qualification</label>
                <input
                  className="input"
                  value={form.qualification}
                  onChange={e => setField('qualification', e.target.value)}
                  placeholder="e.g. M.Tech, Ph.D"
                  disabled={!editing}
                />
              </div>

              <div>
                <label className="label">Experience (Years)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={`input ${errors.experience ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                  value={form.experience}
                  onChange={e => setField('experience', e.target.value)}
                  placeholder="Enter years of experience"
                  disabled={!editing}
                />
                {errors.experience && <p className="mt-1 text-xs text-red-600">{errors.experience}</p>}
              </div>

              <div>
                <label className="label flex items-center gap-2"><CalendarDays className="w-3 h-3" />Joining Date</label>
                <div className="relative">
                  <input
                    ref={joinDateRef}
                    type="date"
                    className={`input pr-11 ${errors.joiningDate ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                    value={form.joiningDate}
                    onChange={e => setField('joiningDate', e.target.value)}
                    onKeyDown={e => e.preventDefault()}
                    onClick={openDatePicker}
                    onFocus={openDatePicker}
                    max={todayValue}
                    disabled={!editing}
                  />
                  <button
                    type="button"
                    onClick={openDatePicker}
                    disabled={!editing}
                    className="absolute inset-y-0 right-2 my-auto h-8 w-8 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    aria-label="Open calendar"
                  >
                    <CalendarDays className="w-4 h-4 mx-auto" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">Use the calendar picker only. Future dates are blocked.</p>
                {errors.joiningDate && <p className="mt-1 text-xs text-red-600">{errors.joiningDate}</p>}
              </div>

              <div className="sm:col-span-2 rounded-2xl border border-dashed border-slate-300 p-4 bg-slate-50/60">
                <label className="label">Profile Photo</label>
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
                    {photoPreview ? <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-slate-400" />}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700 hover:file:bg-primary-100"
                      onChange={e => handlePhoto(e.target.files?.[0])}
                      disabled={!editing}
                    />
                    <p className="mt-2 text-xs text-slate-400">PNG, JPG, or JPEG up to 10 MB.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
