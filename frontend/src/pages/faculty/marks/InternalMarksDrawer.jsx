import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calculator, 
  Check, 
  HelpCircle, 
  Layers, 
  ArrowRight,
  Sparkles,
  CheckCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function InternalMarksDrawer({
  isOpen,
  onClose,
  subject,
  students = [],
  entries = [],
  initialStudentId,
  onApplyInternalMarks,
}) {
  const isLab = subject?.itemType === 'lab';
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [midTermMode, setMidTermMode] = useState('average'); // 'average' | 'best'

  // Internal component values
  const [internalValues, setInternalValues] = useState({
    midTerm1: '',
    midTerm2: '',
    assignmentMarks: '',
    attendanceMarks: '',
    internalMarks: '',
  });

  // Sync selected student and values when drawer opens or initialStudentId changes
  useEffect(() => {
    if (!isOpen) return;

    const targetId = initialStudentId 
      ? String(initialStudentId) 
      : selectedStudentId 
      ? String(selectedStudentId) 
      : students[0]?._id 
      ? String(students[0]._id) 
      : '';

    if (targetId) {
      setSelectedStudentId(targetId);
      const entry = entries.find((e) => String(e.studentId) === String(targetId));
      if (entry) {
        setInternalValues({
          midTerm1: entry.midTerm1 !== undefined && entry.midTerm1 !== null ? String(entry.midTerm1) : '',
          midTerm2: entry.midTerm2 !== undefined && entry.midTerm2 !== null ? String(entry.midTerm2) : '',
          assignmentMarks: entry.assignmentMarks !== undefined && entry.assignmentMarks !== null ? String(entry.assignmentMarks) : '',
          attendanceMarks: entry.attendanceMarks !== undefined && entry.attendanceMarks !== null ? String(entry.attendanceMarks) : '',
          internalMarks: entry.internalMarks !== undefined && entry.internalMarks !== null ? String(entry.internalMarks) : '',
        });
        if (entry.midTermMode) setMidTermMode(entry.midTermMode);
      }
    }
  }, [isOpen, initialStudentId, students]);

  if (!isOpen || !subject) return null;

  // Selected student entry
  const selectedStudent = students.find((s) => String(s._id) === String(selectedStudentId)) || students[0];
  const currentEntry = entries.find((e) => String(e.studentId) === String(selectedStudentId));

  // Sync when student changes from dropdown
  const handleSelectStudent = (sId) => {
    const strId = String(sId);
    setSelectedStudentId(strId);
    const entry = entries.find((e) => String(e.studentId) === strId);
    if (entry) {
      setInternalValues({
        midTerm1: entry.midTerm1 !== undefined && entry.midTerm1 !== null ? String(entry.midTerm1) : '',
        midTerm2: entry.midTerm2 !== undefined && entry.midTerm2 !== null ? String(entry.midTerm2) : '',
        assignmentMarks: entry.assignmentMarks !== undefined && entry.assignmentMarks !== null ? String(entry.assignmentMarks) : '',
        attendanceMarks: entry.attendanceMarks !== undefined && entry.attendanceMarks !== null ? String(entry.attendanceMarks) : '',
        internalMarks: entry.internalMarks !== undefined && entry.internalMarks !== null ? String(entry.internalMarks) : '',
      });
      if (entry.midTermMode) setMidTermMode(entry.midTermMode);
    } else {
      setInternalValues({
        midTerm1: '',
        midTerm2: '',
        assignmentMarks: '',
        attendanceMarks: '',
        internalMarks: '',
      });
    }
  };

  // Live calculation
  const calculateResult = () => {
    if (isLab) {
      const att = Number(internalValues.attendanceMarks) || 0;
      const ass = Number(internalValues.assignmentMarks) || 0;
      const int = Number(internalValues.internalMarks) || 0;
      const totalSW = Number((att + ass + int).toFixed(2));
      return {
        value: totalSW,
        max: 40,
        label: 'Calculated SW',
        formula: `${att} (Att) + ${ass} (Assg) + ${int} (Int) = ${totalSW} / 40`,
      };
    } else {
      const mt1 = Number(internalValues.midTerm1) || 0;
      const mt2 = Number(internalValues.midTerm2) || 0;
      const ass = Number(internalValues.assignmentMarks) || 0;
      const mtVal = midTermMode === 'best' ? Math.max(mt1, mt2) : (mt1 + mt2) / 2;
      const totalCW = Number((mtVal + ass).toFixed(2));
      return {
        value: totalCW,
        max: 30,
        label: 'Calculated CW',
        formula: `${mtVal.toFixed(1)} (${midTermMode === 'best' ? 'Best MT' : 'Avg MT'}) + ${ass} (Assg) = ${totalCW} / 30`,
      };
    }
  };

  const calculated = calculateResult();

  const handleApply = (shouldClose = false) => {
    const activeStudentId = selectedStudentId || initialStudentId || students[0]?._id;
    if (!activeStudentId) {
      toast.error('Please select a student');
      return;
    }

    // Validation
    if (isLab) {
      const att = Number(internalValues.attendanceMarks);
      const ass = Number(internalValues.assignmentMarks);
      const int = Number(internalValues.internalMarks);
      if (internalValues.attendanceMarks !== '' && (att < 0 || att > 10)) {
        return toast.error('Attendance marks must be between 0 and 10');
      }
      if (internalValues.assignmentMarks !== '' && (ass < 0 || ass > 10)) {
        return toast.error('Assignment marks must be between 0 and 10');
      }
      if (internalValues.internalMarks !== '' && (int < 0 || int > 20)) {
        return toast.error('Internal marks must be between 0 and 20');
      }
    } else {
      const mt1 = Number(internalValues.midTerm1);
      const mt2 = Number(internalValues.midTerm2);
      const ass = Number(internalValues.assignmentMarks);
      if (internalValues.midTerm1 !== '' && (mt1 < 0 || mt1 > 20)) {
        return toast.error('Mid Term 1 must be between 0 and 20');
      }
      if (internalValues.midTerm2 !== '' && (mt2 < 0 || mt2 > 20)) {
        return toast.error('Mid Term 2 must be between 0 and 20');
      }
      if (internalValues.assignmentMarks !== '' && (ass < 0 || ass > 10)) {
        return toast.error('Assignment marks must be between 0 and 10');
      }
    }

    onApplyInternalMarks({
      studentId: String(activeStudentId),
      calculatedValue: calculated.value,
      isLab,
      details: {
        ...internalValues,
        midTermMode,
      },
    });

    toast.success(`Applied ${isLab ? 'SW' : 'CW'} = ${calculated.value} to ${selectedStudent?.enrollmentNo || 'student'}`);

    if (shouldClose) {
      onClose();
      return;
    }

    // Auto-advance to next student
    const currentIndex = students.findIndex((s) => String(s._id) === String(activeStudentId));
    if (currentIndex >= 0 && currentIndex < students.length - 1) {
      handleSelectStudent(students[currentIndex + 1]._id);
    } else {
      toast('Reached the end of the class roster', { icon: '👏' });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">
                Internal Marks Calculator
              </h3>
              <p className="text-[11px] text-slate-500">
                {isLab ? 'SW Components (Max 40)' : 'CW Components (Max 30)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Student Selector */}
          <div>
            <label className="label text-xs">Select Student</label>
            <select
              className="input text-xs"
              value={selectedStudentId || students[0]?._id || ''}
              onChange={(e) => handleSelectStudent(e.target.value)}
            >
              {students.map((s, idx) => (
                <option key={s._id} value={s._id}>
                  {idx + 1}. {s.firstName} {s.lastName} ({s.enrollmentNo})
                </option>
              ))}
            </select>
          </div>

          {/* Formula Rule Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
            <span className="font-semibold text-slate-700 block">Calculation Scheme:</span>
            {isLab ? (
              <p className="text-slate-600">
                Attendance (max 10) + Assignments (max 10) + Internal (max 20) = <strong>SW / 40</strong>
              </p>
            ) : (
              <p className="text-slate-600">
                Mid Term 1 (max 20) & 2 (max 20) [{midTermMode === 'best' ? 'Best of 20' : 'Average of 20'}] + Assignments (max 10) = <strong>CW / 30</strong>
              </p>
            )}
          </div>

          {/* Mode Selector for Class */}
          {!isLab && (
            <div>
              <label className="label text-xs">Mid Term Combination Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMidTermMode('average')}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                    midTermMode === 'average'
                      ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Average of MT 1 & 2
                </button>
                <button
                  type="button"
                  onClick={() => setMidTermMode('best')}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                    midTermMode === 'best'
                      ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Best of MT 1 & 2
                </button>
              </div>
            </div>
          )}

          {/* Inputs Form */}
          <div className="space-y-3.5 pt-1">
            {isLab ? (
              <>
                <div>
                  <label className="label text-xs flex justify-between">
                    <span>Attendance Marks</span>
                    <span className="text-slate-400 font-normal">Max 10</span>
                  </label>
                  <input
                    type="number"
                    className="input text-sm"
                    placeholder="0 - 10"
                    min="0"
                    max="10"
                    value={internalValues.attendanceMarks}
                    onChange={(e) =>
                      setInternalValues({ ...internalValues, attendanceMarks: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="label text-xs flex justify-between">
                    <span>Assignment Marks</span>
                    <span className="text-slate-400 font-normal">Max 10</span>
                  </label>
                  <input
                    type="number"
                    className="input text-sm"
                    placeholder="0 - 10"
                    min="0"
                    max="10"
                    value={internalValues.assignmentMarks}
                    onChange={(e) =>
                      setInternalValues({ ...internalValues, assignmentMarks: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="label text-xs flex justify-between">
                    <span>Internal Lab Test</span>
                    <span className="text-slate-400 font-normal">Max 20</span>
                  </label>
                  <input
                    type="number"
                    className="input text-sm"
                    placeholder="0 - 20"
                    min="0"
                    max="20"
                    value={internalValues.internalMarks}
                    onChange={(e) =>
                      setInternalValues({ ...internalValues, internalMarks: e.target.value })
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs flex justify-between">
                      <span>Mid Term 1</span>
                      <span className="text-slate-400 font-normal">Max 20</span>
                    </label>
                    <input
                      type="number"
                      className="input text-sm"
                      placeholder="0 - 20"
                      min="0"
                      max="20"
                      value={internalValues.midTerm1}
                      onChange={(e) =>
                        setInternalValues({ ...internalValues, midTerm1: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label text-xs flex justify-between">
                      <span>Mid Term 2</span>
                      <span className="text-slate-400 font-normal">Max 20</span>
                    </label>
                    <input
                      type="number"
                      className="input text-sm"
                      placeholder="0 - 20"
                      min="0"
                      max="20"
                      value={internalValues.midTerm2}
                      onChange={(e) =>
                        setInternalValues({ ...internalValues, midTerm2: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-xs flex justify-between">
                    <span>Assignment Marks</span>
                    <span className="text-slate-400 font-normal">Max 10</span>
                  </label>
                  <input
                    type="number"
                    className="input text-sm"
                    placeholder="0 - 10"
                    min="0"
                    max="10"
                    value={internalValues.assignmentMarks}
                    onChange={(e) =>
                      setInternalValues({ ...internalValues, assignmentMarks: e.target.value })
                    }
                  />
                </div>
              </>
            )}
          </div>

          {/* Result Card Preview */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl shadow-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              {calculated.label}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold">{calculated.value}</span>
              <span className="text-xs text-slate-400">/ {calculated.max}</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-2 font-mono border-t border-slate-700/80 pt-2">
              {calculated.formula}
            </p>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleApply(true)}
              className="btn-secondary text-xs px-3 py-2 text-slate-700 hover:text-slate-900"
              title="Apply calculated mark and close drawer"
            >
              Apply & Close
            </button>
            <button
              type="button"
              onClick={() => handleApply(false)}
              className="btn-primary text-xs flex items-center gap-1.5"
              title="Apply calculated mark and advance to next student"
            >
              <Check className="w-3.5 h-3.5" />
              Apply to {isLab ? 'SW' : 'CW'} & Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
