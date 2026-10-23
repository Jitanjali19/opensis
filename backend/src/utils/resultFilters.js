const SEMESTERS_BY_TERM = Object.freeze({
  'july-december': [1, 3, 5, 7],
  'january-june': [2, 4, 6, 8],
});

const semesterOptionsForTerm = (term) => SEMESTERS_BY_TERM[term] || [];

const termValidationError = (semester, term) => {
  if (!term) return '';
  const options = SEMESTERS_BY_TERM[term];
  if (!options) return 'Invalid academic term';
  if (semester && !options.includes(Number(semester))) {
    return 'Academic term does not match the selected semester';
  }
  return '';
};

const summarizeMarksStatus = (marks = [], expectedItems = 0) => {
  const items = Array.isArray(marks) ? marks : [];
  const uploadedItems = items.filter((mark) => mark && mark.totalMarks != null);
  const counts = { approved: 0, pending: 0, rejected: 0 };

  uploadedItems.forEach((mark) => {
    const status = counts[mark.submissionStatus] !== undefined ? mark.submissionStatus : 'pending';
    counts[status] += 1;
  });

  const totalItems = Math.max(Number(expectedItems) || 0, items.length);
  let status = 'not_started';
  if (uploadedItems.length > 0) {
    if (totalItems > uploadedItems.length) {
      status = 'partial';
    } else if (counts.rejected > 0) {
      status = 'returned';
    } else if (counts.pending > 0) {
      status = 'pending_approval';
    } else {
      status = 'updated';
    }
  }

  return {
    status,
    totalItems,
    uploaded: uploadedItems.length,
    ...counts,
  };
};

const resultStatusFor = (result, uploadedMarks = 0) => {
  if (!result) return 'not_started';
  if (result.isPublished) return 'published';
  if (result.isGenerated) return 'generated';
  if (uploadedMarks > 0 || (result.subjectMarks || []).length > 0) return 'pending_generation';
  return 'not_started';
};

module.exports = {
  SEMESTERS_BY_TERM,
  semesterOptionsForTerm,
  termValidationError,
  summarizeMarksStatus,
  resultStatusFor,
};
