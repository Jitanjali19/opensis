import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft, BookOpen, FlaskConical } from 'lucide-react';
import { isValidPhone, PHONE_ERROR_MESSAGE } from '../../utils/phoneValidation';

const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'ME', 'CE'];

export default function EditFaculty() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const [subjectIds, setSubjectIds] = useState([]);
  const [labIds, setLabIds] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableLabs, setAvailableLabs] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingLabs, setLoadingLabs] = useState(false);
  const [teachingAssignments, setTeachingAssignments] = useState([]);
  const isInitialSubjectLoad = useRef(true);

  useEffect(() => {
    api.get(`/admin/faculty/${id}`).then(r => {
      const f = r.data.data.faculty;
      setForm({
        firstName: f.firstName || '',
        lastName: f.lastName || '',
        phone: f.phone || '',
        address: f.address || '',
        department: f.department || 'IT',
        designation: f.designation || '',
        qualification: f.qualification || '',
        joiningDate: f.joiningDate ? f.joiningDate.slice(0, 10) : '',
      });
      const assignedIds = (f.subjectsTaught || []).map(s => (typeof s === 'object' ? s._id : s));
      setSubjectIds(assignedIds);
      setLabIds((f.labsTaught || []).map(lab => (typeof lab === 'object' ? lab._id : lab)));
      api.get(`/admin/faculty/${id}/teaching-assignments`).then(r => {
        setTeachingAssignments((r.data.data.assignments || []).map(item => {
          const isLab = item.itemType === 'lab';
          const doc = isLab ? item.labId : item.subjectId;
          return {
            itemType: isLab ? 'lab' : 'class',
            subjectId: item.subjectId?._id || '',
            labId: item.labId?._id || '',
            code: doc?.code || '',
            name: doc?.name || '',
            session: item.session || '',
            term: item.term || '',
            semester: item.semester || doc?.semester || '',
            section: item.section || '',
          };
        }));
      });
    }).finally(() => setLoading(false));
  }, [id]);

  // Reload subjects when department changes; clear selection only on explicit dept change (not initial load)
  useEffect(() => {
    if (!form) return;
    if (!isInitialSubjectLoad.current) {
      setSubjectIds([]);
      setLabIds([]);
    }
    isInitialSubjectLoad.current = false;
    setLoadingSubjects(true);
    setLoadingLabs(true);
    Promise.all([
      api.get(`/admin/subjects?branch=${form.department}`).then(r => setAvailableSubjects(r.data.data.subjects)),
      api.get(`/admin/labs?branch=${form.department}`).then(r => setAvailableLabs(r.data.data.labs)),
    ]).finally(() => {
      setLoadingSubjects(false);
      setLoadingLabs(false);
    });
  }, [form?.department]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleSubject = (sid) => {
    const checked = subjectIds.includes(sid);
    if (checked) {
      setSubjectIds(prev => prev.filter(s => s !== sid));
      setTeachingAssignments(items => items.filter(x => x.itemType === 'lab' || x.subjectId !== sid));
      return;
    }
    setSubjectIds(prev => [...prev, sid]);
    const subject = availableSubjects.find(s => s._id === sid);
    if (!subject) return;
    setTeachingAssignments(items => {
      if (items.some(x => x.itemType !== 'lab' && x.subjectId === sid)) return items;
      return [...items, {
        itemType: 'class',
        subjectId: sid,
        labId: '',
        code: subject.code,
        name: subject.name,
        session: '',
        term: subject.semester % 2 === 0 ? 'january-june' : 'july-december',
        semester: subject.semester,
        section: '',
      }];
    });
  };

  const toggleLab = (labId) => {
    const checked = labIds.includes(labId);
    if (checked) {
      setLabIds(prev => prev.filter(id => id !== labId));
      setTeachingAssignments(items => items.filter(x => x.itemType !== 'lab' || x.labId !== labId));
      return;
    }
    setLabIds(prev => [...prev, labId]);
    const lab = availableLabs.find(item => item._id === labId);
    if (!lab) return;
    setTeachingAssignments(items => {
      if (items.some(x => x.itemType === 'lab' && x.labId === labId)) return items;
      return [...items, {
        itemType: 'lab',
        subjectId: '',
        labId,
        code: lab.code,
        name: lab.name,
        session: '',
        term: lab.semester % 2 === 0 ? 'january-june' : 'july-december',
        semester: lab.semester,
        section: '',
      }];
    });
  };

  const removeAssignment = (index, item) => {
    const remaining = teachingAssignments.filter((_, i) => i !== index);
    setTeachingAssignments(remaining);
    if (item.itemType === 'lab' && item.labId) {
      if (!remaining.some(x => x.itemType === 'lab' && x.labId === item.labId)) {
        setLabIds(prev => prev.filter(id => id !== item.labId));
      }
    } else if (item.subjectId) {
      if (!remaining.some(x => x.itemType !== 'lab' && x.subjectId === item.subjectId)) {
        setSubjectIds(prev => prev.filter(id => id !== item.subjectId));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidPhone(form.phone)) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }
    setPhoneError('');
    setSaving(true);
    try {
      await api.patch(`/admin/faculty/${id}`, { ...form, subjectIds, labIds });
      await api.put(`/admin/faculty/${id}/teaching-assignments`, { assignments: teachingAssignments });
      toast.success('Faculty updated successfully!');
      navigate(`/admin/faculty/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/admin/faculty/${id}`} className="text-slate-400 hover:text-slate-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Edit Faculty</h1>
          <p className="text-slate-500 text-sm">Email and Employee ID cannot be changed here</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Personal Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">First Name *</label><input className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} required /></div>
            <div><label className="label">Last Name *</label><input className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} required /></div>
            <div><label className="label">Phone</label><input className={`input ${phoneError ? 'border-red-500' : ''}`} inputMode="numeric" value={form.phone} onChange={e => { set('phone', e.target.value); setPhoneError(''); }} />{phoneError && <p className="text-sm text-red-600 mt-1">{phoneError}</p>}</div>
            <div className="sm:col-span-2"><label className="label">Address</label><textarea className="input resize-none h-16" value={form.address} onChange={e => set('address', e.target.value)} /></div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-slate-700">Session-wise Teaching Assignments</h2>
            <button type="button" className="btn-secondary text-xs" onClick={() => setTeachingAssignments(items => [...items, { itemType: 'class', subjectId: '', labId: '', session: '', term: 'july-december', semester: '', section: '' }])}>Add Assignment</button>
          </div>
          <p className="text-xs text-slate-400 mb-4">Assign different subjects and classes to this faculty for each session and term.</p>
          {teachingAssignments.length === 0 ? (
            <p className="text-sm text-slate-400">No session-wise assignments yet.</p>
          ) : (
            <div className="space-y-3">
              {teachingAssignments.map((item, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 items-end border border-slate-100 rounded-lg p-3">
                  {item.itemType === 'lab' ? (
                    <div className="text-xs text-slate-500 lg:col-span-2">
                      Lab
                      <div className="mt-1 flex h-[38px] items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3">
                        <span className="font-mono text-xs font-semibold text-emerald-700">{item.code}</span>
                        <span className="truncate text-sm text-slate-700">{item.name}</span>
                      </div>
                    </div>
                  ) : (
                    <label className="text-xs text-slate-500 lg:col-span-2">Subject
                      <select className="input mt-1" value={item.subjectId} onChange={e => {
                        const nextSubjectId = e.target.value;
                        const previousSubjectId = item.subjectId;
                        setTeachingAssignments(items => items.map((x, i) => i === index
                          ? {
                              ...x,
                              subjectId: nextSubjectId,
                              code: availableSubjects.find(s => s._id === nextSubjectId)?.code || '',
                              name: availableSubjects.find(s => s._id === nextSubjectId)?.name || '',
                              semester: availableSubjects.find(s => s._id === nextSubjectId)?.semester || x.semester,
                            }
                          : x));
                        if (previousSubjectId && previousSubjectId !== nextSubjectId) {
                          const stillUsed = teachingAssignments.some((x, i) => i !== index && x.itemType !== 'lab' && x.subjectId === previousSubjectId);
                          if (!stillUsed) setSubjectIds(prev => prev.filter(id => id !== previousSubjectId));
                        }
                        if (nextSubjectId) {
                          setSubjectIds(prev => prev.includes(nextSubjectId) ? prev : [...prev, nextSubjectId]);
                        }
                      }}>
                        <option value="">Select subject</option>
                        {availableSubjects.map(subject => <option key={subject._id} value={subject._id}>{subject.code} — {subject.name}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="text-xs text-slate-500">Session
                    <input className="input mt-1" placeholder="2026-2027" value={item.session} onChange={e => setTeachingAssignments(items => items.map((x, i) => i === index ? { ...x, session: e.target.value } : x))} />
                  </label>
                  <label className="text-xs text-slate-500">Term
                    <select className="input mt-1" value={item.term} onChange={e => setTeachingAssignments(items => items.map((x, i) => i === index ? { ...x, term: e.target.value } : x))}>
                      <option value="july-december">Jul-Dec</option>
                      <option value="january-june">Jan-Jun</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">Semester
                    <select className="input mt-1" value={item.semester} onChange={e => setTeachingAssignments(items => items.map((x, i) => i === index ? { ...x, semester: Number(e.target.value) } : x))}>
                      <option value="">Select</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(semester => <option key={semester} value={semester}>{semester}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">Section
                    <input className="input mt-1" placeholder="A" value={item.section} onChange={e => setTeachingAssignments(items => items.map((x, i) => i === index ? { ...x, section: e.target.value } : x))} />
                  </label>
                  <button type="button" className="text-xs text-rose-600 hover:text-rose-700" onClick={() => removeAssignment(index, item)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-4">Professional Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Department *</label>
              <select className="input" value={form.department} onChange={e => set('department', e.target.value)}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="label">Designation</label><input className="input" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Associate Professor" /></div>
            <div><label className="label">Qualification</label><input className="input" value={form.qualification} onChange={e => set('qualification', e.target.value)} placeholder="e.g. M.Tech, Ph.D" /></div>
            <div><label className="label">Joining Date</label><input className="input" type="date" value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} /></div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-slate-700">Assigned Subjects</h2>
            {subjectIds.length > 0 && (
              <span className="ml-auto text-xs bg-primary-100 text-primary-700 font-semibold px-2 py-0.5 rounded-full">
                {subjectIds.length} selected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Showing subjects from <strong>{form.department}</strong>. Change department above to see others.
          </p>

          {loadingSubjects ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : availableSubjects.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No subjects found for {form.department}.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {availableSubjects.map(s => {
                const checked = subjectIds.includes(s._id);
                const otherFaculty = s.facultyId && String(s.facultyId._id || s.facultyId) !== id && !checked;
                return (
                  <label
                    key={s._id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      checked
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary-600 w-4 h-4 shrink-0"
                      checked={checked}
                      onChange={() => toggleSubject(s._id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary-600">{s.code}</span>
                        <span className="text-sm font-medium text-slate-700 truncate">{s.name}</span>
                        <span className="text-xs text-slate-400 ml-auto shrink-0">Sem {s.semester} · {s.credits} cr.</span>
                      </div>
                      {otherFaculty && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Currently: {s.facultyId.firstName} {s.facultyId.lastName}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-slate-700">Assigned Labs</h2>
            {labIds.length > 0 && (
              <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                {labIds.length} selected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Showing labs from <strong>{form.department}</strong>. Change department above to see others.
          </p>

          {loadingLabs ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : availableLabs.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No labs found for {form.department}.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {availableLabs.map(lab => {
                const checked = labIds.includes(lab._id);
                const otherFaculty = lab.facultyId && String(lab.facultyId._id || lab.facultyId) !== id && !checked;
                return (
                  <label key={lab._id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                    <input type="checkbox" className="accent-primary-600 w-4 h-4 shrink-0" checked={checked} onChange={() => toggleLab(lab._id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-emerald-600">{lab.code}</span>
                        <span className="text-sm font-medium text-slate-700 truncate">{lab.name}</span>
                        <span className="text-xs text-slate-400 ml-auto shrink-0">Sem {lab.semester} · {lab.credits} cr.</span>
                      </div>
                      {otherFaculty && <p className="text-xs text-amber-600 mt-0.5">Currently: {lab.facultyId.firstName} {lab.facultyId.lastName}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          <Link to={`/admin/faculty/${id}`} className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
