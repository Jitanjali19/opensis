import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, X, Download, FileSpreadsheet, Check, Info } from 'lucide-react';
import { DEPARTMENT_OPTIONS, getDepartmentLabel } from '../../constants/departments';

// Year to Semester mapping
const YEAR_SEMESTER_MAP = {
  '1': [1, 2],      // 1st Year: Semesters 1, 2
  '2': [3, 4],      // 2nd Year: Semesters 3, 4
  '3': [5, 6],      // 3rd Year: Semesters 5, 6
  '4': [7, 8],      // 4th Year: Semesters 7, 8
};

const SEMESTER_SESSION_MAP = {
  'july-december': [1, 3, 5, 7],
  'january-june': [2, 4, 6, 8],
};

// Generate session options for the four-year B.Tech duration
const generateSessionOptions = () => {
  const sessions = [];
  const currentYear = new Date().getFullYear();
  for (let i = 0; i < 4; i++) {
    const year = currentYear - i;
    sessions.push(`${year}-${year + 1}`);
  }
  return sessions;
};

const SESSIONS = generateSessionOptions();
const YEARS = ['1', '2', '3', '4'];
const SEMESTER_SESSIONS = [
  { value: 'july-december', label: 'July-December' },
  { value: 'january-june', label: 'January-June' },
];
const FIRST_YEAR_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const OTHER_YEAR_SECTIONS = ['A', 'B'];

const getYearLabel = (value) => {
  if (value === '1') return '1st Year';
  if (value === '2') return '2nd Year';
  if (value === '3') return '3rd Year';
  return '4th Year';
};

const getSemesterLabel = (value) => {
  const suffixMap = { 1: 'st', 2: 'nd', 3: 'rd' };
  const suffix = suffixMap[value] || 'th';
  return `${value}${suffix} Semester`;
};

