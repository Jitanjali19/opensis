const {
  termForSemester,
  normalizeFacultyIds,
  normalizeElectiveOptions,
  planAssignmentReconciliation,
  isLegacySession,
} = require('../src/utils/scheme');

describe('scheme utilities', () => {
  test('termForSemester derives the term from semester parity, not the calendar month', () => {
    expect(termForSemester(5)).toBe('july-december');
    expect(termForSemester(6)).toBe('january-june');
    expect(termForSemester('3')).toBe('july-december');
    expect(termForSemester(8)).toBe('january-june');
  });

  test('normalizeFacultyIds accepts arrays, comma strings and JSON strings without duplicates', () => {
    expect(normalizeFacultyIds(['a', 'b', 'a'])).toEqual(['a', 'b']);
    expect(normalizeFacultyIds('a, b ,c')).toEqual(['a', 'b', 'c']);
    expect(normalizeFacultyIds('["x","y","x"]')).toEqual(['x', 'y']);
    expect(normalizeFacultyIds('')).toEqual([]);
    expect(normalizeFacultyIds(undefined)).toEqual([]);
  });

  test('normalizeElectiveOptions accepts arrays, newline strings and JSON strings', () => {
    expect(normalizeElectiveOptions(['A', 'B'])).toEqual(['A', 'B']);
    expect(normalizeElectiveOptions('A\nB\n')).toEqual(['A', 'B']);
    expect(normalizeElectiveOptions('["A","B"]')).toEqual(['A', 'B']);
    expect(normalizeElectiveOptions(null)).toEqual([]);
  });

  test('isLegacySession flags missing or blank sessions', () => {
    expect(isLegacySession(null)).toBe(true);
    expect(isLegacySession('')).toBe(true);
    expect(isLegacySession('   ')).toBe(true);
    expect(isLegacySession('2025-2026')).toBe(false);
  });

  test('planAssignmentReconciliation inserts new faculty before removing stale ones', () => {
    const existing = [
      { _id: 'row-keep', facultyId: 'f1' },
      { _id: 'row-drop', facultyId: { _id: 'f2' } },
    ];
    const { toAdd, toRemove } = planAssignmentReconciliation(['f1', 'f3'], existing);
    // f3 must be added; f2's row must be removed. f1 stays untouched.
    expect(toAdd).toEqual(['f3']);
    expect(toRemove).toEqual(['row-drop']);
  });

  test('planAssignmentReconciliation is a no-op when the desired set is unchanged', () => {
    const existing = [{ _id: 'r1', facultyId: 'f1' }, { _id: 'r2', facultyId: 'f2' }];
    const { toAdd, toRemove } = planAssignmentReconciliation(['f1', 'f2'], existing);
    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });
});
