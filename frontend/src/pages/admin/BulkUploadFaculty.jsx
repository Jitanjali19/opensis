import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, X, Download, FileSpreadsheet, Check, Info } from 'lucide-react';

const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'ME', 'CE', 'Mathematics', 'Physics', 'Chemistry'];

export default function BulkUploadFaculty() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [department, setDepartment] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleDepartmentChange = (e) => {
    setDepartment(e.target.value);
  };

  const handleFileChange = (e) => {
    acceptFile(e.target.files?.[0]);
  };

  const acceptFile = selectedFile => {
    if (!selectedFile) return;
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) return toast.error('Please choose an Excel or CSV file (.xlsx, .xls, or .csv).');
    if (selectedFile.size > 15 * 1024 * 1024) return toast.error('This file is larger than 15 MB. Please choose a smaller file.');
    setFile(selectedFile);
  };

  const handleDrop = e => {
    e.preventDefault();
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    if (!department) return toast.error('Please select a department');
    setShowConfirmation(true);
  };

  const uploadFaculty = async () => {
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
      setShowConfirmation(false);
    } catch (err) {
      // axios interceptor already shows toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start gap-3">
        <Link to="/admin/faculty" className="mt-1 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Back to faculty">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Add many faculty members at once</h1>
          <p className="mt-1 text-sm text-slate-500">Use a prepared Excel or CSV file to create multiple faculty records safely.</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="mb-4 flex items-center gap-2"><Info className="h-5 w-5 text-primary-600" /><div><h2 className="font-semibold text-slate-800">Follow these 4 steps</h2><p className="text-xs text-slate-500">The upload report will show which rows were accepted or need correction.</p></div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {[['1', 'Download template'], ['2', 'Choose department'], ['3', 'Upload and check'], ['4', 'Confirm upload']].map(([number, title]) => <div key={number} className="rounded-xl border border-slate-200 p-3"><span className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">{number}</span><p className="text-sm font-semibold text-slate-800">{title}</p></div>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card space-y-5">
            <div><h2 className="font-semibold text-slate-700">Step 2: Choose department</h2><p className="mt-1 text-xs text-slate-500">This department will be used for every uploaded faculty member.</p></div>

            <div>
              <label className="label" htmlFor="faculty-department">Department *</label>
              <select
                value={department}
                onChange={handleDepartmentChange}
                id="faculty-department" className="input"
              >
                <option value="">Choose department</option>
                {DEPARTMENTS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div onDragOver={e => e.preventDefault()} onDrop={handleDrop} className="border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/40 p-8 transition-colors hover:border-primary-400">
              <div className="flex flex-col items-center justify-center text-center">
                <FileSpreadsheet className="mb-3 h-9 w-9 text-primary-600" />
                <p className="mb-1 font-semibold text-slate-800">Step 3: Upload and check your file</p>
                <label className="cursor-pointer">
                  <span className="font-medium text-primary-700 hover:underline">Choose an Excel or CSV file</span>
                  {' '}or drag and drop it here
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  {file ? `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Accepted: .xlsx, .xls, .csv • Maximum size: 15 MB'}
                </p>
              </div>
            </div>

            {file && <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"><span className="flex items-center gap-2 text-emerald-800"><CheckCircle className="h-4 w-4" /> File ready to check</span><button type="button" onClick={() => setFile(null)} className="font-medium text-emerald-700 hover:underline">Remove file</button></div>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !file || !department}
                className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Checking file...' : 'Review and upload faculty'}
              </button>
              {file && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="btn btn-secondary"
                >
                  <X className="w-4 h-4" /> Remove file
                </button>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              <p className="font-medium mb-1">Before you upload, check these columns:</p>
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
            <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-2"><Download className="h-4 w-4 text-primary-600" /> Step 1: Download template</h3>
            <p className="text-sm text-slate-600 mb-3">
              Download a sample Excel file to see the required format:
            </p>
            <a
              href="/docs/sample_faculty.xlsx"
              download
              className="inline-block px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded hover:bg-primary-100 transition-colors"
            >
              Download faculty template (XLSX)
            </a>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-1">
          {result ? (
            <div className="card space-y-4">
              <h2 className="font-semibold text-slate-700">Step 4: Upload report</h2>

              {/* Success Count */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium text-emerald-900">Added successfully</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{result.success.length}</p>
                <p className="text-xs text-emerald-700 mt-1">faculty enrolled</p>
              </div>

              {/* Failed Count */}
              {result.failed.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-900">Needs correction</span>
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
              <Upload className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="font-medium text-slate-700">Your upload report will appear here</p>
              <p className="mt-1 text-sm text-slate-500">You will see successful rows and simple error messages.</p>
            </div>
          )}
        </div>
      </div>
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="faculty-upload-confirmation">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="faculty-upload-confirmation" className="text-lg font-bold text-slate-800">Create these faculty records?</h2>
            <p className="mt-2 text-sm text-slate-600">The file <strong>{file?.name}</strong> will be checked and valid rows will create faculty accounts in the <strong>{department}</strong> department.</p>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Rows with missing, duplicate, or invalid details will not be created. Review the report after upload.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowConfirmation(false)}>Go back</button>
              <button type="button" className="btn-primary" onClick={uploadFaculty} disabled={loading}><Check className="h-4 w-4" /> Confirm upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
