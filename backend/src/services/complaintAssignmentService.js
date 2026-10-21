const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Section = require('../models/Section');
const TimetableEntry = require('../models/TimetableEntry');
const FacultyTeachingAssignment = require('../models/FacultyTeachingAssignment');

/**
 * Determine the responsible handler and explainable assignment reason
 * according to institutional routing rules.
 * Handlers are strictly restricted to: Faculty or Admin.
 *
 * @param {Object} params
 * @param {String} params.submitterRole - 'student' | 'faculty'
 * @param {ObjectId|String} params.submitterId - User ID of the submitter
 * @param {String} params.category - 'faculty' | 'student' | 'subject' | 'college' | 'website' | 'other'
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
  // RULE C & E: Complaints against faculty members -> Admin only
  if (category === 'faculty') {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Complaints against faculty members are strictly routed to Institutional Administration for independent investigation',
    };
  }

  // RULE F & G: Campus, infrastructure, website, ERP, or general institutional issues -> Admin only
  if (category === 'college') {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Campus and infrastructure issues are handled directly by Institutional Administration',
    };
  }

  if (category === 'website') {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Website, portal, and ERP system issues are handled directly by Institutional Administration',
    };
  }

  if (category === 'other') {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'General institutional concerns are handled directly by Institutional Administration',
    };
  }

  // RULE B: Subject or academic issue -> Assigned only if mapped to teach that subject
  if (category === 'subject') {
    if (targetSubjectId && mongoose.Types.ObjectId.isValid(targetSubjectId)) {
      try {
        const subjectDoc = await Subject.findById(targetSubjectId).lean();
        if (subjectDoc) {
          const studentProfile = submitterRole === 'student'
            ? await Student.findOne({ userId: submitterId }).lean()
            : null;

          const branch = studentProfile?.branch || subjectDoc.branch;
          const semester = studentProfile?.currentSemester || subjectDoc.semester;

          let sectionDoc = null;
          if (studentProfile?.section) {
            sectionDoc = await Section.findById(studentProfile.section).lean();
          }

          // 1. Check FacultyTeachingAssignment matching subject, branch, and semester
          const assignmentQuery = {
            subjectId: targetSubjectId,
            branch: new RegExp(`^${branch}$`, 'i'),
            semester: Number(semester),
          };
          if (sectionDoc?.sectionName) {
            assignmentQuery.$or = [
              { section: sectionDoc.sectionName },
              { section: '' },
              { section: { $exists: false } },
            ];
          }

          const assignment = await FacultyTeachingAssignment.findOne(assignmentQuery).lean();
          if (assignment?.facultyId) {
            const facultyDoc = await Faculty.findById(assignment.facultyId).lean();
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
                const sectionLabel = sectionDoc?.sectionName ? `, Section ${sectionDoc.sectionName}` : '';
                return {
                  assignedRole: 'faculty',
                  assignedTo: activeUser._id,
                  assignmentReason: `Mapped curriculum instructor for ${subjectDoc.code} (${subjectDoc.name}) in ${branch} Semester ${semester}${sectionLabel}`,
                };
              }
            }
          }

          // 2. Check TimetableEntry for student's section and subject
          if (studentProfile?.section) {
            const timetableEntry = await TimetableEntry.findOne({
              section: studentProfile.section,
              subject: targetSubjectId,
              semester: Number(semester),
            }).lean();

            if (timetableEntry?.faculty) {
              const activeUser = await User.findOne({
                _id: timetableEntry.faculty,
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
                const sectionLabel = sectionDoc?.sectionName ? `Section ${sectionDoc.sectionName}, ` : '';
                return {
                  assignedRole: 'faculty',
                  assignedTo: activeUser._id,
                  assignmentReason: `Timetable mapped instructor for ${subjectDoc.code} (${subjectDoc.name}) in ${sectionLabel}Semester ${semester}`,
                };
              }
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
                  assignmentReason: `Designated faculty lead for ${subjectDoc.code} (${subjectDoc.name}) in ${branch} Semester ${semester}`,
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
      } catch (err) {
        console.error('Error resolving subject faculty for complaint:', err);
      }
    }

    // No targetSubjectId specified or resolution failed -> Admin Queue
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Subject was not specified with a verified curriculum schedule mapping - routed to Admin Queue for review',
    };
  }

  // RULE A: Student reports another student or class-related discipline issue
  if (submitterRole === 'student' && category === 'student') {
    try {
      // Find relevant student profile (use targetStudent's section if reporting a peer, or submitter's section)
      let relevantProfile = null;
      if (targetStudentId && mongoose.Types.ObjectId.isValid(targetStudentId)) {
        relevantProfile = await Student.findOne({ userId: targetStudentId }).lean();
      }
      if (!relevantProfile) {
        relevantProfile = await Student.findOne({ userId: submitterId }).lean();
      }

      if (relevantProfile?.section) {
        const sectionDoc = await Section.findById(relevantProfile.section).lean();

        // Check TimetableEntry for faculty assigned to this section
        const timetableEntry = await TimetableEntry.findOne({
          section: relevantProfile.section,
          semester: relevantProfile.currentSemester,
        }).lean();

        if (timetableEntry?.faculty) {
          const activeUser = await User.findOne({
            _id: timetableEntry.faculty,
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
            const sectionLabel = sectionDoc?.sectionName ? `Section ${sectionDoc.sectionName}` : 'assigned section';
            return {
              assignedRole: 'faculty',
              assignedTo: activeUser._id,
              assignmentReason: `Designated class instructor for ${relevantProfile.branch} Semester ${relevantProfile.currentSemester}, ${sectionLabel}`,
            };
          }
        }

        // Check FacultyTeachingAssignment for this section
        const assignmentQuery = {
          branch: new RegExp(`^${relevantProfile.branch}$`, 'i'),
          semester: Number(relevantProfile.currentSemester),
        };
        if (sectionDoc?.sectionName) {
          assignmentQuery.section = sectionDoc.sectionName;
        }

        const assignment = await FacultyTeachingAssignment.findOne(assignmentQuery).lean();
        if (assignment?.facultyId) {
          const facultyDoc = await Faculty.findById(assignment.facultyId).lean();
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
              const sectionLabel = sectionDoc?.sectionName ? `Section ${sectionDoc.sectionName}` : 'assigned section';
              return {
                assignedRole: 'faculty',
                assignedTo: activeUser._id,
                assignmentReason: `Assigned section faculty for ${relevantProfile.branch} Semester ${relevantProfile.currentSemester}, ${sectionLabel}`,
              };
            }
          }
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

  // RULE D: Faculty reports a student -> Placed in Admin queue for review
  if (submitterRole === 'faculty' && category === 'student') {
    return {
      assignedRole: 'admin',
      assignedTo: null,
      assignmentReason: 'Faculty report concerning student discipline - routed to Institutional Administration for review',
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
};
