import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../../api/axios';
import { getDepartmentLabel } from '../../../constants/departments';
import { 
  ArrowLeft, 
  Save, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calculator,
  Search,
  ClipboardPaste,
  HelpCircle,
  ChevronUp,
  ChevronDown,
  Trash2,
  CornerDownRight,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import ExcelImportModal from './ExcelImportModal';
import InternalMarksDrawer from './InternalMarksDrawer';

export default function SubjectMarksSheet({
  subject,
  session,
  onBack,
  onSubmissionSuccess,
  existingResults = [],
}) {
  const isLab = subject?.itemType === 'lab';
  const semester = String(subject?.semester || '1');
  const draftStorageKey = `marks_draft_${subject?._id}_${session}`;

  // Mark limits
  const maxPrimary = isLab ? 40 : 30; // SW or CW
  const maxSecondary = isLab ? 60 : 70; // Practical or Theory
  const labelPrimary = isLab ? 'SW' : 'CW';
  const labelSecondary = isLab ? 'Practical' : 'Theory';
  const fieldPrimary = isLab ? 'sw' : 'cw';
  const fieldSecondary = isLab ? 'practical' : 'theory';

  // Data states
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [entries, setEntries] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Draft state
  const [lastSavedDraftTime, setLastSavedDraftTime] = useState(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [showPendingDrawer, setShowPendingDrawer] = useState(false);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isInternalDrawerOpen, setIsInternalDrawerOpen] = useState(false);
  const [drawerStudentId, setDrawerStudentId] = useState(null);

  // Focus and cell refs for keyboard navigation
  const cellRefs = useRef({});

  const setCellRef = (rIdx, cIdx, el) => {
    cellRefs.current[`${rIdx}_${cIdx}`] = el;
  };

  // Load student roster automatically
  const loadRoster = useCallback(async () => {
    setLoading(true);
    try {
      let q = `?branch=${encodeURIComponent(subject.branch)}&semester=${encodeURIComponent(semester)}&session=${encodeURIComponent(session)}&limit=1000`;
      let { data } = await api.get(`/admin/students${q}`);
      let roster = data.data?.students || [];

      // Fallback: if session filter returned <= 2 students, check without session filter (matching legacy behavior)
      if (roster.length <= 2) {
        try {
          q = `?branch=${encodeURIComponent(subject.branch)}&semester=${encodeURIComponent(semester)}&limit=1000`;
          const resp2 = await api.get(`/admin/students${q}`);
          const roster2 = resp2.data?.data?.students || [];
          if (roster2.length > roster.length) {
            roster = roster2;
          }
        } catch (e) {
          // ignore fallback error
        }
      }

      setStudents(roster);

      // Check if a saved draft exists in localStorage
      let savedDraft = null;
      try {
        const rawDraft = localStorage.getItem(draftStorageKey);
        if (rawDraft) savedDraft = JSON.parse(rawDraft);
      } catch (e) {
        savedDraft = null;
      }

      // Map roster to entries
      const initialEntries = roster.map((s) => {
        const studentResult = existingResults.find(
          (r) => String(r.studentId?._id || r.studentId) === String(s._id)
        );
        const existingMark = studentResult?.subjectMarks?.find((m) =>
          isLab
            ? String(m.labId?._id || m.labId) === String(subject._id)
            : String(m.subjectId?._id || m.subjectId) === String(subject._id)
        );

        // Check if draft has saved values for this student
        const draftRow = savedDraft?.entries?.find((d) => d.studentId === s._id);

        const cwVal = draftRow?.cw !== undefined ? draftRow.cw : existingMark?.cw ?? existingMark?.internalMarks ?? '';
        const swVal = draftRow?.sw !== undefined ? draftRow.sw : existingMark?.sw ?? '';
        const theoryVal = draftRow?.theory !== undefined ? draftRow.theory : existingMark?.theory ?? existingMark?.externalMarks ?? '';
        const practicalVal = draftRow?.practical !== undefined ? draftRow.practical : existingMark?.practical ?? existingMark?.externalMarks ?? '';

        return {
          studentId: s._id,
          enrollmentNo: s.enrollmentNo,
          studentName: `${s.firstName} ${s.lastName}`,
          cw: cwVal,
          sw: swVal,
          theory: theoryVal,
          practical: practicalVal,
          status: existingMark?.submissionStatus || 'not_started',
          rejectionReason: existingMark?.rejectionReason || '',
          // Sub-components
          midTerm1: draftRow?.midTerm1 ?? existingMark?.midTerm1 ?? '',
          midTerm2: draftRow?.midTerm2 ?? existingMark?.midTerm2 ?? '',
          midTermMode: draftRow?.midTermMode || existingMark?.midTermMode || 'average',
          assignmentMarks: draftRow?.assignmentMarks ?? existingMark?.assignmentMarks ?? '',
          attendanceMarks: draftRow?.attendanceMarks ?? existingMark?.attendanceMarks ?? '',
          internalMarks: draftRow?.internalMarks ?? existingMark?.internalMarks ?? '',
        };
      });

      setEntries(initialEntries);

      if (savedDraft?.savedAt) {
        setLastSavedDraftTime(new Date(savedDraft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setHasRestoredDraft(true);
        toast('Restored unsaved draft from your browser cache', { icon: '📝' });
      }
    } catch (err) {
      toast.error('Failed to load student roster for this class');
      setStudents([]);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [subject, semester, session, existingResults, isLab, draftStorageKey]);

  useEffect(() => {
    if (subject?._id) {
      loadRoster();
    }
  }, [subject, loadRoster]);

  // Auto-save draft to localStorage whenever entries change
  useEffect(() => {
    if (loading || entries.length === 0) return;

    const timeout = setTimeout(() => {
      try {
        const payload = {
          subjectId: subject._id,
          session,
          savedAt: new Date().toISOString(),
          entries: entries.map((e) => ({
            studentId: e.studentId,
            cw: e.cw,
            sw: e.sw,
            theory: e.theory,
            practical: e.practical,
            midTerm1: e.midTerm1,
            midTerm2: e.midTerm2,
            midTermMode: e.midTermMode,
            assignmentMarks: e.assignmentMarks,
            attendanceMarks: e.attendanceMarks,
            internalMarks: e.internalMarks,
          })),
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(payload));
        setLastSavedDraftTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        // quota exceeded or storage error
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [entries, loading, subject, session, draftStorageKey]);

  // Discard draft and reload server data
  const handleDiscardDraft = () => {
    if (window.confirm('Discard local draft and reload original marks from the server?')) {
      try {
        localStorage.removeItem(draftStorageKey);
      } catch (e) { }
      setHasRestoredDraft(false);
      setLastSavedDraftTime(null);
      loadRoster();
      toast.success('Local draft discarded');
    }
  };

  // Update a field in an entry
  const updateEntry = (studentId, field, value) => {
    setEntries((prev) =>
      prev.map((e) => (e.studentId === studentId ? { ...e, [field]: value } : e))
    );
  };

  // Keyboard navigation handler
  const handleKeyDown = (e, rIdx, cIdx) => {
    const totalRows = filteredEntries.length;

    if (e.key === 'Enter') {
      e.preventDefault();
      const nextRIdx = e.shiftKey ? rIdx - 1 : rIdx + 1;
      if (nextRIdx >= 0 && nextRIdx < totalRows) {
        cellRefs.current[`${nextRIdx}_${cIdx}`]?.focus();
      }
    } else if (e.key === 'Tab') {
      if (!e.shiftKey && cIdx === 0) {
        e.preventDefault();
        cellRefs.current[`${rIdx}_1`]?.focus();
      } else if (!e.shiftKey && cIdx === 1) {
        if (rIdx < totalRows - 1) {
          e.preventDefault();
          cellRefs.current[`${rIdx + 1}_0`]?.focus();
        }
      } else if (e.shiftKey && cIdx === 1) {
        e.preventDefault();
        cellRefs.current[`${rIdx}_0`]?.focus();
      } else if (e.shiftKey && cIdx === 0) {
        if (rIdx > 0) {
          e.preventDefault();
          cellRefs.current[`${rIdx - 1}_1`]?.focus();
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (rIdx < totalRows - 1) {
        e.preventDefault();
        cellRefs.current[`${rIdx + 1}_${cIdx}`]?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      if (rIdx > 0) {
        e.preventDefault();
        cellRefs.current[`${rIdx - 1}_${cIdx}`]?.focus();
      }
    } else if (e.key === 'ArrowRight' && cIdx === 0) {
      const input = e.target;
      if (input.selectionStart === input.value.length) {
        e.preventDefault();
        cellRefs.current[`${rIdx}_1`]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && cIdx === 1) {
      const input = e.target;
      if (input.selectionStart === 0) {
        e.preventDefault();
        cellRefs.current[`${rIdx}_0`]?.focus();
      }
    }
  };

  // Paste-from-Excel / Google Sheets Handler
  const handlePaste = (e, startRowIdx, startColIdx) => {
    const clipboardText = e.clipboardData?.getData('text');
    if (!clipboardText) return;

    if (clipboardText.includes('\t') || clipboardText.includes('\n') || clipboardText.includes('\r')) {
      e.preventDefault();

      const rawRows = clipboardText.split(/\r\n|\n|\r/).filter((r) => r.trim() !== '');
      if (rawRows.length === 0) return;

      let rowsPasted = 0;
      let outOfBoundAlerts = [];

      setEntries((prevEntries) => {
        const updated = [...prevEntries];

        rawRows.forEach((rowStr, offset) => {
          const targetRowIdx = startRowIdx + offset;
          if (targetRowIdx >= filteredEntries.length) return;

          const targetStudentId = filteredEntries[targetRowIdx]?.studentId;
          const entryIndex = updated.findIndex((item) => item.studentId === targetStudentId);
          if (entryIndex === -1) return;

          const cols = rowStr.split('\t').map((c) => c.trim());

          if (startColIdx === 0) {
            if (cols[0] !== undefined && cols[0] !== '') {
              const num = Number(cols[0]);
              if (Number.isFinite(num)) {
                updated[entryIndex][fieldPrimary] = String(num);
                if (num < 0 || num > maxPrimary) {
                  outOfBoundAlerts.push(`${updated[entryIndex].enrollmentNo}: ${labelPrimary} ${num} exceeds max ${maxPrimary}`);
                }
              }
            }
            if (cols[1] !== undefined && cols[1] !== '') {
              const num = Number(cols[1]);
              if (Number.isFinite(num)) {
                updated[entryIndex][fieldSecondary] = String(num);
                if (num < 0 || num > maxSecondary) {
                  outOfBoundAlerts.push(`${updated[entryIndex].enrollmentNo}: ${labelSecondary} ${num} exceeds max ${maxSecondary}`);
                }
              }
            }
          } else {
            if (cols[0] !== undefined && cols[0] !== '') {
              const num = Number(cols[0]);
              if (Number.isFinite(num)) {
                updated[entryIndex][fieldSecondary] = String(num);
                if (num < 0 || num > maxSecondary) {
                  outOfBoundAlerts.push(`${updated[entryIndex].enrollmentNo}: ${labelSecondary} ${num} exceeds max ${maxSecondary}`);
                }
              }
            }
          }
          rowsPasted += 1;
        });

        return updated;
      });

      if (rowsPasted > 0) {
        toast.success(`Pasted marks for ${rowsPasted} student row${rowsPasted > 1 ? 's' : ''}!`);
      }
      if (outOfBoundAlerts.length > 0) {
        toast.error(`Warning: ${outOfBoundAlerts.length} values exceed mark limits`);
      }
    }
  };

  // Cell validation helper
  const getCellValidation = (value, max, label) => {
    if (value === '' || value === null || value === undefined) {
      return { isValid: true, error: null };
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return { isValid: false, error: `${label} must be a number` };
    }
    if (num < 0) {
      return { isValid: false, error: `${label} cannot be negative` };
    }
    if (num > max) {
      return { isValid: false, error: `${label} ${num} exceeds max ${max}` };
    }
    return { isValid: true, error: null };
  };

  // Scroll to student row
  const scrollToStudent = (studentId, colIdx = 0) => {
    const el = document.getElementById(`row-${studentId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const fIdx = filteredEntries.findIndex((e) => e.studentId === studentId);
      if (fIdx >= 0) {
        setTimeout(() => {
          cellRefs.current[`${fIdx}_${colIdx}`]?.focus();
        }, 300);
      }
    }
  };

  // Submit Handler — supports partial submission (1 or more students)
  const handleSubmit = async () => {
    if (entries.length === 0) return toast.error('No students in class to submit');

    // Only submit entries where at least both fields are filled
    const validToSubmit = entries.filter((e) =>
      isLab ? (e.sw !== '' && e.practical !== '') : (e.cw !== '' && e.theory !== '')
    );

    if (validToSubmit.length === 0) {
      return toast.error('Please enter marks for at least one student before submitting.');
    }

    // Range validations — only on filled entries
    for (let i = 0; i < validToSubmit.length; i++) {
      const entry = validToSubmit[i];
      const val1 = Number(entry[fieldPrimary]);
      const val2 = Number(entry[fieldSecondary]);

      if (!Number.isFinite(val1) || val1 < 0 || val1 > maxPrimary) {
        scrollToStudent(entry.studentId, 0);
        return toast.error(
          `${entry.enrollmentNo}: ${labelPrimary} ${val1} exceeds max ${maxPrimary}`
        );
      }
      if (!Number.isFinite(val2) || val2 < 0 || val2 > maxSecondary) {
        scrollToStudent(entry.studentId, 1);
        return toast.error(
          `${entry.enrollmentNo}: ${labelSecondary} ${val2} exceeds max ${maxSecondary}`
        );
      }
    }

    setSubmitting(true);
    try {
      await api.post('/faculty/marks', {
        semester: Number(semester),
        session,
        entries: validToSubmit.map((e) => ({
          studentId: e.studentId,
          ...(isLab
            ? { labId: subject._id, itemType: 'lab' }
            : { subjectId: subject._id, itemType: 'class' }),
          cw: Number(e.cw) || 0,
          sw: Number(e.sw) || 0,
          theory: Number(e.theory) || 0,
          practical: Number(e.practical) || 0,
        })),
      });

      // Clear local draft after successful server submission
      try {
        localStorage.removeItem(draftStorageKey);
      } catch (e) { }

      const skipped = entries.length - validToSubmit.length;
      if (skipped > 0) {
        toast.success(
          `Marks submitted for ${validToSubmit.length} student${validToSubmit.length > 1 ? 's' : ''}. ${skipped} student${skipped > 1 ? 's' : ''} skipped (marks not entered). Pending admin review.`,
          { duration: 5000 }
        );
      } else {
        toast.success('Marks submitted successfully! Pending admin review.');
      }
      if (onSubmissionSuccess) onSubmissionSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit marks');
    } finally {
      setSubmitting(false);
    }
  };

  // Template Download
  const handleDownloadTemplate = async () => {
    const param = isLab ? 'labId' : 'subjectId';
    const q = `?${param}=${encodeURIComponent(subject._id)}&itemType=${isLab ? 'lab' : 'class'}&semester=${encodeURIComponent(semester)}&session=${encodeURIComponent(session)}&_=${Date.now()}`;
    try {
      const resp = await api.get(`/faculty/marks/template${q}`, { responseType: 'blob' });
      const disposition = resp.headers['content-disposition'] || '';
      let filename = `MarksTemplate_${subject.code}.xlsx`;
      const match = /filename\*?=([^;]+)/i.exec(disposition);
      if (match) filename = match[1].replace(/UTF-8''/, '').replace(/"/g, '').trim();

      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download template');
    }
  };

  // Export Submitted Marks
  const handleDownloadSubmitted = async () => {
    const param = isLab ? 'labId' : 'subjectId';
    const q = `?${param}=${encodeURIComponent(subject._id)}&itemType=${isLab ? 'lab' : 'class'}&semester=${semester}&session=${encodeURIComponent(session)}`;
    try {
      const resp = await api.get(`/faculty/marks/export${q}`, { responseType: 'blob' });
      const disposition = resp.headers['content-disposition'] || '';
      let filename = `${subject.code}_submitted_marks.xlsx`;
      const match = /filename\*?=([^;]+)/i.exec(disposition);
      if (match) filename = match[1].replace(/UTF-8''/, '').replace(/"/g, '').trim();

      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to export submitted marks');
    }
  };

  // Handle Internal Marks Drawer Applied
  const handleApplyInternalMarks = ({ studentId, calculatedValue, isLab: labMode, details }) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (String(e.studentId) !== String(studentId)) return e;
        return {
          ...e,
          ...(labMode ? { sw: String(calculatedValue) } : { cw: String(calculatedValue) }),
          midTerm1: details.midTerm1,
          midTerm2: details.midTerm2,
          midTermMode: details.midTermMode,
          assignmentMarks: details.assignmentMarks,
          attendanceMarks: details.attendanceMarks,
          internalMarks: details.internalMarks,
        };
      })
    );
  };

  // Filter entries by search
  const filteredEntries = entries.filter(
    (e) =>
      e.enrollmentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.studentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingStudents = entries.filter((e) =>
    isLab ? e.sw === '' || e.practical === '' : e.cw === '' || e.theory === ''
  );

  const filledCount = entries.length - pendingStudents.length;
  const isAllFilled = filledCount === entries.length && entries.length > 0;

  // validToSubmit: entries where BOTH mark fields are filled
  const validToSubmit = entries.filter((e) =>
    isLab ? (e.sw !== '' && e.practical !== '') : (e.cw !== '' && e.theory !== '')
  );

  const hasAnyErrors = entries.some((e) => {
    const val1 = isLab ? e.sw : e.cw;
    const val2 = isLab ? e.practical : e.theory;
    return (
      !getCellValidation(val1, maxPrimary, labelPrimary).isValid ||
      !getCellValidation(val2, maxSecondary, labelSecondary).isValid
    );
  });

  return (
    <div className="space-y-6 pb-28">
      {/* Top Banner & Quick Actions */}
      <div className="card !p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shrink-0 shadow-sm"
              title="Return to My Subjects"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-800">
                  {subject.code} — {subject.name}
                </h1>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                    isLab ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {isLab ? 'Lab' : 'Class'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                <span>Semester {semester} ({getDepartmentLabel(subject.branch)})</span>
                <span>•</span>
                <span>Session: <strong className="text-slate-700">{session}</strong></span>
                <span>•</span>
                <span className="font-medium text-slate-600">
                  {isLab ? 'SW (max 40) + Practical (max 60)' : 'CW (max 30) + Theory (max 70)'} = 100
                </span>
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
            <button
              type="button"
              onClick={() => { setDrawerStudentId(filteredEntries[0]?.studentId || null); setIsInternalDrawerOpen(true); }}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 hover:text-purple-700 hover:border-purple-300"
              title="Open internal coursework calculator side panel"
            >
              <Calculator className="w-4 h-4 text-purple-600" />
              <span>Internal Breakdown</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 hover:text-primary-700 hover:border-primary-300"
              title="Upload marks or coursework from an Excel spreadsheet"
            >
              <Upload className="w-4 h-4 text-primary-600" />
              <span>Import Excel</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
              title="Download pre-filled student roster template"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Template</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSubmitted}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
              title="Export submitted marks report"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Roster Bar & Live Progress */}
      <div className="card !p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input !pl-9 !py-2 text-sm w-full"
              placeholder="Search by student name or roll..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 shrink-0">
            {entries.length} students enrolled
          </span>
        </div>

        {/* Auto-save status in header */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {lastSavedDraftTime && (
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Draft auto-saved at {lastSavedDraftTime}</span>
            </span>
          )}
          {hasRestoredDraft && (
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-rose-600 hover:text-rose-700 underline text-xs ml-2"
            >
              Discard Draft
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Instructions Bar */}
      <div className="bg-slate-100/70 border border-slate-200/80 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-600 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardPaste className="w-3.5 h-3.5 text-primary-600" />
          <span>
            <strong>Spreadsheet Mode:</strong> Paste data directly from Excel (<kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-mono text-[10px]">Ctrl+V</kbd>). Use <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-mono text-[10px]">Enter</kbd> / <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-mono text-[10px]">Tab</kbd> / arrows to navigate cells.
          </span>
        </div>
        <span className="text-slate-400 text-[11px]">Auto-calculates total out of 100</span>
      </div>

      {/* Spreadsheet Grid */}
      {loading ? (
        <div className="card py-16 text-center">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Auto-loading student roster...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="card py-16 text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No students found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            No active students were found for department <strong>{getDepartmentLabel(subject.branch)}</strong> in <strong>Semester {semester}</strong> for session <strong>{session}</strong>.
          </p>
          <button onClick={onBack} className="btn-secondary text-xs mt-4">
            ← Back to My Subjects
          </button>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden shadow-sm border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3 w-12 text-center border-r border-slate-200">#</th>
                  <th className="py-3 px-4 w-40 border-r border-slate-200">Enrollment No</th>
                  <th className="py-3 px-4 border-r border-slate-200">Student Name</th>
                  <th className="py-3 px-3 w-40 text-center border-r border-slate-200 bg-blue-50/50">
                    {labelPrimary} <span className="text-[11px] font-normal text-slate-500">(Max {maxPrimary})</span>
                  </th>
                  <th className="py-3 px-3 w-40 text-center border-r border-slate-200 bg-blue-50/50">
                    {labelSecondary} <span className="text-[11px] font-normal text-slate-500">(Max {maxSecondary})</span>
                  </th>
                  <th className="py-3 px-3 w-28 text-center border-r border-slate-200 bg-slate-50">
                    Total <span className="text-[11px] font-normal text-slate-500">(100)</span>
                  </th>
                  <th className="py-3 px-3 w-36 text-center border-r border-slate-200">Status</th>
                  <th className="py-3 px-3 w-24 text-center">Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((row, rIdx) => {
                  const val1 = isLab ? row.sw : row.cw;
                  const val2 = isLab ? row.practical : row.theory;
                  const valid1 = getCellValidation(val1, maxPrimary, labelPrimary);
                  const valid2 = getCellValidation(val2, maxSecondary, labelSecondary);

                  const total = (Number(val1) || 0) + (Number(val2) || 0);
                  const isFilled = val1 !== '' && val2 !== '';
                  const hasRowError = !valid1.isValid || !valid2.isValid;

                  return (
                    <tr
                      id={`row-${row.studentId}`}
                      key={row.studentId}
                      className={`hover:bg-slate-50/90 transition-colors ${
                        hasRowError
                          ? 'bg-rose-50/40'
                          : row.status === 'rejected'
                          ? 'bg-rose-50/20'
                          : rIdx % 2 === 1
                          ? 'bg-slate-50/30'
                          : ''
                      }`}
                    >
                      {/* Row Index */}
                      <td className="py-2 px-3 text-center text-xs text-slate-400 font-mono border-r border-slate-100">
                        {rIdx + 1}
                      </td>

                      {/* Enrollment No */}
                      <td className="py-2 px-4 font-mono text-xs font-semibold text-slate-700 border-r border-slate-100">
                        {row.enrollmentNo}
                      </td>

                      {/* Student Name */}
                      <td className="py-2 px-4 border-r border-slate-100">
                        <span className="font-medium text-slate-800">{row.studentName}</span>
                        {row.status === 'rejected' && row.rejectionReason && (
                          <p className="text-[11px] text-rose-600 mt-0.5">
                            Returned: {row.rejectionReason}
                          </p>
                        )}
                      </td>

                      {/* Primary Mark (CW or SW) */}
                      <td className="p-1.5 border-r border-slate-100 text-center relative">
                        <input
                          ref={(el) => setCellRef(rIdx, 0, el)}
                          type="number"
                          className={`w-full px-3 py-1.5 rounded-lg text-sm text-center font-medium transition-all focus:outline-none focus:ring-2 ${
                            !valid1.isValid
                              ? 'border-2 border-rose-500 bg-rose-50 text-rose-700 ring-rose-400/30'
                              : 'border border-slate-200 bg-white hover:border-slate-300 focus:border-primary-500 focus:ring-primary-500/20'
                          }`}
                          value={val1}
                          placeholder={`0-${maxPrimary}`}
                          min="0"
                          max={maxPrimary}
                          onChange={(e) => updateEntry(row.studentId, fieldPrimary, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 0)}
                          onPaste={(e) => handlePaste(e, rIdx, 0)}
                        />
                        {!valid1.isValid && (
                          <div className="text-[10px] text-rose-600 font-semibold mt-0.5 text-center">
                            {valid1.error}
                          </div>
                        )}
                      </td>

                      {/* Secondary Mark (Theory or Practical) */}
                      <td className="p-1.5 border-r border-slate-100 text-center relative">
                        <input
                          ref={(el) => setCellRef(rIdx, 1, el)}
                          type="number"
                          className={`w-full px-3 py-1.5 rounded-lg text-sm text-center font-medium transition-all focus:outline-none focus:ring-2 ${
                            !valid2.isValid
                              ? 'border-2 border-rose-500 bg-rose-50 text-rose-700 ring-rose-400/30'
                              : 'border border-slate-200 bg-white hover:border-slate-300 focus:border-primary-500 focus:ring-primary-500/20'
                          }`}
                          value={val2}
                          placeholder={`0-${maxSecondary}`}
                          min="0"
                          max={maxSecondary}
                          onChange={(e) => updateEntry(row.studentId, fieldSecondary, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rIdx, 1)}
                          onPaste={(e) => handlePaste(e, rIdx, 1)}
                        />
                        {!valid2.isValid && (
                          <div className="text-[10px] text-rose-600 font-semibold mt-0.5 text-center">
                            {valid2.error}
                          </div>
                        )}
                      </td>

                      {/* Auto Calculated Total */}
                      <td className="py-2 px-3 text-center border-r border-slate-100">
                        <span
                          className={`font-bold text-sm ${
                            hasRowError
                              ? 'text-rose-500'
                              : isFilled
                              ? total >= 40
                                ? 'text-slate-800'
                                : 'text-amber-600'
                              : 'text-slate-300'
                          }`}
                        >
                          {isFilled ? total : '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3 text-center border-r border-slate-100">
                        {row.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        ) : row.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                            <AlertCircle className="w-3 h-3" /> Action Required
                          </span>
                        ) : row.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            <Clock className="w-3 h-3" /> In Review
                          </span>
                        ) : isFilled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                            Filled
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Pending</span>
                        )}
                      </td>

                      {/* Breakdown Action */}
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => { setDrawerStudentId(row.studentId); setIsInternalDrawerOpen(true); }}
                          className="p-1 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          title="View / Edit internal component calculation"
                        >
                          <Calculator className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PHASE 3: STICKY BOTTOM DOCK (Always visible above table while scrolling) */}
      <div className="sticky bottom-2 z-30 px-2">
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-2xl rounded-2xl p-3 sm:px-5 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto">
          {/* Progress & Draft Info */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
              {isAllFilled ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <Clock className="w-5 h-5 text-amber-600" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">
                  {filledCount} / {entries.length} Students Filled
                </span>
                <span className="text-xs text-slate-400">
                  ({entries.length ? Math.round((filledCount / entries.length) * 100) : 0}%)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                {lastSavedDraftTime ? (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Auto-saved draft ({lastSavedDraftTime})
                  </span>
                ) : (
                  <span>Auto-saves as draft locally</span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Incomplete inspector badge */}
          <div className="flex items-center gap-2">
            {!isAllFilled && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPendingDrawer(!showPendingDrawer)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>{pendingStudents.length} Pending</span>
                  {showPendingDrawer ? (
                    <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>

                {/* Pending Students Dropdown List */}
                {showPendingDrawer && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-80 max-h-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 overflow-y-auto z-40 space-y-1.5 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-semibold text-slate-700">
                      <span>Pending Students ({pendingStudents.length})</span>
                      <button
                        onClick={() => setShowPendingDrawer(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        ✕
                      </button>
                    </div>
                    {pendingStudents.map((ps) => {
                      const missingFields = [];
                      if ((isLab ? ps.sw : ps.cw) === '') missingFields.push(labelPrimary);
                      if ((isLab ? ps.practical : ps.theory) === '') missingFields.push(labelSecondary);

                      return (
                        <button
                          key={ps.studentId}
                          type="button"
                          onClick={() => {
                            scrollToStudent(ps.studentId, (isLab ? ps.sw : ps.cw) === '' ? 0 : 1);
                            setShowPendingDrawer(false);
                          }}
                          className="w-full text-left p-2 rounded-xl text-xs hover:bg-slate-50 transition-colors flex items-center justify-between group"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">{ps.studentName}</p>
                            <p className="text-[11px] font-mono text-slate-400">{ps.enrollmentNo}</p>
                          </div>
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                            Missing: {missingFields.join(', ')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit Action Button */}
          <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
            {!isAllFilled && validToSubmit.length > 0 && (
              <p className="text-[11px] text-amber-600">
                Partial submission — {validToSubmit.length} of {entries.length} students will be submitted
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || loading || validToSubmit.length === 0 || hasAnyErrors}
              className={`btn-primary text-xs px-6 py-2.5 flex items-center gap-2 shadow-md w-full sm:w-auto ${
                validToSubmit.length === 0 || hasAnyErrors ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={
                validToSubmit.length === 0
                  ? 'Enter marks for at least one student to submit'
                  : hasAnyErrors
                  ? 'Please fix out-of-range mark values'
                  : isAllFilled
                  ? `Submit marks for all ${entries.length} students`
                  : `Submit partial marks — ${validToSubmit.length} of ${entries.length} students filled`
              }
            >
              <Save className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Submitting...'
                  : validToSubmit.length > 0 && !isAllFilled
                  ? `Submit (${validToSubmit.length} Students)`
                  : 'Submit for Review'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        subject={subject}
        semester={semester}
        session={session}
        onUploadSuccess={() => {
          loadRoster();
          setIsImportModalOpen(false);
        }}
        onDownloadTemplate={handleDownloadTemplate}
      />

      {/* Internal Marks Breakdown Drawer */}
      <InternalMarksDrawer
        isOpen={isInternalDrawerOpen}
        onClose={() => setIsInternalDrawerOpen(false)}
        subject={subject}
        students={students}
        entries={entries}
        initialStudentId={drawerStudentId}
        onApplyInternalMarks={handleApplyInternalMarks}
      />
    </div>
  );
}
