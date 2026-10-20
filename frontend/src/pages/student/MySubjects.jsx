import React, { useEffect, useState } from 'react';
import { BookOpen, FlaskConical, FileText, UserCheck, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

const SchemaCard = ({ item, isLab }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-2 ${isLab ? 'bg-emerald-50 text-emerald-700' : 'bg-primary-50 text-primary-700'}`}>
            {isLab ? <FlaskConical className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
          </div>
          <div>
            <p className="font-mono text-xs font-semibold text-slate-500">{item.code}</p>
            <h3 className="font-semibold text-slate-800">{item.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="badge-blue">{item.category || 'PCC'}</span>
              <span>L-T-P {item.l ?? 0}-{item.t ?? 0}-{item.p ?? 0}</span>
              <span>{item.credits} cr.</span>
            </div>
          </div>
        </div>
        {item.syllabusFile && (
          <a href={item.syllabusFile} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
            <Download className="h-3.5 w-3.5" />Syllabus
          </a>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <UserCheck className="h-4 w-4 text-slate-400" />
        {item.faculty && item.faculty.length
          ? <span>{item.faculty.map(f => `${f.firstName} ${f.lastName}`).join(', ')}</span>
          : <span className="italic text-slate-400">Faculty not assigned</span>}
      </div>

      {item.syllabusText && (
        <div className="mt-3">
          <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
            <FileText className="h-3.5 w-3.5" />{open ? 'Hide syllabus' : 'View syllabus'}
          </button>
          {open && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{item.syllabusText}</p>}
        </div>
      )}
    </div>
  );
};

export default function MySubjects() {
  const [data, setData] = useState({ subjects: [], labs: [], session: '', semester: null, term: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/subjects')
      .then(({ data: res }) => setData(res.data))
      .catch(() => toast.error('Failed to load subjects'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>;

  const empty = !data.subjects.length && !data.labs.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary-50 p-3 text-primary-700"><BookOpen className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Subjects</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.session ? `${data.session} · Semester ${data.semester} · ${data.term}` : 'No active session'}
          </p>
        </div>
      </div>

      {empty ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="font-medium text-slate-600">Is session ke liye koi subject assign nahi hua</p>
        </div>
      ) : (
        <>
          {data.subjects.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-700">Theory Subjects</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {data.subjects.map(item => <SchemaCard key={item._id} item={item} isLab={false} />)}
              </div>
            </div>
          )}
          {data.labs.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-700">Labs</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {data.labs.map(item => <SchemaCard key={item._id} item={item} isLab />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
