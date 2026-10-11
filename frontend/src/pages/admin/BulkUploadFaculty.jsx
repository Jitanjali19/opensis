import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, X } from 'lucide-react';

const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'ME', 'CE', 'Mathematics', 'Physics', 'Chemistry'];

export default function BulkUploadFaculty() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [department, setDepartment] = useState('');

  const handleDepartmentChange = (e) => {
    setDepartment(e.target.value);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['.xlsx', '.xls', '.csv'];
      const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      if (!validTypes.includes(ext)) {
        toast.error('Please select a valid Excel file (.xlsx, .xls, or .csv)');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    if (!department) return toast.error('Please select a department');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('department', department);
    
    setLoading(true);
    try {
      const { data } = await api.post('/admin/faculty/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(data.data);
      toast.success(`Successfully processed ${data.data.success.length} faculty members`);
      setFile(null);
    } catch (err) {
      // axios interceptor already shows toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/faculty" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bulk Upload Faculty</h1>
          <p className="text-slate-500 text-sm">Upload an Excel file to enroll multiple faculty members at once</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card space-y-4">
            <h2 className="font-semibold text-slate-700">Upload File</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Department *</label>
              <select
                value={department}
                onChange={handleDepartmentChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select Department</option>
                {DEPARTMENTS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 hover:border-slate-300 transition-colors">
              <div className="flex flex-col items-center justify-center text-center">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <label className="cursor-pointer">
                  <span className="text-primary-600 font-medium hover:underline">Click to upload</span>
                  {' '}or drag and drop
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  {file ? file.name : 'Excel files (.xlsx, .xls, .csv) • Max 15 MB'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !file || !department}
                className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Uploading...' : 'Upload Faculty'}
              </button>
              {file && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="btn btn-secondary"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-medium mb-1">Excel Format Required:</p>
              <ul className="space-y-1 text-xs">
                <li>• Select a department above for all uploaded faculty</li>
                <li>• Columns: employeeId, fullName, email, designation, phone (optional)</li>
                <li>• Phone, when provided, must contain exactly 10 digits</li>
                <li>• If the Excel sheet has a department column, it must match the selected department</li>
                <li>• Email must be unique across all faculty</li>
                <li>• employeeId must be unique</li>
              </ul>
            </div>
          </form>

          {/* Download Sample */}
          <div className="card mt-4">
            <h3 className="font-semibold text-slate-700 mb-2">Need a sample?</h3>
            <p className="text-sm text-slate-600 mb-3">
              Download a sample Excel file to see the required format:
            </p>
            <a
              href="/docs/sample_faculty.xlsx"
              download
              className="inline-block px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded hover:bg-primary-100 transition-colors"
            >
              📥 Download Sample File (XLSX)
            </a>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-1">
          {result ? (
            <div className="card space-y-4">
              <h2 className="font-semibold text-slate-700">Results</h2>

              {/* Success Count */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium text-emerald-900">Success</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{result.success.length}</p>
                <p className="text-xs text-emerald-700 mt-1">faculty enrolled</p>
              </div>

              {/* Failed Count */}
              {result.failed.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-900">Failed</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{result.failed.length}</p>
                  <p className="text-xs text-red-700 mt-1">rows with errors</p>
                </div>
              )}

              {/* Failed Details */}
              {result.failed.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer font-medium text-sm text-slate-700 hover:text-slate-900 flex items-center gap-1">
                    <span>View Failures</span>
                  </summary>
                  <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                    {result.failed.map((f, i) => (
                      <div key={i} className="text-xs bg-red-50 border border-red-200 rounded p-2">
                        <p className="font-medium text-red-700">Row {f.row}</p>
                        <p className="text-red-600">{f.reason}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Success Details */}
              {result.success.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer font-medium text-sm text-slate-700 hover:text-slate-900">
                    View Successes
                  </summary>
                  <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                    {result.success.map((s, i) => (
                      <div key={i} className="text-xs bg-emerald-50 border border-emerald-200 rounded p-2">
                        <p className="font-medium text-emerald-700">{s.email}</p>
                        <p className="text-emerald-600 text-xs">ID: {s.employeeId}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <div className="card text-center py-8">
              <p className="text-sm text-slate-500">
                Upload a file to see results here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
