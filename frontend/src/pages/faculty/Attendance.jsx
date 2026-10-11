import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { CalendarDays, Check, Download, FileSpreadsheet, Save, Send, Upload, Users, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FacultyAttendance() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [tab, setTab] = useState('mark');
  const [submitting, setSubmitting] = useState(false);
  const [attendanceFile, setAttendanceFile] = useState(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [loadingDetention, setLoadingDetention] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    api.get('/faculty/subjects').then(r => setSubjects(r.data.data.subjects));
  }, []);

  const selectedSubjectObj = subjects.find(s => s._id === selectedSubject);
  const selectedItemType = selectedSubjectObj?.itemType || 'class';
  const attendanceParams = (extra = '') => `${selectedItemType === 'lab' ? 'labId' : 'subjectId'}=${encodeURIComponent(selectedSubject)}&itemType=${selectedItemType}${extra}`;

  const loadStudents = async () => {
    if (!selectedSubjectObj) return toast.error('Select a class or lab first');
    try {
      const q = `?branch=${encodeURIComponent(selectedSubjectObj.branch)}&semester=${encodeURIComponent(selectedSubjectObj.semester)}&limit=1000`;
      const { data } = await api.get(`/admin/students${q}`);
      const roster = data.data.students || [];
      setStudents(roster);
      setRecords(roster.map(s => ({ studentId: s._id, status: 'present' })));
      if (roster.length === 0) toast('No students found for this class', { icon: 'ℹ️' });
    } catch {
      toast.error('Failed to load data');
    }
  };

  useEffect(() => {
    if (selectedSubject && tab === 'mark') loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, tab]);

  const loadMonthlySummary = async () => {
    if (!selectedSubject) return;
    setLoadingMonthly(true);
    try {
      const { data } = await api.get(`/faculty/attendance/monthly-summary?${attendanceParams(`&month=${encodeURIComponent(month)}`)}`);
      setMonthlySummary(data.data);
    } catch (err) {
      setMonthlySummary(null);
      toast.error(err.response?.data?.message || 'Failed to load monthly attendance');
    }
    setLoadingMonthly(false);
  };

  useEffect(() => {
    if (tab === 'history' && selectedSubject) loadMonthlySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedSubject, month]);

  const toggleStatus = (idx) => {
    setRecords(prev => prev.map((r, i) => (i === idx ? { ...r, status: r.status === 'present' ? 'absent' : 'present' } : r)));
  };

  const markAll = (status) => {
    setRecords(prev => prev.map(r => ({ ...r, status })));
  };

  const handleSubmit = async () => {
    if (!selectedSubject || !date || records.length === 0) return toast.error('Fill all class/lab attendance fields');
    setSubmitting(true);
    try {
      await api.post('/faculty/attendance', {
        [selectedItemType === 'lab' ? 'labId' : 'subjectId']: selectedSubject,
        itemType: selectedItemType,
        date,
        records,
      });
      toast.success('Attendance marked successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark attendance');
    }
    setSubmitting(false);
  };

  const downloadAttendanceSheet = async () => {
    if (!selectedSubject || !date) return toast.error('Select class/lab and date');
    setLoadingSheet(true);
    try {
      const q = `?${attendanceParams(`&date=${encodeURIComponent(date)}`)}`;
      const resp = await api.get(`/faculty/attendance/template${q}`, { responseType: 'blob' });
      const disposition = resp.headers['content-disposition'] || '';
      const match = /filename\*?=([^;]+)/i.exec(disposition);
      const filename = match ? match[1].replace(/UTF-8''/, '').replace(/"/g, '').trim() : 'attendance.xlsx';
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download attendance sheet');
    }
    setLoadingSheet(false);
  };

  const uploadAttendanceSheet = async () => {
    if (!selectedSubject || !date) return toast.error('Select class/lab and date');
    if (!attendanceFile) return toast.error('Please choose an Excel file');

    const formData = new FormData();
    formData.append('file', attendanceFile);
    formData.append(selectedItemType === 'lab' ? 'labId' : 'subjectId', selectedSubject);
    formData.append('itemType', selectedItemType);
    formData.append('date', date);

    setLoadingSheet(true);
    try {
      const { data } = await api.post('/faculty/attendance/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Attendance saved for ${data.data.attendance.records.length} students`);
      setAttendanceFile(null);
      await loadStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload attendance sheet');
    }
    setLoadingSheet(false);
  };

  const downloadMonthlyExport = async () => {
    if (!selectedSubject || !month) return toast.error('Select class/lab and month');
    setLoadingMonthly(true);
    try {
      const q = `?${attendanceParams(`&month=${encodeURIComponent(month)}`)}`;
      const resp = await api.get(`/faculty/attendance/monthly-export${q}`, { responseType: 'blob' });
      const disposition = resp.headers['content-disposition'] || '';
      const match = /filename\*?=([^;]+)/i.exec(disposition);
      const filename = match ? match[1].replace(/UTF-8''/, '').replace(/"/g, '').trim() : `attendance_${month}.xlsx`;
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to export monthly attendance');
    }
    setLoadingMonthly(false);
  };

  const downloadDetentionExport = async () => {
    if (!selectedSubject || !month) return toast.error('Select class/lab and month');
    setLoadingDetention(true);
    try {
      const q = `?${attendanceParams(`&month=${encodeURIComponent(month)}`)}`;
      const resp = await api.get(`/faculty/attendance/detention-export${q}`, { responseType: 'blob' });
      const disposition = resp.headers['content-disposition'] || '';
      const match = /filename\*?=([^;]+)/i.exec(disposition);
      const filename = match ? match[1].replace(/UTF-8''/, '').replace(/"/g, '').trim() : `detention_list_${month}.xlsx`;
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to export detention list');
    }
    setLoadingDetention(false);
  };

  const publishMonthlyNotice = async (type) => {
    if (!selectedSubject || !month) return toast.error('Select class/lab and month');
    setPublishing(true);
    try {
      await api.post('/faculty/attendance/monthly-notice', {
        [selectedItemType === 'lab' ? 'labId' : 'subjectId']: selectedSubject,
        itemType: selectedItemType,
        month,
        type,
      });
      toast.success(type === 'detention' ? 'Detention list notice sent to students' : 'Overall monthly attendance notice sent to students');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send notice');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">Mark daily attendance and review monthly records</p>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('mark')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'mark' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>Mark Attendance</button>
        <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'history' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-600'}`}>History</button>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Class / Lab</label>
            <select className="input" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
              <option value="">Select class or lab</option>
              {subjects.map(s => <option key={s._id} value={s._id}>{s.itemType === 'lab' ? 'LAB' : 'CLASS'} · {s.code} — {s.name}</option>)}
            </select>
          </div>
          {tab === 'mark' && (
            <>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button onClick={loadStudents} className="btn-primary w-full">
                  <Users className="w-4 h-4" /> Load Students
                </button>
              </div>
            </>
          )}
          {tab === 'history' && (
            <>
              <div>
                <label className="label">Month</label>
                <input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button onClick={loadMonthlySummary} className="btn-primary w-full">
                  <CalendarDays className="w-4 h-4" /> Load Month
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {tab === 'mark' && selectedSubject && (
        <div className="card mb-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-slate-800">Excel Attendance Sheet</h3>
              <p className="text-sm text-slate-500">Download the class roster for the selected date, mark present/absent, and upload it back.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadAttendanceSheet} disabled={loadingSheet || !date} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50">
                <Download className="w-4 h-4" /> {loadingSheet ? 'Downloading...' : 'Download Sheet'}
              </button>
              <label className="btn-secondary text-sm flex items-center gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4" /> {attendanceFile ? attendanceFile.name : 'Choose Excel'}
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => setAttendanceFile(e.target.files?.[0] || null)} />
              </label>
              <button onClick={uploadAttendanceSheet} disabled={loadingSheet || !attendanceFile} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
                <Upload className="w-4 h-4" /> Upload Sheet
              </button>
            </div>
          </div>
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
            The sheet includes all students in this class and a <span className="font-medium">status</span> column. Keep it as <span className="font-medium">present</span> or change to <span className="font-medium">absent</span> before uploading.
          </div>
        </div>
      )}

      {tab === 'mark' && students.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Students ({students.length})</h3>
            <div className="flex gap-2">
              <button onClick={() => markAll('present')} className="text-xs btn-secondary">All Present</button>
              <button onClick={() => markAll('absent')} className="text-xs btn-secondary">All Absent</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 text-slate-500 font-medium">#</th>
                  <th className="text-left py-3 text-slate-500 font-medium">Student</th>
                  <th className="text-center py-3 text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s._id} className="border-b border-slate-50">
                    <td className="py-3 text-slate-500">{i + 1}</td>
                    <td className="py-3 text-slate-800 font-medium">
                      <div>{s.firstName} {s.lastName}</div>
                      <div className="text-xs text-slate-400 font-mono">{s.enrollmentNo}</div>
                    </td>
                    <td className="py-3 text-center">
                      <button
                        onClick={() => toggleStatus(i)}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${records[i]?.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {records[i]?.status === 'present' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {records[i]?.status}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <p className="text-sm text-slate-500">Present: {records.filter(r => r.status === 'present').length} / {records.length}</p>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
              <Save className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Attendance'}
            </button>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-800">Monthly Attendance</h3>
              <p className="text-sm text-slate-500">Student-wise attendance for each day of the selected month.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadMonthlyExport} disabled={loadingMonthly || !monthlySummary} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50">
                <Download className="w-4 h-4" /> {loadingMonthly ? 'Exporting...' : 'Download Month Sheet'}
              </button>
              <button onClick={downloadDetentionExport} disabled={loadingDetention || !monthlySummary || !monthlySummary.students.some(student => student.attendancePercentage < 75)} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50">
                <Download className="w-4 h-4" /> {loadingDetention ? 'Exporting...' : 'Download Detention List'}
              </button>
              <button onClick={() => publishMonthlyNotice('attendance')} disabled={publishing || !monthlySummary} className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 bg-white border border-slate-200">
                <Send className="w-4 h-4 text-primary-600" /> {publishing ? 'Publishing...' : 'Publish Attendance'}
              </button>
              <button onClick={() => publishMonthlyNotice('detention')} disabled={publishing || !monthlySummary} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 shadow-sm">
                <AlertTriangle className="w-4 h-4" /> {publishing ? 'Publishing...' : 'Publish Detention List'}
              </button>
            </div>
          </div>

          {loadingMonthly ? (
            <div className="card text-center py-10">
              <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : monthlySummary ? (
            <>
            <div className="card border-amber-200 bg-amber-50/40">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">Short Attendance Students</h3>
                  <p className="text-sm text-slate-500">Students below 75% for {month}. These students are included in the detention export.</p>
                </div>
                <span className="text-sm font-semibold text-amber-700">{monthlySummary.students.filter(student => student.attendancePercentage < 75).length} students</span>
              </div>
              {monthlySummary.students.some(student => student.attendancePercentage < 75) ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-200 text-slate-500">
                        <th className="text-left py-2">Enrollment No</th>
                        <th className="text-left py-2">Student</th>
                        <th className="text-right py-2">Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummary.students.filter(student => student.attendancePercentage < 75).map(student => (
                        <tr key={student.studentId} className="border-b border-amber-100 last:border-0">
                          <td className="py-2 font-mono text-xs">{student.enrollmentNo}</td>
                          <td className="py-2">{student.studentName}</td>
                          <td className="py-2 text-right font-semibold text-amber-700">{Number(student.attendancePercentage || 0).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-emerald-700">No students are below 75% for this month.</p>
              )}
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800">{monthlySummary.subject.code} — {monthlySummary.subject.name}</h3>
                  <p className="text-xs text-slate-500">Month: {month}</p>
                </div>
                <div className="text-sm text-slate-500">Students: {monthlySummary.students.length}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-max">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="text-left py-3 px-2 sticky left-0 bg-white">Enrollment No</th>
                      <th className="text-left py-3 px-2 sticky left-32 bg-white">Student</th>
                      {(monthlySummary.dayLabels || monthlySummary.days).map((day, idx) => <th key={`${day}-${idx}`} className="text-center py-3 px-2">{day}</th>)}
                      <th className="text-center py-3 px-2">P</th>
                      <th className="text-center py-3 px-2">A</th>
                      <th className="text-center py-3 px-2">Marked</th>
                      <th className="text-center py-3 px-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.students.map(student => (
                      <tr key={student.studentId} className="border-b border-slate-100">
                        <td className="py-2 px-2 font-mono sticky left-0 bg-white">{student.enrollmentNo}</td>
                        <td className="py-2 px-2 sticky left-32 bg-white">{student.studentName}</td>
                        {student.statuses.map((status, idx) => (
                          <td key={idx} className={`py-2 px-2 text-center font-semibold ${status === 'P' ? 'text-green-700' : status === 'A' ? 'text-red-700' : 'text-slate-300'}`}>{status || '—'}</td>
                        ))}
                        <td className="py-2 px-2 text-center text-green-700">{student.presentDays}</td>
                        <td className="py-2 px-2 text-center text-red-700">{student.absentDays}</td>
                        <td className="py-2 px-2 text-center text-slate-500">{student.markedDays}</td>
                        <td className={`py-2 px-2 text-center font-semibold ${student.attendancePercentage < 60 ? 'text-red-700' : student.attendancePercentage < 75 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {Number(student.attendancePercentage || 0).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          ) : (
            <div className="card text-center py-12">
              <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Pick a month and load it to view the day-wise attendance matrix.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
