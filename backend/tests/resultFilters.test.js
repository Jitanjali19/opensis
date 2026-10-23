const {
  semesterOptionsForTerm,
  termValidationError,
  summarizeMarksStatus,
  resultStatusFor,
} = require('../src/utils/resultFilters');

describe('resultFilters', () => {
  test('maps terms to their semester options', () => {
    expect(semesterOptionsForTerm('july-december')).toEqual([1, 3, 5, 7]);
    expect(semesterOptionsForTerm('january-june')).toEqual([2, 4, 6, 8]);
    expect(semesterOptionsForTerm('unknown')).toEqual([]);
  });

  test('validates semester and term parity', () => {
    expect(termValidationError('5', 'july-december')).toBe('');
    expect(termValidationError('6', 'january-june')).toBe('');
    expect(termValidationError('5', 'january-june')).toMatch(/does not match/i);
    expect(termValidationError('5', 'invalid')).toMatch(/invalid/i);
    expect(termValidationError('5', '')).toBe('');
  });

  test('summarizes marks submission and approval state', () => {
    expect(summarizeMarksStatus([], 3)).toMatchObject({
      status: 'not_started',
      totalItems: 3,
      uploaded: 0,
    });

    expect(summarizeMarksStatus([
      { totalMarks: 70, submissionStatus: 'approved' },
    ], 3)).toMatchObject({
      status: 'partial',
      uploaded: 1,
      approved: 1,
    });

    expect(summarizeMarksStatus([
      { totalMarks: 70, submissionStatus: 'approved' },
      { totalMarks: 65, submissionStatus: 'pending' },
    ], 2)).toMatchObject({
      status: 'pending_approval',
      uploaded: 2,
      approved: 1,
      pending: 1,
    });

    expect(summarizeMarksStatus([
      { totalMarks: 70, submissionStatus: 'approved' },
      { totalMarks: 65, submissionStatus: 'rejected' },
    ], 2)).toMatchObject({
      status: 'returned',
      rejected: 1,
    });

    expect(summarizeMarksStatus([
      { totalMarks: 70, submissionStatus: 'approved' },
      { totalMarks: 65, submissionStatus: 'approved' },
    ], 2)).toMatchObject({
      status: 'updated',
      uploaded: 2,
      approved: 2,
    });
  });

  test('classifies result generation and publish state', () => {
    expect(resultStatusFor(null, 0)).toBe('not_started');
    expect(resultStatusFor({ isGenerated: false, subjectMarks: [] }, 0)).toBe('not_started');
    expect(resultStatusFor({ isGenerated: false, subjectMarks: [{}] }, 1)).toBe('pending_generation');
    expect(resultStatusFor({ isGenerated: true, isPublished: false }, 2)).toBe('generated');
    expect(resultStatusFor({ isGenerated: true, isPublished: true }, 2)).toBe('published');
  });
});
