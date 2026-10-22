import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, X, Download } from 'lucide-react';

function DeleteModal({ name, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Delete Faculty</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          Are you sure you want to delete <span className="font-semibold text-slate-800">{name}</span>? This will also remove their login access. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onConfirm} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 px-4 rounded-xl disabled:opacity-60">
            {loading ? 'Deleting...' : 'Yes, Delete'}
          </button>
          <button onClick={onCancel} className="flex-1 btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminFaculty() {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [filterApplied, setFilterApplied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const requestId = useRef(0);

  const load = (dept = department, searchTerm = search) => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    const params = new URLSearchParams();
    if (dept) params.set('department', dept);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    api.get(`/admin/faculty?${params}`)
      .then(r => {
        if (currentRequestId === requestId.current) setFaculty(r.data.data.faculty);
      })
      .catch(err => {
        if (currentRequestId === requestId.current) {
          toast.error(err.response?.data?.message || 'Failed to load faculty');
        }
      })
      .finally(() => {
        if (currentRequestId === requestId.current) setLoading(false);
      });
  };

  const handleDepartmentChange = (value) => {
    setDepartment(value);
  };

  useEffect(() => {
    const hasFilter = department || search.trim();
    if (hasFilter) {
      setFilterApplied(true);
      load(department, search);
    } else {
      requestId.current += 1;
      setFilterApplied(false);
      setFaculty([]);
      setLoading(false);
    }
  }, [department, search]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/faculty/${deleteTarget._id}`);
      toast.success('Faculty deleted');
      setDeleteTarget(null);
      load(department, search);
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (department) params.set('department', department);
      if (search.trim()) params.set('search', search.trim());
      
      const response = await api.get(`/admin/faculty/export?${params}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `faculty_export_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel file downloaded');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {deleteTarget && (
        <DeleteModal
          name={`${deleteTarget.firstName} ${deleteTarget.lastName}`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Faculty</h1>
          <p className="text-slate-500 text-sm">{faculty.length} members</p>
        </div>
        <Link to="/admin/enroll-faculty" className="btn-primary"><Plus className="w-4 h-4" />Enroll Faculty</Link>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search name, employee ID or email"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-auto" value={department} onChange={e => handleDepartmentChange(e.target.value)}>
            <option value="">— Select Department —</option>
            <option>IT</option><option>CSE</option><option>ECE</option><option>ME</option><option>CE</option>
          </select>
          <button 
            onClick={handleExportExcel} 
            disabled={exporting || faculty.length === 0}
            className="btn-secondary flex items-center gap-2 py-2 px-4 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Employee ID', 'Name', 'Email', 'Department', 'Designation', 'Subjects & Labs', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!filterApplied ? (
                <tr><td colSpan={7} className="text-center py-14 text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">🔍</span>
                    <p className="font-medium text-slate-500">Select a department to view faculty</p>
                    <p className="text-xs text-slate-400">Choose a department from the filter above</p>
                  </div>
                </td></tr>
              ) : loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : faculty.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No faculty found</td></tr>
              ) : (
                faculty.map(f => (
                  <tr key={f._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{f.employeeId}</td>
                    <td className="px-4 py-3 font-medium">{f.firstName} {f.lastName}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{f.email || '—'}</td>
                    <td className="px-4 py-3"><span className="badge-indigo">{f.department || '—'}</span></td>
                    <td className="px-4 py-3 text-slate-600">{f.designation || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{f.assignedCount ?? (f.subjectsTaught?.length || 0)} assigned</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link to={`/admin/faculty/${f._id}`} className="text-primary-600 hover:underline text-xs">View</Link>
                        <Link to={`/admin/faculty/${f._id}/edit`} className="text-slate-500 hover:text-slate-700" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => setDeleteTarget(f)} className="text-red-400 hover:text-red-600" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
