import React, { useEffect, useState } from 'react';
import { BookOpen, FlaskConical, FileText, UserCheck, Download, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { resolveAssetUrl } from '../../utils/assetUrl';

const semLabel = (sem) => {
  if (sem === 1) return 'Sem A';
  if (sem === 2) return 'Sem B';
  return `Sem ${sem}`;
};

const SubjectCard = ({ item, isLab }) => {
  const [open, setOpen] = useState(false);
  const total = (item.theoryEndMax || 0) + (item.cwMax || 0) + (item.practicalEndMax || 0) + (item.swMax || 0);

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md ${isLab ? 'border-emerald-200' : 'border-slate-200'}`}>
      {/* Colour stripe */}
      <div className={`h-1 w-full ${isLab ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : 'bg-gradient-to-r from-primary-500 to-indigo-500'}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`rounded-xl p-2 flex-shrink-0 ${isLab ? 'bg-emerald-50 text-emerald-700' : 'bg-primary-50 text-primary-700'}`}>
            {isLab ? <FlaskConical className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs font-semibold text-slate-500 mb-0.5">{item.code}</p>
            <h3 className="font-semibold text-slate-800 leading-snug">{item.name}</h3>
          </div>
        </div>

        {/* Meta pills */}
        <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
          <span className="bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5">{semLabel(item.semester)}</span>
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${isLab ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-100 text-primary-700'}`}>
            {item.credits} Cr
          </span>
          <span className="bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 font-mono">
            L-T-P {item.l ?? 0}-{item.t ?? 0}-{item.p ?? 0}
          </span>
        </div>

        {/* Marks */}
        {total > 0 && (
          <div className="grid grid-cols-4 gap-1 text-xs mb-3">
            {item.theoryEndMax > 0 && (
              <div className="bg-slate-50 rounded-lg text-center py-1.5 px-1">
                <div className="font-bold text-slate-700">{item.theoryEndMax}</div>
                <div className="text-slate-400">Theory</div>
              </div>
            )}
            {item.cwMax > 0 && (
              <div className="bg-slate-50 rounded-lg text-center py-1.5 px-1">
                <div className="font-bold text-slate-700">{item.cwMax}</div>
                <div className="text-slate-400">CW</div>
              </div>
            )}
            {item.practicalEndMax > 0 && (
              <div className="bg-emerald-50 rounded-lg text-center py-1.5 px-1">
                <div className="font-bold text-emerald-700">{item.practicalEndMax}</div>
                <div className="text-emerald-600">Practical</div>
              </div>
            )}
            {item.swMax > 0 && (
              <div className="bg-emerald-50 rounded-lg text-center py-1.5 px-1">
                <div className="font-bold text-emerald-700">{item.swMax}</div>
                <div className="text-emerald-600">SW</div>
              </div>
            )}
          </div>
        )}

        {/* Faculty */}
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
          <UserCheck className="h-4 w-4 text-slate-400 flex-shrink-0" />
          {item.faculty && item.faculty.length
            ? <span className="text-sm">{item.faculty.map(f => `${f.firstName} ${f.lastName}`).join(', ')}</span>
            : <span className="italic text-slate-400 text-sm">Faculty not assigned</span>}
        </div>

        {/* Batch badge for labs */}
        {isLab && (
          <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 mb-2 ${item.myBatch ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
            <Layers className="w-3.5 h-3.5" />
            {item.myBatch ? <span>Your batch: <strong>{item.myBatch}</strong></span> : <span>Batch not assigned yet</span>}
          </div>
        )}

        {/* Syllabus */}
        {item.syllabusText && (
          <div className="mt-2">
            <button type="button" onClick={() => setOpen(o => !o)}
              className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
              <FileText className="h-3.5 w-3.5" />{open ? 'Hide' : 'View'} Syllabus
              {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {open && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600 max-h-40 overflow-y-auto border border-slate-200">
                {item.syllabusText}
              </p>
            )}
          </div>
        )}

        {/* Syllabus file */}
        {item.syllabusFile && (
          <a href={resolveAssetUrl(item.syllabusFile)} target="_blank" rel="noreferrer"
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-primary-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
            <Download className="h-3.5 w-3.5" /> Syllabus PDF
          </a>
        )}
      </div>
    </div>
  );
};

export default function MySubjects() {
  const { selectedSession, selectedTerm } = useAuth();
  const [data, setData] = useState({ subjects: [], labs: [], session: '', semester: null, term: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get('/student/subjects')
      .then(({ data: res }) => { if (active) setData(res.data); })
      .catch(() => { if (active) toast.error('Failed to load subjects'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedSession, selectedTerm]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
    </div>
  );

  const empty = !data.subjects.length && !data.labs.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-primary-50 p-3 text-primary-700">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Subjects & Labs</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.session
              ? `${data.session} · ${semLabel(data.semester)} · ${data.term}`
              : 'No active session'}
          </p>
        </div>
      </div>

      {empty ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="font-medium text-slate-600">Is session ke liye koi subject assign nahi hua</p>
          <p className="text-sm text-slate-400 mt-1">Apne admin se contact karein</p>
        </div>
      ) : (
        <>
          {data.subjects.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary-600" />
                  <h2 className="text-lg font-bold text-slate-800">Theory Subjects</h2>
                </div>
                <span className="bg-primary-100 text-primary-700 text-xs font-semibold rounded-full px-2.5 py-0.5">{data.subjects.length}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {data.subjects.map(item => <SubjectCard key={item._id} item={item} isLab={false} />)}
              </div>
            </section>
          )}

          {data.labs.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold text-slate-800">Labs</h2>
                </div>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full px-2.5 py-0.5">{data.labs.length}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {data.labs.map(item => <SubjectCard key={item._id} item={item} isLab />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
