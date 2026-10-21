const termForSemester = (semester) => (Number(semester) % 2 === 0 ? 'january-june' : 'july-december');

const normalizeFacultyIds = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return normalizeFacultyIds(parsed);
      } catch {
        // fall through to comma split
      }
    }
    return [...new Set(trimmed.split(',').map((item) => item.trim()).filter(Boolean))];
  }
  return [];
};

const normalizeElectiveOptions = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item || '').trim()).filter(Boolean);
        }
      } catch {
        // fall through to newline split
      }
    }
    return trimmed.split('\n').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const facultyIdOf = (assignment) => {
  const value = assignment && assignment.facultyId;
  if (value && typeof value === 'object' && value._id) return String(value._id);
  return String(value || '');
};

// Computes which faculty rows must be inserted and which removed so that a failed
// sync never deletes data before the replacements are persisted.
const planAssignmentReconciliation = (desiredIds = [], existingAssignments = []) => {
  const desired = [...new Set(desiredIds.map((id) => String(id)).filter(Boolean))];
  const existingFaculty = new Set(existingAssignments.map(facultyIdOf).filter(Boolean));

  const toAdd = desired.filter((id) => !existingFaculty.has(id));
  const toRemove = existingAssignments
    .filter((assignment) => {
      const id = facultyIdOf(assignment);
      return id && !desired.includes(id);
    })
    .map((assignment) => assignment._id)
    .filter(Boolean);

  return { toAdd, toRemove };
};

const isLegacySession = (session) => !session || !String(session).trim();

module.exports = {
  termForSemester,
  normalizeFacultyIds,
  normalizeElectiveOptions,
  planAssignmentReconciliation,
  isLegacySession,
};