export default function BulkUploadStudents() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [session, setSession] = useState('');
  const [semesterSession, setSemesterSession] = useState('');
  const [year, setYear] = useState('');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Calculate allowed semesters based on selected year
  const allowedSemesters = useMemo(() => {
    const yearSemesters = year ? YEAR_SEMESTER_MAP[year] || [] : [];
    const sessionSemesters = semesterSession ? SEMESTER_SESSION_MAP[semesterSession] || [] : [];
    return yearSemesters.filter((value) => sessionSemesters.includes(value));
  }, [semesterSession, year]);

  const allowedSections = year === '1' ? FIRST_YEAR_SECTIONS : OTHER_YEAR_SECTIONS;

  const handleSessionChange = (e) => {
    setSession(e.target.value);
    setSemesterSession('');
    setYear('');
    setBranch('');
    setSemester('');
    setSection('');
  };

  const handleSemesterSessionChange = (e) => {
    setSemesterSession(e.target.value);
    setYear('');
    setBranch('');
    setSemester('');
    setSection('');
  };

  const handleYearChange = (e) => {
    setYear(e.target.value);
    setBranch('');
    setSemester('');
    setSection('');
  };

  const handleBranchChange = (e) => {
    setBranch(e.target.value);
    setSemester('');
    setSection('');
  };

  const handleSemesterChange = (e) => {
    setSemester(e.target.value);
    setSection('');
  };

  // Reset semester when year changes
  React.useEffect(() => {
    if (!allowedSemesters.includes(Number(semester))) {
      setSemester('');
    }
  }, [allowedSemesters, semester]);

  const handleFileChange = (e) => {
    acceptFile(e.target.files?.[0]);
  };

  const acceptFile = selectedFile => {
    if (!selectedFile) return;
    const validTypes = ['.xlsx', '.xls', '.csv'];
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(ext)) {
      toast.error('Please choose an Excel or CSV file (.xlsx, .xls, or .csv).');
      return;
    }
    if (selectedFile.size > 15 * 1024 * 1024) {
      toast.error('This file is larger than 15 MB. Please choose a smaller file.');
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = e => {
    e.preventDefault();
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file');
    if (!session) return toast.error('Please select a session');
    if (!semesterSession) return toast.error('Please select a semester session');
    if (!year) return toast.error('Please select a year');
    if (!branch) return toast.error('Please select a department');
    if (!semester) return toast.error('Please select a semester');
    if (!section) return toast.error('Please select a section');
    setShowConfirmation(true);
  };

  const uploadStudents = async () => {

    const formData = new FormData();
    formData.append('file', file);
    formData.append('session', session);
    formData.append('year', year);
    formData.append('branch', branch);
    formData.append('semester', semester);
    formData.append('section', section);
    
    setLoading(true);
    try {
      const { data } = await api.post('/admin/students/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(data.data);
      toast.success(`Successfully processed ${data.data.success.length} students`);
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
        <Link to="/admin/students" className="mt-1 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Back to students">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Add many students at once</h1>
          <p className="mt-1 text-sm text-slate-500">Use a prepared Excel or CSV file to create multiple student records safely.</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="mb-4 flex items-center gap-2"><Info className="h-5 w-5 text-primary-600" /><div><h2 className="font-semibold text-slate-800">Follow these 4 steps</h2><p className="text-xs text-slate-500">You can check the file before anything is uploaded.</p></div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {[['1', 'Download template', 'Start with the correct columns.'], ['2', 'Choose student details', 'Tell us where these students belong.'], ['3', 'Upload and check', 'Select the completed file and review errors.'], ['4', 'Confirm upload', 'Create only the valid student rows.']].map(([number, title, description]) => <div key={number} className={`rounded-xl border p-3 ${number === '3' ? 'border-primary-200 bg-primary-50' : 'border-slate-200'}`}><span className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">{number}</span><p className="text-sm font-semibold text-slate-800">{title}</p><p className="mt-1 text-xs text-slate-500">{description}</p></div>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card space-y-5">
            <div><h2 className="font-semibold text-slate-700">Step 2: Choose student details</h2><p className="mt-1 text-xs text-slate-500">These values are applied to every student in this upload.</p></div>

            {/* Session Selection */}
            <div>
              <label className="label" htmlFor="student-session">Academic session *</label>
              <select
                value={session}
                onChange={handleSessionChange}
                id="student-session" className="input"
              >
                <option value="">Choose academic session</option>
                {SESSIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Semester Session Selection */}
            <div>
              <label className="label" htmlFor="student-term">Semester term *</label>
              <select
                value={semesterSession}
                onChange={handleSemesterSessionChange}
                disabled={!session}
                id="student-term" className="input disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="">Choose July-December or January-June</option>
                {SEMESTER_SESSIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Year Selection */}
              <div>
                <label className="label" htmlFor="student-year">Year *</label>
                <select
                  value={year}
                  onChange={handleYearChange}
                  disabled={!semesterSession}
                  id="student-year" className="input disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">Choose year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{getYearLabel(y)}</option>
                  ))}
                </select>
              </div>

              {/* Department Selection */}
              <div>
                <label className="label" htmlFor="student-branch">Department *</label>
                <select
                  value={branch}
                  onChange={handleBranchChange}
                  disabled={!year}
                  id="student-branch" className="input disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">Choose department</option>
                  {DEPARTMENT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Semester Selection */}
            <div>
              <label className="label" htmlFor="student-semester">Semester *</label>
              <select
                value={semester}
                onChange={handleSemesterChange}
                disabled={!branch}
                id="student-semester" className="input disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="">Choose semester</option>
                {allowedSemesters.map((s) => (
                  <option key={s} value={s}>{getSemesterLabel(s)}</option>
                ))}
              </select>
            </div>

            {/* Section Selection */}
            <div>
              <label className="label" htmlFor="student-section">Section *</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                disabled={!semester}
                id="student-section" className="input disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="">Choose section</option>
                {allowedSections.map((sec) => (
                  <option key={sec} value={sec}>Section {sec}</option>
                ))}
              </select>
            </div>

            {/* File Upload */}
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

            {file && <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"><span className="flex items-center gap-2 text-emerald-800"><CheckCircle className="h-4 w-4" /> File ready to check</span><button type="button" onClick={() => setFile(null)} className="font-medium text-emerald-700 hover:underline" aria-label="Remove selected file">Remove file</button></div>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !file || !session || !semesterSession || !year || !branch || !semester || !section}
                className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Checking file...' : 'Review and upload students'}
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
                <li>• Required columns: rollNo, fullName, email</li>
                <li>• Optional column: phone (exactly 10 digits if provided)</li>
                <li>• Session, Year, Department, Semester, Section are selected above</li>
                <li>• If department exists in Excel, it must match the selected department</li>
                <li>• Email must be unique across all students</li>
                <li>• rollNo must be unique</li>
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
              href="/docs/sample_students.xlsx"
              download
              className="inline-block px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded hover:bg-primary-100 transition-colors"
            >
              Download student template (XLSX)
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
                <p className="text-xs text-emerald-700 mt-1">students enrolled</p>
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
                        <p className="text-emerald-600 text-xs">Roll: {s.rollNo}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="student-upload-confirmation">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="student-upload-confirmation" className="text-lg font-bold text-slate-800">Create these student records?</h2>
            <p className="mt-2 text-sm text-slate-600">The file <strong>{file?.name}</strong> will be checked and valid rows will create student accounts for {getDepartmentLabel(branch)}, Semester {semester}, Section {section}.</p>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Rows with missing, duplicate, or invalid details will not be created. Review the report after upload.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowConfirmation(false)}>Go back</button>
              <button type="button" className="btn-primary" onClick={uploadStudents} disabled={loading}><Check className="h-4 w-4" /> Confirm upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
