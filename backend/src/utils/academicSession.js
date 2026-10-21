const normalizeSession = value => {
  const session = String(value || '').trim();
  const full = session.match(/^(\d{4})-(\d{4})$/);
  if (full) return session;
  const short = session.match(/^(\d{4})-(\d{2})$/);
  return short ? `${short[1]}-${Number(short[1]) + 1}` : session;
};

const semesterForTerm = (semester, term) => {
  const sem = Number(semester);
  if (!Number.isInteger(sem) || sem < 1) return null;
  if (term === 'july-december') return sem % 2 === 1 ? sem : Math.max(1, sem - 1);
  if (term === 'january-june') return sem % 2 === 0 ? sem : Math.min(8, sem + 1);
  return sem;
};

const getAcademicContext = (profile, selectedSession, history, requestedTerm) => {
  if (history?.session && history.semester) {
    return {
      session: normalizeSession(history.session),
      semester: Number(history.semester),
      year: Number(history.year) || Math.ceil(Number(history.semester) / 2),
      term: history.term || (Number(history.semester) % 2 === 0 ? 'january-june' : 'july-december'),
      branch: history.branch || profile?.branch,
      section: history.section ?? profile?.section,
    };
  }
  const currentSession = normalizeSession(profile?.session);
  const session = normalizeSession(selectedSession) || currentSession;
  const currentStart = Number(currentSession.slice(0, 4));
  const selectedStart = Number(session.slice(0, 4));
  const yearsBack = Number.isInteger(currentStart) && Number.isInteger(selectedStart)
    ? Math.max(0, currentStart - selectedStart)
    : 0;
  const baseSemester = Math.max(1, Number(profile?.currentSemester || 1) - yearsBack);
  const semester = semesterForTerm(baseSemester, requestedTerm) || baseSemester;
  return {
    session,
    semester,
    year: Math.ceil(semester / 2),
    term: requestedTerm || (semester % 2 === 0 ? 'january-june' : 'july-december'),
    branch: profile?.branch,
    section: profile?.section,
  };
};

module.exports = { normalizeSession, getAcademicContext };
