import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { TIMETABLE_SLOTS } from '../../constants/timetableSlots';
import { getDepartmentLabel } from '../../constants/departments';
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Coffee,
  FileText,
  FlaskConical,
  MapPin,
  MessageSquare,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const todayGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const todayDateLabel = () =>
  new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

const slotTimeLabel = (entry) => {
  const start = Number(entry.startSlot ?? entry.slots?.[0] ?? 0);
  const count = Number(entry.slotCount ?? entry.slots?.length ?? 1);
  const end = start + count - 1;
  const s = TIMETABLE_SLOTS[start];
  const e = TIMETABLE_SLOTS[end];
  if (!s) return '';
  return `${s.start}–${e?.end ?? s.end}`;
};

const sectionLabel = (section) => {
  if (!section) return null;
  const years = ['', 'I', 'II', 'III', 'IV'];
  const year = years[section.year] || section.year || '';
  return [section.department, year && section.sectionName ? `${year}-${section.sectionName}` : year || section.sectionName]
    .filter(Boolean).join(' ');
};

// ─── Status config (marks) ────────────────────────────────────────────────────

const STATUS_CFG = {
  rejected:    { label: 'Returned',    color: 'rose',    dot: 'bg-rose-500',    pill: 'bg-rose-50 text-rose-700 border-rose-200',    ring: 'border-l-rose-400',    order: 0 },
  not_started: { label: 'Not Started', color: 'amber',   dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700 border-amber-200',   ring: 'border-l-amber-400',   order: 1 },
  draft:       { label: 'Draft',       color: 'sky',     dot: 'bg-sky-500',     pill: 'bg-sky-50 text-sky-700 border-sky-200',         ring: 'border-l-sky-400',     order: 2 },
  pending:     { label: 'Submitted',   color: 'violet',  dot: 'bg-violet-500',  pill: 'bg-violet-50 text-violet-700 border-violet-200', ring: 'border-l-violet-400',  order: 3 },
  approved:    { label: 'Approved',    color: 'emerald', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', ring: 'border-l-emerald-400', order: 4 },
};

// ─── Attention item types ─────────────────────────────────────────────────────

const ITEM_TYPES = {
  MARKS_REJECTED:       'marks_rejected',
  ASSIGNMENT_OVERDUE:   'assignment_overdue',
  COMPLAINT_REPLIED:    'complaint_replied',
  COMPLAINT_ASSIGNED:   'complaint_assigned',
};

const ATTENTION_CFG = {
  [ITEM_TYPES.MARKS_REJECTED]:    { icon: XCircle,        color: 'rose',   label: 'Marks returned for revision',         link: '/faculty/marks',       linkLabel: 'Review & resubmit' },
  [ITEM_TYPES.ASSIGNMENT_OVERDUE]:{ icon: FileText,       color: 'orange', label: 'Assignment overdue — no submissions',  link: '/faculty/assignments', linkLabel: 'View assignment'   },
  [ITEM_TYPES.COMPLAINT_REPLIED]: { icon: MessageSquare,  color: 'violet', label: 'Admin replied to your complaint',      link: '/faculty/complaints',  linkLabel: 'View response'     },
  [ITEM_TYPES.COMPLAINT_ASSIGNED]:{ icon: Bell,           color: 'sky',    label: 'Complaint assigned to you',           link: '/faculty/complaints',  linkLabel: 'Take action'       },
};

const ATTENTION_COLOR = {
  rose:   { bg: 'bg-rose-50',   border: 'border-rose-200',   icon: 'text-rose-500',   link: 'text-rose-700 hover:text-rose-900'   },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: 'text-amber-500',  link: 'text-amber-700 hover:text-amber-900'  },
  sky:    { bg: 'bg-sky-50',    border: 'border-sky-200',    icon: 'text-sky-500',    link: 'text-sky-700 hover:text-sky-900'    },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-500', link: 'text-orange-700 hover:text-orange-900' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-500', link: 'text-violet-700 hover:text-violet-900' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, iconBg, iconColor, label, sub }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className={`w-6 h-6 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      </div>
      <div>
        <h2 className="font-semibold text-slate-800 text-sm leading-none">{label}</h2>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function AttentionItem({ type, detail }) {
  const cfg = ATTENTION_CFG[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const c = ATTENTION_COLOR[cfg.color];
  return (
    <div className={`flex items-start gap-3 rounded-xl border ${c.border} ${c.bg} px-4 py-3 transition-all hover:shadow-sm`}>
      <div className={`mt-0.5 shrink-0 ${c.icon}`}><Icon className="h-4 w-4" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{cfg.label}</p>
        <p className="text-sm font-medium text-slate-800 truncate">{detail}</p>
      </div>
      <Link to={cfg.link} className={`shrink-0 text-xs font-semibold underline underline-offset-2 transition-colors ${c.link}`}>
        {cfg.linkLabel} →
      </Link>
    </div>
  );
}

const CLASS_ACCENTS = [
  { ring: 'border-l-indigo-400', timeBg: 'bg-indigo-50 text-indigo-700', pill: 'bg-indigo-100 text-indigo-700' },
  { ring: 'border-l-violet-400', timeBg: 'bg-violet-50 text-violet-700', pill: 'bg-violet-100 text-violet-700' },
  { ring: 'border-l-teal-400',   timeBg: 'bg-teal-50 text-teal-700',     pill: 'bg-teal-100 text-teal-700'    },
  { ring: 'border-l-sky-400',    timeBg: 'bg-sky-50 text-sky-700',       pill: 'bg-sky-100 text-sky-700'      },
];

function TodayClassCard({ entry, index }) {
  const ac = CLASS_ACCENTS[index % CLASS_ACCENTS.length];
  const time = slotTimeLabel(entry);
  const sec = sectionLabel(entry.section);
  return (
    <div className={`flex items-center gap-4 rounded-xl border border-slate-200 border-l-4 ${ac.ring} bg-white px-4 py-3.5 shadow-sm transition-all hover:shadow-md hover:-translate-y-px`}>
      <div className={`hidden sm:flex shrink-0 items-center justify-center rounded-lg px-3 py-2 text-xs font-bold min-w-[88px] text-center ${ac.timeBg}`}>
        {time || '—'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-slate-800 text-sm truncate">{entry.subject?.name || entry.subject?.code || 'Unnamed Subject'}</p>
          {entry.subject?.code && (
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${ac.pill}`}>
              {entry.subject.code}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
          {time && <span className="sm:hidden font-medium text-slate-700">{time}</span>}
          {sec && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{sec}</span>}
          {entry.batch && <span className="flex items-center gap-1"><Users className="h-3 w-3" />Batch: {entry.batch}</span>}
          {entry.room?.name && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{entry.room.name}</span>}
        </div>
      </div>
      <Link
        to="/faculty/attendance"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 hover:shadow-md active:scale-95"
      >
        <ClipboardCheck className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Mark Attendance</span>
        <span className="sm:hidden">Attend.</span>
      </Link>
    </div>
  );
}

