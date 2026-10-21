import React, { useState } from 'react';
import api from '../../../api/axios';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  Download,
  HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ExcelImportModal({
  isOpen,
  onClose,
  subject,
  semester,
  session,
  onUploadSuccess,
  onDownloadTemplate,
}) {
  const [file, setFile] = useState(null);
  const [uploadMode, setUploadMode] = useState('standard'); // 'standard' | 'internal'
  const [midTermMode, setMidTermMode] = useState('average'); // 'average' | 'best'
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  if (!isOpen || !subject) return null;

  const isLab = subject.itemType === 'lab';

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const ext = selected.name.substring(selected.name.lastIndexOf('.')).toLowerCase();
      if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
        return toast.error('Please upload a valid Excel or CSV file (.xlsx, .xls, .csv)');
      }
      setFile(selected);
      setUploadResult(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select an Excel or CSV file to upload');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('semester', semester);
    formData.append('session', session);

    if (uploadMode === 'standard') {
      if (isLab) {
        formData.append('labId', subject._id);
        formData.append('itemType', 'lab');
      } else {
        formData.append('subjectId', subject._id);
        formData.append('itemType', 'class');
      }

      setUploading(true);
      try {
        const { data } = await api.post('/faculty/marks/bulk-upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setUploadResult(data.data);
        toast.success(`Successfully uploaded marks for ${data.data?.success?.length || 0} students!`);
        if (onUploadSuccess) onUploadSuccess();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to upload marks');
      } finally {
        setUploading(false);
      }
    } else {
      // Internal Coursework upload
      formData.append(isLab ? 'labId' : 'subjectId', subject._id);
      formData.append('itemType', isLab ? 'lab' : 'class');
      formData.append('midTermMode', midTermMode);
      formData.append('publishNotice', 'true');

      setUploading(true);
      try {
        const { data } = await api.post('/faculty/marks/coursework-upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setUploadResult(data.data);
        toast.success(`Uploaded internal marks for ${data.data?.success?.length || 0} students and published student notice`);
        if (onUploadSuccess) onUploadSuccess();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to upload internal marks');
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Import Marks from Excel</h3>
              <p className="text-xs text-slate-500">
                {subject.code} — {subject.name} • Sem {semester} ({session})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => { setUploadMode('standard'); setUploadResult(null); }}
              className={`flex-1 py-2 rounded-lg transition-colors ${uploadMode === 'standard' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
            >
              Standard Marks ({isLab ? 'SW + Practical' : 'CW + Theory'})
            </button>
            <button
              type="button"
              onClick={() => { setUploadMode('internal'); setUploadResult(null); }}
              className={`flex-1 py-2 rounded-lg transition-colors ${uploadMode === 'internal' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
            >
              Internal / Coursework Components
            </button>
          </div>

          {/* Internal Mid Term Rule (if internal mode & class) */}
          {uploadMode === 'internal' && !isLab && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block">Class Mid Term Rule</label>
                <p className="text-[11px] text-slate-500">How to combine Mid Term 1 & 2 for CW calculation</p>
              </div>
              <select
                className="input !w-auto text-xs !py-1.5"
                value={midTermMode}
                onChange={(e) => setMidTermMode(e.target.value)}
              >
                <option value="average">Average of Mid Term 1 & 2</option>
                <option value="best">Best of Mid Term 1 & 2</option>
              </select>
            </div>
          )}

          {/* Drag & Drop Upload Zone */}
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-primary-400 transition-colors bg-slate-50/50">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <label className="cursor-pointer block">
              <span className="text-primary-600 font-semibold text-sm hover:underline">
                Click to choose Excel/CSV file
              </span>{' '}
              <span className="text-slate-500 text-sm">or drag and drop</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-xs text-slate-400 mt-1">
              {file ? `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'Supports .xlsx, .xls, and .csv files'}
            </p>
          </div>

          {/* Expected Columns Guide */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <HelpCircle className="w-3.5 h-3.5 text-primary-600" />
              <span>Expected Columns:</span>
            </div>
            {uploadMode === 'standard' ? (
              <p>
                {isLab ? (
                  <>• Lab: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">enrollmentNo</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">SW (40)</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">Practical (60)</code></>
                ) : (
                  <>• Class: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">enrollmentNo</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">CW (30)</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">Theory (70)</code></>
                )}
              </p>
            ) : (
              <p>
                {isLab ? (
                  <>• Lab Internal: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">enrollmentNo</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">attendanceMarks (10)</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">assignmentMarks (10)</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">internalMarks (20)</code></>
                ) : (
                  <>• Class Internal: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">enrollmentNo</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">midTerm1 (20)</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">midTerm2 (20)</code>, <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">assignmentMarks (10)</code></>
                )}
              </p>
            )}
            <p className="text-[11px] text-slate-400">Student enrollment numbers must match the active roster for this semester.</p>
          </div>

          {/* Upload Results Preview */}
          {uploadResult && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs font-medium">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Successfully processed {uploadResult.success?.length || 0} student marks</span>
              </div>
              {uploadResult.failed?.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs space-y-1.5 max-h-40 overflow-y-auto">
                  <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Failed rows ({uploadResult.failed.length}):</span>
                  </div>
                  {uploadResult.failed.map((f, i) => (
                    <p key={i} className="text-rose-600 pl-5">
                      Row {f.row}{f.enrollmentNo ? ` (${f.enrollmentNo})` : ''}: {f.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download Pre-filled Template
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !file}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Processing File...' : 'Upload Marks'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
