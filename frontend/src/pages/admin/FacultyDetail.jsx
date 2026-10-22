import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import { ArrowLeft, User, Pencil } from 'lucide-react';
import { getDepartmentLabel } from '../../constants/departments';

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm text-slate-800 mt-0.5 break-all">{value || '—'}</p>
    </div>
  );
}

export default function FacultyDetail() {
  const { id } = useParams();
  const [faculty, setFaculty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/faculty/${id}`).then(r => setFaculty(r.data.data.faculty)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!faculty) return <p className="text-slate-400 text-center py-10">Faculty not found</p>;

  const assignedItems = (faculty.assignedItems && faculty.assignedItems.length > 0)
    ? faculty.assignedItems
    : (faculty.subjectsTaught || []).map(item => ({
        itemId: item._id,
        itemType: 'class',
        code: item.code,
        name: item.name,
      }));

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/faculty" className="text-slate-400 hover:text-slate-600"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold text-slate-800">Faculty Profile</h1>
        <Link to={`/admin/faculty/${id}/edit`} className="ml-auto btn-secondary flex items-center gap-2">
          <Pencil className="w-4 h-4" />Edit Details
        </Link>
      </div>

      <div className="card mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">{faculty.firstName} {faculty.lastName}</h2>
            <p className="text-slate-500 text-sm">{faculty.designation || 'Faculty'}</p>
            <p className="text-slate-400 text-xs mt-0.5">{faculty.email || '—'}</p>
          </div>
          <span className="ml-auto badge-indigo">{getDepartmentLabel(faculty.department)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Details</h3>
          <div className="space-y-3">
            <Field label="Employee ID" value={faculty.employeeId} />
            <Field label="Email" value={faculty.email} />
            <Field label="Phone" value={faculty.phone} />
            <Field label="Qualification" value={faculty.qualification} />
            <Field label="Joining Date" value={faculty.joiningDate ? new Date(faculty.joiningDate).toLocaleDateString() : null} />
            <Field label="Address" value={faculty.address} />
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-1">Subjects &amp; Labs Taught</h3>
          <p className="text-xs text-slate-400 mb-4">Current session and term</p>
          {assignedItems.length === 0 ? (
            <p className="text-slate-400 text-sm">No subjects assigned</p>
          ) : (
            <div className="space-y-2">
              {assignedItems.map(s => (
                <div key={`${s.itemType}:${s.itemId || s._id}`} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <span className={s.itemType === 'lab'
                    ? 'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'badge-blue text-xs'}>{s.code}</span>
                  <span className="text-sm text-slate-700">{s.name}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-400">{s.itemType === 'lab' ? 'Lab' : 'Theory'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