function SubjectCard({ subj, stat, pendingCount }) {
  const status = stat?.status || 'not_started';
  const sc = STATUS_CFG[status] || STATUS_CFG.not_started;
  const isLab = subj.itemType === 'lab';

  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200 border-l-4 ${sc.ring} bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden`}>
      {/* Card body */}
      <div className="flex-1 p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isLab ? 'bg-teal-50' : 'bg-indigo-50'}`}>
              {isLab
                ? <FlaskConical className="w-4 h-4 text-teal-600" />
                : <BookOpen className="w-4 h-4 text-indigo-600" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm leading-tight truncate">{subj.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{subj.code}</p>
            </div>
          </div>
          {/* Status pill */}
          <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${sc.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
            {sc.label}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
          {/* Type badge */}
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium ${isLab ? 'bg-teal-50 text-teal-700' : 'bg-indigo-50 text-indigo-700'}`}>
            {isLab ? 'Lab' : 'Class'}
          </span>
          {/* Branch + Sem */}
          {subj.branch && <span>{getDepartmentLabel(subj.branch)}</span>}
          {subj.semester && <span>Sem {subj.semester}</span>}
          {/* Credits */}
          {subj.credits && (
            <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
              {subj.credits} Cr
            </span>
          )}
        </div>

        {/* Rejection reason */}
        {status === 'rejected' && stat?.rejectionReason && (
          <p className="mt-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-1.5 border border-rose-100 line-clamp-2">
            ⚠ {stat.rejectionReason}
          </p>
        )}

        {/* Pending assignments badge */}
        {pendingCount > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            {pendingCount} pending assignment{pendingCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Card footer action */}
      <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50/60">
        <Link
          to="/faculty/marks"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Open Marks Sheet →
        </Link>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function FacultyDashboard() {
  const { user, selectedSession } = useAuth();

  // ── Shared data state ──────────────────────────────────────────────────────
  const [subjects, setSubjects]             = useState([]);
  const [subjectStats, setSubjectStats]     = useState({});  // keyed by subject._id
  const [assignments, setAssignments]       = useState([]);
  const [myComplaints, setMyComplaints]     = useState([]);  // submitted by me
  const [assignedComplaints, setAssignedComplaints] = useState([]); // assigned to me to handle
  const [dataLoading, setDataLoading]       = useState(true);

  // ── Timetable state ────────────────────────────────────────────────────────
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(true);

  const todayDay  = useMemo(() => new Date().getDay(), []);
  const isWeekend = todayDay === 0 || todayDay === 6;

  const todayClasses = useMemo(
    () => timetableEntries
      .filter((e) => Number(e.day) === todayDay)
      .sort((a, b) => Number(a.startSlot) - Number(b.startSlot)),
    [timetableEntries, todayDay]
  );

  // ── Load timetable (independent) ──────────────────────────────────────────
  useEffect(() => {
    api.get('/timetable/me/faculty')
      .then(({ data }) => setTimetableEntries(data?.data?.entries || []))
      .catch(() => {})
      .finally(() => setTimetableLoading(false));
  }, []);

  // ── Load subjects + marks + assignments (shared) ───────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      try {
        const session = selectedSession || localStorage.getItem('erp_academic_session') || '';

        // Parallel: subjects + assignments + complaints
        const [subjectsRes, assignRes, myComplRes, assignedComplRes] = await Promise.all([
          api.get('/faculty/subjects'),
          api.get('/faculty/assignments').catch(() => ({ data: { data: { assignments: [] } } })),
          api.get('/complaints/mine?allTerms=true').catch(() => ({ data: { data: { complaints: [] } } })),
          api.get('/complaints/assigned?allTerms=true').catch(() => ({ data: { data: { complaints: [] } } })),
        ]);

        const loadedSubjects    = subjectsRes.data?.data?.subjects    || [];
        const loadedAssignments = assignRes.data?.data?.assignments  || [];
        const loadedMineCompl   = myComplRes.data?.data?.complaints  || [];
        const loadedAssignCompl = assignedComplRes.data?.data?.complaints || [];

        if (cancelled) return;
        setSubjects(loadedSubjects);
        setAssignments(loadedAssignments);
        setMyComplaints(loadedMineCompl);
        setAssignedComplaints(loadedAssignCompl);

        // Fetch marks per distinct semester (same pattern as Marks.jsx)
        if (loadedSubjects.length > 0 && session) {
          const semesters = [...new Set(loadedSubjects.map((s) => Number(s.semester)).filter(Boolean))];

          const resultsArrays = await Promise.all(
            semesters.map((sem) =>
              api
                .get(`/faculty/marks?semester=${sem}&session=${encodeURIComponent(session)}`)
                .then((r) => r.data?.data?.results || [])
                .catch(() => [])
            )
          );
          const allResults = resultsArrays.flat();

          if (cancelled) return;

          // Build stats per subject — same logic as Marks.jsx
          const stats = {};
          loadedSubjects.forEach((subj) => {
            const isLab = subj.itemType === 'lab';
            const marksList = [];
            allResults.forEach((r) => {
              const mark = (r.subjectMarks || []).find((sm) =>
                isLab
                  ? String(sm.labId?._id   || sm.labId)   === String(subj._id)
                  : String(sm.subjectId?._id || sm.subjectId) === String(subj._id)
              );
              if (mark && mark.totalMarks != null) marksList.push(mark);
            });

            let status = 'not_started';
            let rejectionReason = '';
            if (marksList.length > 0) {
              const hasRejected = marksList.some((m) => m.submissionStatus === 'rejected');
              const hasPending  = marksList.some((m) => m.submissionStatus === 'pending');
              const allApproved = marksList.every((m) => m.submissionStatus === 'approved');
              const hasDraft    = marksList.some((m) => !m.submissionStatus || m.submissionStatus === 'draft');
              if (hasRejected) {
                status = 'rejected';
                const rj = marksList.find((m) => m.submissionStatus === 'rejected' && m.rejectionReason);
                if (rj) rejectionReason = rj.rejectionReason;
              } else if (allApproved) {
                status = 'approved';
              } else if (hasPending) {
                status = 'pending';
              } else if (hasDraft) {
                status = 'draft';
              }
            }
            stats[subj._id] = { status, rejectionReason };
          });

          setSubjectStats(stats);
        }
      } catch {
        // Never crash the dashboard
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSession]);

  // ── Derived: attention items (from shared data) ────────────────────────────
  const attentionItems = useMemo(() => {
    const items = [];
    const now = new Date();

    // Only show marks that need action: rejected (returned by admin for revision)
    subjects.forEach((subj) => {
      const stat = subjectStats[subj._id];
      const status = stat?.status || 'not_started';
      const label = `${subj.code} — ${subj.name}`;
      if (status === 'rejected') items.push({ type: ITEM_TYPES.MARKS_REJECTED, detail: label, _key: `rj_${subj._id}` });
      // not_started / draft → faculty can check marks page themselves; not shown here
    });

    // Overdue assignments with zero submissions
    assignments.forEach((asgn) => {
      if (!asgn.dueDate) return;
      if (new Date(asgn.dueDate) >= now) return;
      if ((asgn.submissions?.length || 0) === 0) {
        items.push({ type: ITEM_TYPES.ASSIGNMENT_OVERDUE, detail: asgn.title, _key: `asgn_${asgn._id}` });
      }
    });

    // Complaints I submitted that have received an admin/handler response
    myComplaints.forEach((c) => {
      if (c.adminResponse && c.adminResponse.trim()) {
        items.push({
          type: ITEM_TYPES.COMPLAINT_REPLIED,
          detail: c.subject || 'Your complaint',
          _key: `cr_${c._id}`,
        });
      }
    });

    // Complaints assigned to me to handle that are still pending/in_review
    assignedComplaints.forEach((c) => {
      if (c.status === 'pending' || c.status === 'in_review') {
        items.push({
          type: ITEM_TYPES.COMPLAINT_ASSIGNED,
          detail: c.subject || 'Complaint',
          _key: `ca_${c._id}`,
        });
      }
    });

    const order = {
      [ITEM_TYPES.MARKS_REJECTED]:    0,
      [ITEM_TYPES.COMPLAINT_REPLIED]: 1,
      [ITEM_TYPES.COMPLAINT_ASSIGNED]:2,
      [ITEM_TYPES.ASSIGNMENT_OVERDUE]:3,
    };
    return items.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
  }, [subjects, subjectStats, assignments, myComplaints, assignedComplaints]);

  // ── Derived: pending assignments per subject ───────────────────────────────
  const pendingBySubject = useMemo(() => {
    const now = new Date();
    const map = {};
    assignments.forEach((asgn) => {
      // future-due assignments (or no due date) = "pending" for students
      const isPending = !asgn.dueDate || new Date(asgn.dueDate) >= now;
      if (!isPending) return;
      const key = asgn.itemType === 'lab' ? String(asgn.labId?._id || asgn.labId) : String(asgn.subjectId?._id || asgn.subjectId);
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [assignments]);

  // ── Derived: sorted subjects for "My Subjects" ─────────────────────────────
  const sortedSubjects = useMemo(() => {
    return [...subjects].sort((a, b) => {
      const oa = STATUS_CFG[subjectStats[a._id]?.status || 'not_started']?.order ?? 99;
      const ob = STATUS_CFG[subjectStats[b._id]?.status || 'not_started']?.order ?? 99;
      return oa - ob;
    });
  }, [subjects, subjectStats]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{todayDateLabel()}</p>
        <h1 className="text-2xl font-bold text-slate-800">
          {todayGreeting()}, Prof. {user?.profile?.firstName}! 👋
        </h1>
        <p className="text-sm text-slate-500">
          {getDepartmentLabel(user?.profile?.department)} Department
          {user?.profile?.designation ? ` · ${user.profile.designation}` : ''}
        </p>
      </div>

      {/* ── Needs Attention ── */}
      <section>
        <SectionHeading icon={Bell} iconBg="bg-amber-100" iconColor="text-amber-600" label="Needs Attention" />

        {dataLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : attentionItems.length === 0 ? (
          <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800 text-sm">You're all caught up!</p>
              <p className="text-xs text-emerald-600 mt-0.5">No returned marks, overdue assignments, or unread complaint updates.</p>
            </div>
            <Sparkles className="ml-auto w-5 h-5 text-emerald-400 shrink-0" />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
            {attentionItems.map((item) => <AttentionItem key={item._key} type={item.type} detail={item.detail} />)}
          </div>
        )}
      </section>

      {/* ── Today's Classes ── */}
      <section>
        <SectionHeading
          icon={CalendarDays}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
          label="Today's Classes"
          sub={isWeekend ? 'Weekend — no scheduled classes' : undefined}
        />

        {timetableLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
            {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : isWeekend ? (
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Coffee className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-sm">It's the weekend!</p>
              <p className="text-xs text-slate-400 mt-0.5">No classes scheduled today. Enjoy your break.</p>
            </div>
          </div>
        ) : todayClasses.length === 0 ? (
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-sm">No classes today</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Your timetable has no entries for today.{' '}
                <Link to="/faculty/timetable" className="text-indigo-600 hover:underline">View full timetable →</Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
            {todayClasses.map((entry, idx) => <TodayClassCard key={entry._id} entry={entry} index={idx} />)}
            <div className="pt-1 text-right">
              <Link to="/faculty/timetable" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                View full week timetable →
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ── My Subjects ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionHeading
            icon={BookOpen}
            iconBg="bg-violet-100"
            iconColor="text-violet-600"
            label="My Subjects"
            sub={dataLoading ? '' : `${subjects.length} subject${subjects.length !== 1 ? 's' : ''} assigned this session`}
          />
          <Link
            to="/faculty/marks"
            className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors shrink-0"
          >
            Open Marks →
          </Link>
        </div>

        {dataLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : sortedSubjects.length === 0 ? (
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-sm">No subjects assigned</p>
              <p className="text-xs text-slate-400 mt-0.5">Your assigned subjects for this session will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedSubjects.map((subj) => {
              const pending = pendingBySubject[String(subj._id)] || 0;
              return (
                <SubjectCard
                  key={subj._id}
                  subj={subj}
                  stat={subjectStats[subj._id]}
                  pendingCount={pending}
                />
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
