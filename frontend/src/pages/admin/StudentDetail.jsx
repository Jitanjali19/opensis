import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import { ArrowLeft, User, Pencil, Save } from 'lucide-react';

const normalizeSessionValue = (value) => {
  const session = String(value || '').trim();
  const canonicalMatch = session.match(/^(\d{4})-(\d{4})$/);
  if (canonicalMatch) return session;
  const legacyMatch = session.match(/^(\d{4})-(\d{2})$/);
  if (legacyMatch) return `${legacyMatch[1]}-${Number(legacyMatch[1]) + 1}`;
  return session;
};

const formatYearLabel = (value) => {
  const year = Number(value);
  if (year === 1) return '1st Year';
  if (year === 2) return '2nd Year';
  if (year === 3) return '3rd Year';
  if (year === 4) return '4th Year';
  return '—';
};

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5 break-all">{value || '—'}</p>
    </div>
  );
}

export default function StudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    api.get(`/admin/students/${id}`).then(r => {
      setStudent(r.data.data.student);
      setHistory(r.data.data.academicHistory || []);
    }).finally(() => setLoading(false));
  }, [id]);

  const updateHistory = async (record) => {
    setSavingId(record._id);
    try {
      const { data } = await api.patch(`/admin/students/${id}/academic-history/${record._id}`, record);
      setHistory(items => items.map(item => item._id === record._id ? data.data.academicHistory : item));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!student) return <p className="text-slate-400 text-center py-10">Student not found</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/students" className="text-slate-400 hover:text-slate-600"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold text-slate-800">Student Profile</h1>
        <Link to={`/admin/students/${id}/edit`} className="ml-auto btn-secondary flex items-center gap-2">
          <Pencil className="w-4 h-4" />Edit Details
        </Link>
      </div>

      <div className="card mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">{student.firstName} {student.lastName}</h2>
            <p className="text-slate-500 text-sm font-mono">{student.enrollmentNo}</p>
            <p className="text-slate-400 text-xs mt-0.5">{student.email || '—'}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <span className="badge-blue">{student.branch}</span>
            <span className="badge-indigo">Sem {student.currentSemester}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Personal Info</h3>
          <div className="space-y-3">
            <Field label="Email" value={student.email} />
            <Field label="Gender" value={student.gender} />
            <Field label="Date of Birth" value={student.dob ? new Date(student.dob).toLocaleDateString() : null} />
            <Field label="Phone" value={student.phone} />
            <Field label="Address" value={student.address} />
            <Field label="Father's Name" value={student.fatherName} />
            <Field label="Mother's Name" value={student.motherName} />
          </div>

        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Academic Info</h3>
          <div className="space-y-3">
            <Field label="Branch" value={student.branch} />
            <Field label="Current Semester" value={student.currentSemester} />
            <Field label="Section" value={student.section} />
            <Field label="Session" value={normalizeSessionValue(student.session)} />
            <Field label="Year" value={formatYearLabel(student.year || Math.ceil((Number(student.currentSemester) || 1) / 2))} />
            <Field label="Enrolled On" value={new Date(student.createdAt).toLocaleDateString()} />
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-700">Academic History</h3>
          <p className="text-xs text-slate-500 mt-1">Correct historical semester, year, branch, or section when needed.</p>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No history record yet. Run the academic-history backfill from the admin tools.</p>
        ) : (
          <div className="space-y-3">
            {history.map(record => (
              <div key={record._id} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end border border-slate-100 rounded-lg p-3">
                {[
                  ['session', 'Session'],
                  ['semester', 'Semester'],
                  ['year', 'Year'],
                  ['branch', 'Branch'],
                  ['section', 'Section'],
                ].map(([field, label]) => (
                  <label key={field} className="text-xs text-slate-500">
                    {label}
                    <input
                      className="input mt-1"
                      value={record[field] ?? ''}
                      onChange={e => setHistory(items => items.map(item => item._id === record._id ? { ...item, [field]: e.target.value } : item))}
                    />
                  </label>
                ))}
                <button className="btn-primary flex items-center justify-center gap-1" disabled={savingId === record._id} onClick={() => updateHistory(record)}>
                  <Save className="w-4 h-4" />Save
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
