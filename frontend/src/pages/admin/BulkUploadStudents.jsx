import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, X } from 'lucide-react';

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
const BRANCHES = ['CSE', 'IT', 'ECE', 'IP', 'BM', 'CIVIL', 'MC'];
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
    if (!session) return toast.error('Please select a session');
    if (!semesterSession) return toast.error('Please select a semester session');
    if (!year) return toast.error('Please select a year');
    if (!branch) return toast.error('Please select a branch');
    if (!semester) return toast.error('Please select a semester');
    if (!section) return toast.error('Please select a section');

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
    } catch (err) {
      // axios interceptor already shows toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/students" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bulk Upload Students</h1>
          <p className="text-slate-500 text-sm">Upload an Excel file to enroll multiple students at once</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card space-y-4">
            <h2 className="font-semibold text-slate-700">Upload Students</h2>

            {/* Session Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Session *</label>
              <select
                value={session}
                onChange={handleSessionChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select Session</option>
                {SESSIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Semester Session Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Semester Session *</label>
              <select
                value={semesterSession}
                onChange={handleSemesterSessionChange}
                disabled={!session}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="">Select Semester Session</option>
                {SEMESTER_SESSIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Year Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Year *</label>
                <select
                  value={year}
                  onChange={handleYearChange}
                  disabled={!semesterSession}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select Year</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{getYearLabel(y)}</option>
                  ))}
                </select>
              </div>

              {/* Branch Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Branch *</label>
                <select
                  value={branch}
                  onChange={handleBranchChange}
                  disabled={!year}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select Branch</option>
                  {BRANCHES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Semester Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Semester *</label>
              <select
                value={semester}
                onChange={handleSemesterChange}
                disabled={!branch}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="">Select Semester</option>
                {allowedSemesters.map((s) => (
                  <option key={s} value={s}>{getSemesterLabel(s)}</option>
                ))}
              </select>
            </div>

            {/* Section Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Section *</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                disabled={!semester}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                <option value="">Select Section</option>
                {allowedSections.map((sec) => (
                  <option key={sec} value={sec}>Section {sec}</option>
                ))}
              </select>
            </div>

            {/* File Upload */}
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
                disabled={loading || !file || !session || !semesterSession || !year || !branch || !semester || !section}
                className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Uploading...' : 'Upload Students'}
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
                <li>• Columns: rollNo, fullName, email, phone (optional)</li>
                <li>• Phone, when provided, must contain exactly 10 digits</li>
                <li>• Session, Year, Branch, Semester, Section are selected above</li>
                <li>• If branch exists in Excel, it must match the selected branch</li>
                <li>• Email must be unique across all students</li>
                <li>• rollNo must be unique</li>
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
              href="/docs/sample_students.xlsx"
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
                <p className="text-xs text-emerald-700 mt-1">students enrolled</p>
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
                        <p className="text-emerald-600 text-xs">Roll: {s.rollNo}</p>
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
