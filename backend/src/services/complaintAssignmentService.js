const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Section = require('../models/Section');
const TimetableEntry = require('../models/TimetableEntry');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');
const { resolveStudentSection } = require('../utils/sectionResolver');

/**
 * Helper to resolve subject-to-faculty mapping uniquely and safely.
 * Returns { assignedRole, assignedTo, assignmentReason }
 */
async function resolveSubjectFacultyMapping({
  targetSubjectId,
  submitterRole,
  submitterId,
  targetFacultyId = null,
}) {
  if (!targetSubjectId || !mongoose.Types.ObjectId.isValid(targetSubjectId)) {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Subject was not specified with a verified curriculum schedule mapping - routed to Admin Queue for review',
    };
  }

  const subjectDoc = await Subject.findById(targetSubjectId).lean();
  if (!subjectDoc) {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Subject record not found in curriculum catalog - routed to Admin Queue for manual assignment',
    };
  }

  const studentProfile = submitterRole === 'student'
    ? await Student.findOne({ userId: submitterId }).lean()
    : null;

  const branch = studentProfile?.branch || subjectDoc.branch;
  const semester = studentProfile?.currentSemester || subjectDoc.semester;
  const session = studentProfile?.session || subjectDoc.session;

  const { sectionDoc, sectionName, sectionId } = await resolveStudentSection(studentProfile);
  const sectionLabel = sectionName ? `, Section ${sectionName}` : '';

  // 1. Check FacultyTeachingAssignment matching subject, branch, and semester
  const assignmentQuery = {
    subjectId: targetSubjectId,
    branch: new RegExp(`^${branch}$`, 'i'),
    semester: Number(semester),
  };
  if (session) {
    assignmentQuery.$or = [
      { session },
      { session: '' },
      { session: null },
      { session: { $exists: false } },
    ];
  }
  if (sectionName) {
    const sectionFilter = [
      { section: new RegExp(`^${sectionName}$`, 'i') },
      { section: '' },
      { section: null },
      { section: { $exists: false } },
    ];
    if (assignmentQuery.$or) {
      assignmentQuery.$and = [
        { $or: assignmentQuery.$or },
        { $or: sectionFilter },
      ];
      delete assignmentQuery.$or;
    } else {
      assignmentQuery.$or = sectionFilter;
    }
  }

  const assignments = await FacultyTeachingAssignment.find(assignmentQuery).lean();
  if (assignments.length > 0) {
    // If there is an exact section match, prioritize it
    const exactSectionMatch = sectionName
      ? assignments.filter(a => a.section && a.section.trim().toUpperCase() === sectionName.toUpperCase())
      : [];
    const candidateAssignments = exactSectionMatch.length > 0 ? exactSectionMatch : assignments;

    const facultyDocIds = [...new Set(candidateAssignments.map(a => a.facultyId.toString()))];
    const facultyDocs = await Faculty.find({ _id: { $in: facultyDocIds } }).lean();
    const facultyUserIds = facultyDocs.map(f => f.userId).filter(Boolean);

    const activeUsers = await User.find({
      _id: { $in: facultyUserIds },
      role: 'faculty',
      isActive: true,
    }).lean();

    if (activeUsers.length === 1) {
      const activeUser = activeUsers[0];
      if (targetFacultyId && activeUser._id.toString() === targetFacultyId.toString()) {
        return {
          assignedRole: 'admin',
          assignedTo: null,
          assignmentReason: 'Identified instructor is the subject of concern - routed to Admin Queue for independent review',
        };
      }
      return {
        assignedRole: 'faculty',
        assignedTo: activeUser._id,
        assignmentReason: `Assigned from subject-faculty mapping: Mapped curriculum instructor for ${subjectDoc.code} (${subjectDoc.name}) in ${branch} Semester ${semester}${sectionLabel}`,
      };
    } else if (activeUsers.length > 1) {
      // Multiple faculty members mapped - try resolving via timetable for the student's section
      if (sectionId) {
        const timetableEntries = await TimetableEntry.find({
          section: sectionId,
          subject: targetSubjectId,
          semester: Number(semester),
        }).lean();

        const timetableFacultyIds = [...new Set(timetableEntries.map(e => e.faculty.toString()))];
        const timetableActiveUsers = await User.find({
          _id: { $in: timetableFacultyIds },
          role: 'faculty',
          isActive: true,
        }).lean();

        if (timetableActiveUsers.length === 1) {
          const activeUser = timetableActiveUsers[0];
          if (targetFacultyId && activeUser._id.toString() === targetFacultyId.toString()) {
            return {
              assignedRole: 'admin',
              assignedTo: null,
              assignmentReason: 'Identified instructor is the subject of concern - routed to Admin Queue for independent review',
            };
          }
          return {
            assignedRole: 'faculty',
            assignedTo: activeUser._id,
            assignmentReason: `Assigned from subject-faculty mapping: Timetable mapped instructor for ${subjectDoc.code} (${subjectDoc.name}) in ${branch} Semester ${semester}${sectionLabel}`,
          };
        }
      }

      // Ambiguous multiple faculty
      return {
        assignedRole: 'admin',
        assignedTo: null,
        assignmentReason: `Multiple faculty members are mapped to ${subjectDoc.code} (${subjectDoc.name}) - routed to Admin Queue for manual assignment`,
      };
    }
  }

  // 2. Check TimetableEntry for student's section and subject
  if (sectionId) {
    const timetableEntries = await TimetableEntry.find({
      section: sectionId,
      subject: targetSubjectId,
      semester: Number(semester),
    }).lean();

    const facultyUserIds = [...new Set(timetableEntries.map(e => e.faculty.toString()))];
    const activeUsers = await User.find({
      _id: { $in: facultyUserIds },
      role: 'faculty',
      isActive: true,
    }).lean();

    if (activeUsers.length === 1) {
      const activeUser = activeUsers[0];
      if (targetFacultyId && activeUser._id.toString() === targetFacultyId.toString()) {
        return {
          assignedRole: 'admin',
          assignedTo: null,
          assignmentReason: 'Identified instructor is the subject of concern - routed to Admin Queue for independent review',
        };
      }
      return {
        assignedRole: 'faculty',
        assignedTo: activeUser._id,
        assignmentReason: `Assigned from subject-faculty mapping: Timetable mapped instructor for ${subjectDoc.code} (${subjectDoc.name}) in ${branch} Semester ${semester}${sectionLabel}`,
      };
    } else if (activeUsers.length > 1) {
      return {
        assignedRole: 'admin',
        assignedTo: null,
        assignmentReason: `Multiple timetable instructors found for ${subjectDoc.code} - routed to Admin Queue for manual assignment`,
      };
    }
  }

  // 3. Check Subject direct facultyId
  if (subjectDoc.facultyId) {
    const facultyDoc = await Faculty.findById(subjectDoc.facultyId).lean();
    if (facultyDoc?.userId) {
      const activeUser = await User.findOne({
        _id: facultyDoc.userId,
        role: 'faculty',
        isActive: true,
      }).lean();

      if (activeUser) {
        if (targetFacultyId && activeUser._id.toString() === targetFacultyId.toString()) {
          return {
            assignedRole: 'admin',
            assignedTo: null,
            assignmentReason: 'Identified instructor is the subject of concern - routed to Admin Queue for independent review',
          };
        }
        return {
          assignedRole: 'faculty',
          assignedTo: activeUser._id,
          assignmentReason: `Assigned from subject-faculty mapping: Designated faculty lead for ${subjectDoc.code} (${subjectDoc.name}) in ${branch} Semester ${semester}`,
        };
      }
    }
  }

  // Subject exists but no valid active faculty mapping found
  return {
    assignedRole: 'admin',
    assignedTo: null,
    assignmentReason: `No verified faculty schedule mapping found for subject ${subjectDoc.code} in this semester - routed to Admin Queue for manual assignment`,
  };
}

