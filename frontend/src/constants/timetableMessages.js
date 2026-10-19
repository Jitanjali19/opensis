export const TIMETABLE_MESSAGES = {
  TODAY_CLASSES: "Today's Class Schedule",
  TODAY_HOLIDAY: "Today is a holiday",
  NO_CLASSES_WEEKEND: (dayName) => `No classes today (${dayName})`,
  NO_CLASSES_TODAY: "You have no classes scheduled for today.",
  NEXT_CLASS: (day, time) => `Next class: ${day}, ${time}`,
  LOAD_ERROR: "Unable to load the schedule. Please try again.",
  LOAD_FAILED_HEADING: "Unable to load the schedule",
  RETRY: "Retry",
  VIEW_FULL_TIMETABLE: "View Full Timetable",
  BATCH_MISSING_NOTICE: "Your lab batch has not been assigned yet. Showing labs for all batches. Please contact the administrator.",
  SELECT_ALL_FILTERS: "Please select all filters to view the timetable.",
  NO_CLASSES_ASSIGNED: "No classes are assigned to you for the selected academic year and semester.",
  CLASSES_IN_ALTERNATE_YEAR: (year) => ` Your classes are assigned in academic year ${year}. Please select it from the filter.`,
  NO_SUBJECTS_AVAILABLE: "No lab or theory subjects are available. Please add them under Subjects & Labs.",
  NO_FACULTY_ASSIGNED: "No faculty is assigned to this subject. Please assign faculty under Subjects & Labs.",
  DURATION_LAB: "2 slots (lab)",
  DURATION_THEORY: "1 slot (theory)",
  ADD_CLASS: "Add Class",
  EDIT_TIMETABLE_ENTRY: "Edit Timetable Entry",
  ADD_TIMETABLE_CLASS: "Add Timetable Class",
};

export default TIMETABLE_MESSAGES;
