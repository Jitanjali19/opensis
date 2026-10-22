import React, { useState } from 'react';
import { getDepartmentLabel } from '../../../constants/departments';
import { 
  BookOpen, 
  FlaskConical, 
  Users, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  CircleDot, 
  Search, 
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  Download
} from 'lucide-react';

export default function MySubjectsView({
  subjects,
  loading,
  session,
  subjectStats,
  onSelectSubject,
  onDownloadTemplate,
  onDownloadSubmitted,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'class' | 'lab'

  const filteredSubjects = subjects.filter(subj => {
    const matchesSearch = 
      subj.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subj.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = 
      filterType === 'all' || 
      (filterType === 'class' && subj.itemType !== 'lab') ||
      (filterType === 'lab' && subj.itemType === 'lab');
    return matchesSearch && matchesType;
  });

  const getStatusBadge = (statusInfo) => {
    if (!statusInfo) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          <CircleDot className="w-3.5 h-3.5 text-slate-400" />
          Not Started
        </span>
      );
    }

    switch (statusInfo.status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span 
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200" 
            title={statusInfo.rejectionReason ? `Reason: ${statusInfo.rejectionReason}` : 'Submission returned by admin'}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Action Required
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Submitted · Pending Review
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <CircleDot className="w-3.5 h-3.5 text-sky-600" />
            Draft ({statusInfo.filledCount}/{statusInfo.totalStudents || '?'})
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <CircleDot className="w-3.5 h-3.5 text-slate-400" />
            Not Started
          </span>
        );
    }
  };

  const getActionButton = (subj, statusInfo) => {
    const isApproved = statusInfo?.status === 'approved';
    const isPending = statusInfo?.status === 'pending';
    const isDraft = statusInfo?.status === 'draft';
    const isRejected = statusInfo?.status === 'rejected';

    if (isApproved) {
      return (
        <button
          onClick={() => onSelectSubject(subj)}
          className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5 hover:border-emerald-300 hover:text-emerald-700"
        >
          View Marks
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      );
    }

    if (isPending) {
      return (
        <button
          onClick={() => onSelectSubject(subj)}
          className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5 hover:border-amber-300 hover:text-amber-700"
        >
          View / Edit
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      );
    }

    if (isRejected) {
      return (
        <button
          onClick={() => onSelectSubject(subj)}
          className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5 !from-rose-600 !to-rose-700"
        >
          Fix Marks
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      );
    }

    if (isDraft) {
      return (
        <button
          onClick={() => onSelectSubject(subj)}
          className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
        >
          Continue
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      );
    }

    return (
      <button
        onClick={() => onSelectSubject(subj)}
        className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
      >
        Enter Marks
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    );
  };

  // Metrics counts
  const totalCount = subjects.length;
  const approvedCount = subjects.filter(s => subjectStats[s._id]?.status === 'approved').length;
  const pendingCount = subjects.filter(s => subjectStats[s._id]?.status === 'pending').length;
  const rejectedCount = subjects.filter(s => subjectStats[s._id]?.status === 'rejected').length;
  const notStartedCount = subjects.filter(s => !subjectStats[s._id] || subjectStats[s._id]?.status === 'not_started').length;

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-white p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Subjects</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-slate-800">{totalCount}</span>
            <span className="text-xs text-slate-400">active items</span>
          </div>
        </div>

        <div className="card bg-white p-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Approved</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-emerald-700">{approvedCount}</span>
            <span className="text-xs text-emerald-600">finalized</span>
          </div>
        </div>

        <div className="card bg-white p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending Review</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-amber-700">{pendingCount}</span>
            <span className="text-xs text-amber-600">awaiting admin</span>
          </div>
        </div>

        <div className="card bg-white p-4">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Action Needed</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-2xl font-bold ${rejectedCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {rejectedCount > 0 ? `${rejectedCount} Returned` : `${notStartedCount} Pending`}
            </span>
            <span className="text-xs text-slate-400">to complete</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            className="input !pl-9 !py-2 text-sm w-full"
            placeholder="Search by code or subject name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filterType === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
            >
              All ({subjects.length})
            </button>
            <button
              onClick={() => setFilterType('class')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filterType === 'class' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
            >
              Theory Classes
            </button>
            <button
              onClick={() => setFilterType('lab')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${filterType === 'lab' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'}`}
            >
              Labs
            </button>
          </div>
        </div>
      </div>

      {/* Subjects List Table */}
      {loading ? (
        <div className="card py-16 text-center">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Loading your assigned subjects...</p>
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No subjects found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm ? 'No subjects matched your search term.' : 'You do not have any teaching assignments for the current academic session.'}
          </p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Semester</th>
                  <th className="py-3.5 px-4">Students</th>
                  <th className="py-3.5 px-4">Marks Scheme</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubjects.map(subj => {
                  const isLab = subj.itemType === 'lab';
                  const stat = subjectStats[subj._id];
                  const studentCount = stat?.totalStudents ?? stat?.studentsCount ?? '—';

                  return (
                    <tr 
                      key={subj._id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => onSelectSubject(subj)}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isLab ? 'bg-purple-50 text-purple-600' : 'bg-primary-50 text-primary-600'}`}>
                            {isLab ? <FlaskConical className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 group-hover:text-primary-600 transition-colors">
                              {subj.code}
                            </span>
                            <p className="text-xs text-slate-500 line-clamp-1">{subj.name}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${isLab ? 'bg-purple-100/70 text-purple-700' : 'bg-blue-100/70 text-blue-700'}`}>
                          {isLab ? 'Lab' : 'Class'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-slate-700 font-medium">
                        Sem {subj.semester} <span className="text-xs text-slate-400">({getDepartmentLabel(subj.branch)})</span>
                      </td>

                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 text-slate-700 text-xs font-medium">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {studentCount !== '—' ? `${studentCount} students` : 'Loading roster...'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-xs text-slate-500">
                        {isLab ? 'SW (40) + Practical (60)' : 'CW (30) + Theory (70)'}
                      </td>

                      <td className="py-4 px-4">
                        {getStatusBadge(stat)}
                        {stat?.status === 'rejected' && stat?.rejectionReason && (
                          <p className="text-[11px] text-rose-600 mt-1 max-w-xs truncate" title={stat.rejectionReason}>
                            "{stat.rejectionReason}"
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-end gap-2">
                          {getActionButton(subj, stat)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