/**
 * Determine the responsible handler and explainable assignment reason
 * according to institutional routing rules.
 * Handlers are strictly restricted to: Faculty or Admin.
 *
 * @param {Object} params
 * @param {String} params.submitterRole - 'student' | 'faculty'
 * @param {ObjectId|String} params.submitterId - User ID of the submitter
 * @param {String} params.category - 'faculty' | 'student' | 'subject' | 'college' | 'website' | 'other' | 'class_discipline' | 'administration'
 * @param {ObjectId|String} [params.targetFacultyId] - User ID of target faculty if applicable
 * @param {ObjectId|String} [params.targetStudentId] - User ID of target student if applicable
 * @param {ObjectId|String} [params.targetSubjectId] - Subject ID if applicable
 * @returns {Promise<{ assignedRole: 'faculty'|'admin', assignedTo: ObjectId|null, assignmentReason: String }>}
 */
async function determineHandler({
  submitterRole,
  submitterId,
  category,
  targetFacultyId = null,
  targetStudentId = null,
  targetSubjectId = null,
}) {
  // Category: Complaint Against a Faculty Member -> Admin Queue only
  if (category === 'faculty') {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Complaints against faculty members are strictly routed to Institutional Administration for independent investigation',
    };
  }

  // Category: Campus / Infrastructure -> Admin Queue only
  if (category === 'college') {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Campus and infrastructure issues are handled directly by Institutional Administration',
    };
  }

  // Category: Administration -> Admin Queue only
  if (category === 'administration') {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Institutional administration matters are handled directly by Institutional Administration',
    };
  }

  // Category: Website / ERP -> Admin Queue only
  if (category === 'website') {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Website, portal, and ERP system issues are handled directly by Institutional Administration',
    };
  }

  // Category: Other -> Admin Queue only
  if (category === 'other') {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'General institutional concerns are handled directly by Institutional Administration',
    };
  }

  // Category: Subject / Academic Issue -> Subject-to-Faculty mapping
  if (category === 'subject') {
    return resolveSubjectFacultyMapping({
      targetSubjectId,
      submitterRole,
      submitterId,
      targetFacultyId,
    });
  }

  // Category: Class Discipline
  if (category === 'class_discipline') {
    if (targetSubjectId) {
      return resolveSubjectFacultyMapping({
        targetSubjectId,
        submitterRole,
        submitterId,
        targetFacultyId,
      });
    }

    // If no subject specified, try resolving class/section instructor
    try {
      const studentProfile = submitterRole === 'student'
        ? await Student.findOne({ userId: submitterId }).lean()
        : null;

      if (studentProfile?.section) {
        const { sectionDoc, sectionName, sectionId } = await resolveStudentSection(studentProfile);
        const sectionLabel = sectionName ? `Section ${sectionName}` : 'assigned section';

        let timetableEntries = [];
        if (sectionId) {
          timetableEntries = await TimetableEntry.find({
            section: sectionId,
            semester: Number(studentProfile.currentSemester),
          }).lean();
        }

        const facultyIds = [...new Set(timetableEntries.map(e => e.faculty.toString()))];
        const activeUsers = await User.find({
          _id: { $in: facultyIds },
          role: 'faculty',
          isActive: true,
        }).lean();

        if (activeUsers.length === 1) {
          const activeUser = activeUsers[0];
          if (targetFacultyId && activeUser._id.toString() === targetFacultyId.toString()) {
            return {
              assignedRole: 'admin',
              assignedTo: null,
              assignmentReason: 'Identified instructor is the subject of concern - routed to Admin Queue for independent review',
            };
          }
          return {
            assignedRole: 'faculty',
            assignedTo: activeUser._id,
            assignmentReason: `Designated class instructor for ${studentProfile.branch} Semester ${studentProfile.currentSemester}, ${sectionLabel}`,
          };
        }
      }
    } catch (err) {
      console.error('Error resolving class discipline handler:', err);
    }

    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'No unambiguous single class instructor identified without a subject - routed to Admin Queue for assignment',
    };
  }

  // Category: Complaint Against a Student
  if (category === 'student') {
    // Faculty reporting a student
    if (submitterRole === 'faculty') {
      return {
        assignedRole: 'admin',
        assignedTo: null,
        assignmentReason: 'Faculty report concerning student discipline - routed to Institutional Administration for review',
      };
    }

    // Student reporting another student
    // If classroom incident in a specific subject
    if (targetSubjectId) {
      return resolveSubjectFacultyMapping({
        targetSubjectId,
        submitterRole,
        submitterId,
        targetFacultyId,
      });
    }

    // Otherwise route by class/section instructor
    try {
      let relevantProfile = null;
      if (targetStudentId && mongoose.Types.ObjectId.isValid(targetStudentId)) {
        relevantProfile = await Student.findOne({ userId: targetStudentId }).lean();
      }
      if (!relevantProfile) {
        relevantProfile = await Student.findOne({ userId: submitterId }).lean();
      }

      if (relevantProfile?.section) {
        const { sectionDoc, sectionName, sectionId } = await resolveStudentSection(relevantProfile);
        const sectionLabel = sectionName ? `Section ${sectionName}` : 'assigned section';

        let timetableEntries = [];
        if (sectionId) {
          timetableEntries = await TimetableEntry.find({
            section: sectionId,
            semester: Number(relevantProfile.currentSemester),
          }).lean();
        }

        const facultyIds = [...new Set(timetableEntries.map(e => e.faculty.toString()))];
        const activeUsers = await User.find({
          _id: { $in: facultyIds },
          role: 'faculty',
          isActive: true,
        }).lean();

        if (activeUsers.length === 1) {
          const activeUser = activeUsers[0];
          if (targetFacultyId && activeUser._id.toString() === targetFacultyId.toString()) {
            return {
              assignedRole: 'admin',
              assignedTo: null,
              assignmentReason: 'Identified instructor is the subject of concern - routed to Admin Queue for independent review',
            };
          }
          return {
            assignedRole: 'faculty',
            assignedTo: activeUser._id,
            assignmentReason: `Designated class instructor for ${relevantProfile.branch} Semester ${relevantProfile.currentSemester}, ${sectionLabel}`,
          };
        }

        // Try FacultyTeachingAssignment for this section
        const assignmentQuery = {
          branch: new RegExp(`^${relevantProfile.branch}$`, 'i'),
          semester: Number(relevantProfile.currentSemester),
        };
        if (sectionName) {
          assignmentQuery.section = new RegExp(`^${sectionName}$`, 'i');
        }

        const assignments = await FacultyTeachingAssignment.find(assignmentQuery).lean();
        const facultyDocIds = [...new Set(assignments.map(a => a.facultyId.toString()))];
        const facultyDocs = await Faculty.find({ _id: { $in: facultyDocIds } }).lean();
        const facultyUserIds = facultyDocs.map(f => f.userId).filter(Boolean);

        const activeTeachingUsers = await User.find({
          _id: { $in: facultyUserIds },
          role: 'faculty',
          isActive: true,
        }).lean();

        if (activeTeachingUsers.length === 1) {
          const activeUser = activeTeachingUsers[0];
          if (targetFacultyId && activeUser._id.toString() === targetFacultyId.toString()) {
            return {
              assignedRole: 'admin',
              assignedTo: null,
              assignmentReason: 'Identified instructor is the subject of concern - routed to Admin Queue for independent review',
            };
          }
          return {
            assignedRole: 'faculty',
            assignedTo: activeUser._id,
            assignmentReason: `Assigned section faculty for ${relevantProfile.branch} Semester ${relevantProfile.currentSemester}, ${sectionLabel}`,
          };
        }

        return {
          assignedRole: 'admin',
          assignedTo: null,
          assignmentReason: `No single verified section instructor found for ${relevantProfile.branch} Semester ${relevantProfile.currentSemester} - routed to Admin Queue for class teacher assignment`,
        };
      }

      return {
        assignedRole: 'admin',
        assignedTo: null,
        assignmentReason: 'Student section could not be determined from academic records - routed to Admin Queue for manual assignment',
      };
    } catch (err) {
      console.error('Error resolving class faculty for student discipline issue:', err);
    }

    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Unable to confidently resolve class faculty - routed to Admin Queue for manual assignment',
    };
  }

  // Fallback for any other scenario
  return {
    assignedRole: 'admin',
    assignedTo: null,
    assignmentReason: 'Routing unresolvable from ERP mappings - routed to Admin Queue for manual assignment',
  };
}

module.exports = {
  determineHandler,
  resolveSubjectFacultyMapping,
  resolveStudentSection,
};
