import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { BarChart3, MessageSquare, Star, TrendingDown, Users } from 'lucide-react';

const metrics = [
  ['knowledge', 'Knowledge'],
  ['clarity', 'Clarity'],
  ['punctuality', 'Punctuality'],
  ['interaction', 'Interaction'],
  ['doubtSolving', 'Doubt solving'],
  ['fairness', 'Fairness'],
];

export default function FacultyFeedback() {
  const [data, setData] = useState({ feedback: [], analytics: [], overview: {} });
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    api.get('/faculty/feedback')
      .then(response => setData(response.data.data))
      .finally(() => setLoading(false));
  }, []);

  const overview = data.overview || {};
  const needsAttention = data.analytics.filter(item => item.average <= 2.5);

  const individualAverage = item => {
    const values = metrics.map(([key]) => Number(item.ratings?.[key])).filter(Number.isFinite);
    return values.length
      ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2)
      : '0.00';
  };

  const activeGroup = data.analytics[activeIdx];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Student Feedback</h1>
        <p className="mt-1 text-sm text-slate-500">Anonymous feedback summary for your subjects</p>
      </div>

      {loading ? (
        <div className="card">Loading feedback...</div>
      ) : data.feedback.length === 0 ? (
        <div className="card py-12 text-center">
          <MessageSquare className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">No feedback received yet</p>
        </div>
      ) : (
        <>
          {/* ── Summary cards ── */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [MessageSquare, 'Total responses', overview.totalResponses || 0],
              [Star, 'Overall average', `${overview.overallAverage || 0}/5`],
              [Users, 'With comments', `${overview.commentsCount || 0} (${overview.commentRate || 0}%)`],
              [BarChart3, 'Subjects reviewed', data.analytics.length],
            ].map(([Icon, label, value]) => (
              <div className="card" key={label}>
                <Icon className="mb-3 h-5 w-5 text-primary-600" />
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          {/* ── Charts row ── */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="card">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-800">How students rated your teaching</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Average score across all subjects and respondents per criterion.
                  </p>
                </div>
                <div className="rounded-lg bg-primary-50 px-4 py-2 text-right">
                  <p className="text-xs text-primary-700">Overall teaching rating</p>
                  <p className="text-xl font-bold text-primary-800">{overview.overallAverage || 0} / 5</p>
                </div>
              </div>
              {metrics.map(([key, label]) => (
                <div className="mb-3" key={key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{label}</span>
                    <strong>{overview.criterionAverages?.[key] || 0} / 5</strong>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-primary-600 transition-all duration-500"
                      style={{ width: `${((overview.criterionAverages?.[key] || 0) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
                <TrendingDown className="h-5 w-5 text-rose-600" /> Subject summary
              </h2>
              <p className="text-sm text-slate-600">
                Highest combined average:{' '}
                <b>{overview.strongestSubject?.subject?.code || '—'}</b>{' '}
                ({overview.strongestSubject?.average || 0}/5)
              </p>
              {needsAttention.length ? (
                <>
                  <p className="mt-3 text-sm font-medium text-rose-700">
                    Needs attention (overall average ≤ 2.5/5):
                  </p>
                  {needsAttention.map(item => (
                    <p className="mt-1 text-sm text-rose-700" key={item.subject?._id}>
                      {item.subject?.code} — {item.subject?.name}: <b>{item.average}/5</b> from{' '}
                      {item.count} responses
                    </p>
                  ))}
                </>
              ) : (
                <p className="mt-3 text-sm text-emerald-700">No subject currently needs attention.</p>
              )}
            </div>
          </div>

          {/* ── Subject tab bar ── */}
          {data.analytics.length > 0 && (
            <div className="card mb-6 p-1.5">
              <div className="flex flex-wrap gap-1.5">
                {data.analytics.map((group, idx) => {
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      key={group.subject?._id ?? idx}
                      onClick={() => setActiveIdx(idx)}
                      className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-150 ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      <span>{group.subject?.code || `Subject ${idx + 1}`}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {group.average}/5
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Active subject panel ── */}
          {activeGroup && (
            <div className="card">
              {/* Header */}
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-800">
                    {activeGroup.subject?.code} — {activeGroup.subject?.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {activeGroup.count} anonymous response(s) for this subject
                  </p>
                </div>
                <div className="rounded-lg bg-primary-50 px-4 py-2 text-right">
                  <p className="text-xs text-primary-700">Subject overall average</p>
                  <p className="text-lg font-bold text-primary-800">{activeGroup.average} / 5</p>
                </div>
              </div>

              {/* Metric chips */}
              <div className="mb-5 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-3">
                {metrics.map(([key, label]) => (
                  <div className="rounded-lg bg-slate-50 p-3" key={key}>
                    <p className="text-slate-500">{label}</p>
                    <p className="mt-0.5 text-base font-bold text-slate-800">{activeGroup[key]} / 5</p>
                  </div>
                ))}
              </div>

              {/* Individual responses */}
              <div>
                <p className="border-t border-slate-100 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Individual anonymous responses
                </p>
                <div className="mt-2 space-y-3">
                  {data.feedback
                    .filter(item => String(item.subjectId?._id) === String(activeGroup.subject?._id))
                    .map(item => (
                      <div className="border-t border-slate-100 pt-3" key={item._id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-slate-400">Anonymous response</p>
                          <p className="text-sm font-semibold text-primary-700">
                            This response average: {individualAverage(item)} / 5
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {metrics
                            .map(([key, label]) => `${label} ${item.ratings?.[key] || '-'}/5`)
                            .join(' · ')}
                        </p>
                        {item.comments && (
                          <p className="mt-1.5 text-sm text-slate-600">{item.comments}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
