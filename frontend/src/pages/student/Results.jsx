import React, { useEffect, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { BarChart3, Download } from 'lucide-react';
import { getDepartmentLabel } from '../../constants/departments';

export default function StudentResults() {
  const { selectedSession, selectedTerm } = useAuth();
  const [semester, setSemester] = useState('');
  const [results, setResults] = useState([]);
  const [internalResults, setInternalResults] = useState([]);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedResultId, setSelectedResultId] = useState('');
  const marksheetRef = useRef(null);

  const handlePrint = useReactToPrint({ content: () => marksheetRef.current });

  const loadResults = async (sem = semester) => {
    setLoading(true);
    try {
      const query = sem ? `?semester=${encodeURIComponent(sem)}` : '';
      const { data } = await api.get(`/student/results${query}`);
      setResults(data.data.results || []);
      setStudent(data.data.student || null);
      if ((data.data.results || []).length > 0) {
        setSelectedResultId(prev => prev || data.data.results[0]._id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const loadInternalMarks = async (sem = semester) => {
    try {
      const query = sem ? `?semester=${encodeURIComponent(sem)}` : '';
      const { data } = await api.get(`/student/internal-marks${query}`);
      setInternalResults(data.data.results || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load internal marks');
    }
  };

  useEffect(() => {
    setSemester('');
    setSelectedResultId('');
    loadResults('');
    loadInternalMarks('');
  }, [selectedSession, selectedTerm]);

  const selectedResult = results.find(r => r._id === selectedResultId) || results[0];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Results</h1>
        <p className="text-slate-500 text-sm mt-1">View semester-wise published results and download marksheet PDF</p>
      </div>

      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="w-full sm:w-56">
            <label className="label">Semester</label>
            <select className="input" value={semester} onChange={e => setSemester(e.target.value)}>
              <option value="">Current semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(value => <option key={value} value={value}>Semester {value}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => { loadResults(); loadInternalMarks(); }} disabled={loading}>{loading ? 'Loading...' : 'Load Result'}</button>
            <button className="btn-secondary" onClick={() => { setSemester(''); loadResults(''); loadInternalMarks(''); }} disabled={loading}>Reset</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-10"><p className="text-sm text-slate-500">Loading results...</p></div>
      ) : results.length === 0 ? (
        <div className="card text-center py-12">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No published result available yet</p>
        </div>
      ) : (
        <>
          <div className="card mb-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Select Semester Result:</label>
                <select className="input w-auto" value={selectedResultId} onChange={e => setSelectedResultId(e.target.value)}>
                  {results.map(r => (
                    <option key={r._id} value={r._id}>Sem {r.semester} | {r.session || 'Session N/A'}</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary" onClick={handlePrint}><Download className="w-4 h-4" /> Download Marksheet PDF</button>
            </div>
          </div>

          {selectedResult && (
            <div ref={marksheetRef} className="card">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">SGSITS Academic Marksheet</h2>
                  <p className="text-xs text-slate-500">Semester {selectedResult.semester} | Session {selectedResult.session}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Result Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${selectedResult.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{String(selectedResult.status || 'pending').toUpperCase()}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 text-sm">
                <div><span className="text-slate-500">Student:</span> <span className="font-medium text-slate-800">{student?.name}</span></div>
                <div><span className="text-slate-500">Enrollment:</span> <span className="font-medium text-slate-800">{student?.enrollmentNo}</span></div>
                <div><span className="text-slate-500">Department:</span> <span className="font-medium text-slate-800">{getDepartmentLabel(student?.branch)}</span></div>
                <div><span className="text-slate-500">Section:</span> <span className="font-medium text-slate-800">{student?.section}</span></div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2">Subject</th>
                      <th className="text-center px-3 py-2">CW / 30</th>
                      <th className="text-center px-3 py-2">SW / 40</th>
                      <th className="text-center px-3 py-2">Theory / Practical</th>
                      <th className="text-center px-3 py-2">Total</th>
                      <th className="text-center px-3 py-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedResult.subjectMarks || []).map((s, index) => (
                      <tr key={`${s.itemType === 'lab' || s.labId ? 'lab' : 'class'}:${s.subjectId?._id || s.labId?._id || index}`} className="border-b border-slate-100">
                        <td className="px-3 py-2">{s.itemName || s.subjectName || s.subjectId?.name || s.labId?.name || '—'} <span className="text-xs text-slate-400">({s.itemCode || s.subjectCode || s.subjectId?.code || s.labId?.code || 'NA'})</span></td>
                        <td className="text-center px-3 py-2">{s.itemType === 'lab' || s.labId ? '—' : (s.cw ?? s.internalMarks ?? '—')}</td>
                        <td className="text-center px-3 py-2">{s.sw ?? '—'}</td>
                        <td className="text-center px-3 py-2">{s.itemType === 'lab' || s.labId ? (s.practical ?? s.externalMarks ?? '—') : (s.theory ?? s.externalMarks ?? '—')}</td>
                        <td className="text-center px-3 py-2 font-semibold">{s.totalMarks ?? '—'}</td>
                        <td className="text-center px-3 py-2">{s.grade || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-200 text-sm">
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                  <p className="text-xs text-primary-700">SGPA</p>
                  <p className="text-xl font-bold text-primary-700">{selectedResult.sgpa ?? '—'}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">Percentage</p>
                  <p className="text-xl font-bold text-amber-700">{selectedResult.percentage ?? '—'}%</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-xs text-emerald-700">Latest CGPA</p>
                  <p className="text-xl font-bold text-emerald-700">{selectedResult.cgpa ?? '—'}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Published</p>
                  <p className="text-xl font-bold text-slate-700">{selectedResult.published ? 'Yes' : 'No'}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Published At</p>
                  <p className="text-sm font-semibold text-slate-700">{selectedResult.publishedAt ? new Date(selectedResult.publishedAt).toLocaleString() : '—'}</p>
                </div>
              </div>
            </div>
          )}

        </>
      )}

      {!loading && internalResults.length > 0 && (
        <div className="card mt-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800">Internal Assessment Marks</h2>
            <p className="text-sm text-slate-500">Mid Term, assignment, attendance and lab internal marks published by faculty</p>
          </div>
          {internalResults.map(result => (
            <div key={result._id} className="mb-5 last:mb-0">
              <h3 className="font-semibold text-slate-700 mb-2">Semester {result.semester} · {result.session || 'Session N/A'}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2">Item</th>
                      <th className="text-center px-3 py-2">Mid Term 1</th>
                      <th className="text-center px-3 py-2">Mid Term 2</th>
                      <th className="text-center px-3 py-2">Attendance</th>
                      <th className="text-center px-3 py-2">Assignment</th>
                      <th className="text-center px-3 py-2">Internal / CW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.subjectMarks || []).map((mark, index) => {
                      const lab = mark.itemType === 'lab' || mark.labId;
                      const item = lab ? mark.labId : mark.subjectId;
                      return (
                        <tr key={`${lab ? 'lab' : 'class'}:${item?._id || index}`} className="border-b border-slate-100">
                          <td className="px-3 py-2">{mark.itemName || item?.name || '—'} <span className="text-xs text-slate-400">({mark.itemCode || item?.code || 'NA'})</span></td>
                          <td className="text-center px-3 py-2">{lab ? '—' : (mark.midTerm1 ?? '—')}</td>
                          <td className="text-center px-3 py-2">{lab ? '—' : (mark.midTerm2 ?? '—')}</td>
                          <td className="text-center px-3 py-2">{lab ? (mark.attendanceMarks ?? '—') : '—'}</td>
                          <td className="text-center px-3 py-2">{mark.assignmentMarks ?? '—'}</td>
                          <td className="text-center px-3 py-2 font-semibold">{lab ? `${mark.sw ?? mark.internalMarks ?? '—'} / 40` : `${mark.cw ?? '—'} / 30`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
