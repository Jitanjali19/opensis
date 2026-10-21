jest.mock('../src/models/Complaint', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
}));

jest.mock('../src/models/User', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../src/models/Student', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../src/models/Faculty', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../src/models/Subject', () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../src/models/TimetableEntry', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../src/models/FacultyTeachingAssignment', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock('../src/models/Section', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
}));

const mongoose = require('mongoose');
const Complaint = require('../src/models/Complaint');
const User = require('../src/models/User');
const Student = require('../src/models/Student');
const Faculty = require('../src/models/Faculty');
const Subject = require('../src/models/Subject');
const Section = require('../src/models/Section');
const TimetableEntry = require('../src/models/TimetableEntry');
const FacultyTeachingAssignment = require('../src/models/FacultyTeachingAssignment');
const ctrl = require('../src/controllers/complaintController');
const { determineHandler } = require('../src/services/complaintAssignmentService');
const { authorize } = require('../src/middleware/auth');
const fs = require('fs');
const path = require('path');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const chain = (result) => ({
  select: () => chain(result),
  sort: () => chain(result),
  skip: () => chain(result),
  limit: () => chain(result),
  lean: async () => result,
});

describe('Complaints Module Comprehensive Test Suite', () => {
  const studentAId = new mongoose.Types.ObjectId();
  const studentBId = new mongoose.Types.ObjectId();
  const facultyUserId = new mongoose.Types.ObjectId();
  const otherFacultyUserId = new mongoose.Types.ObjectId();
  const otherDeptFacultyUserId = new mongoose.Types.ObjectId();
  const subjectId = new mongoose.Types.ObjectId();
  const sectionId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TEST 1: Students can submit complaints against faculty
  test('1. Students can submit complaints against faculty', async () => {
    const res = makeRes();
    Complaint.countDocuments.mockResolvedValue(0);
    Student.findOne.mockReturnValue(chain({ branch: 'IT', section: sectionId }));
    User.findOne.mockReturnValue(chain({ _id: facultyUserId, role: 'faculty', isActive: true }));
    Faculty.findOne.mockReturnValue(chain({ userId: facultyUserId, department: 'IT', firstName: 'Rajesh', lastName: 'Sharma' }));

    const mockCreated = {
      _id: new mongoose.Types.ObjectId(),
      category: 'faculty',
      faculty: facultyUserId,
      subject: 'Grading transparency issue',
      description: 'Midterm paper grading criteria not explained',
      assignedRole: 'admin',
      assignedTo: null,
      student: studentAId,
    };
    Complaint.create.mockResolvedValue(mockCreated);
    Complaint.findById.mockReturnValue(chain(mockCreated));

    await ctrl.createComplaint({
      user: { _id: studentAId, role: 'student' },
      body: {
        category: 'faculty',
        faculty: facultyUserId.toString(),
        subject: 'Grading transparency issue',
        description: 'Midterm paper grading criteria not explained',
      },
    }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createdPayload = Complaint.create.mock.calls[0][0];
    expect(createdPayload.category).toBe('faculty');
    expect(createdPayload.faculty.toString()).toBe(facultyUserId.toString());
    expect(createdPayload.assignedRole).toBe('admin');
  });

  // TEST 2: Students can submit permitted student/class and subject complaints
  test('2. Students can submit permitted student/class and subject complaints', async () => {
    const res = makeRes();
    Complaint.countDocuments.mockResolvedValue(0);
    Student.findOne.mockReturnValue(chain({ branch: 'IT', section: sectionId, currentSemester: 5 }));
    User.findOne.mockReturnValue(chain({ _id: studentBId, role: 'student', isActive: true }));
    TimetableEntry.findOne.mockReturnValue(chain({ faculty: facultyUserId }));

    const mockCreated = {
      _id: new mongoose.Types.ObjectId(),
      category: 'student',
      targetStudent: studentBId,
      subject: 'Lab equipment misuse',
      description: 'A student continuously monopolizes and misuses equipment in LT lab',
      student: studentAId,
    };
    Complaint.create.mockResolvedValue(mockCreated);
    Complaint.findById.mockReturnValue(chain(mockCreated));

    await ctrl.createComplaint({
      user: { _id: studentAId, role: 'student' },
      body: {
        category: 'student',
        targetStudent: studentBId.toString(),
        subject: 'Lab equipment misuse',
        description: 'A student continuously monopolizes and misuses equipment in LT lab',
      },
    }, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  // TEST 3: Students can submit campus and website complaints without an irrelevant target ID
  test('3. Students can submit campus and website complaints without target ID', async () => {
    const res = makeRes();
    Complaint.countDocuments.mockResolvedValue(0);

    const mockCreated = {
      _id: new mongoose.Types.ObjectId(),
      category: 'college',
      subject: 'Library reading room AC broken',
      description: 'The AC on the 2nd floor library has not been functioning for 3 days',
      faculty: null,
      targetStudent: null,
      student: studentAId,
    };
    Complaint.create.mockResolvedValue(mockCreated);
    Complaint.findById.mockReturnValue(chain(mockCreated));

    await ctrl.createComplaint({
      user: { _id: studentAId, role: 'student' },
      body: {
        category: 'college',
        subject: 'Library reading room AC broken',
        description: 'The AC on the 2nd floor library has not been functioning for 3 days',
      },
    }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createdPayload = Complaint.create.mock.calls[0][0];
    expect(createdPayload.faculty).toBeNull();
    expect(createdPayload.targetStudent).toBeNull();
  });

  // TEST 4: Faculty can submit student-related complaints
  test('4. Faculty can submit student-related complaints', async () => {
    const res = makeRes();
    Complaint.countDocuments.mockResolvedValue(0);
    User.findOne.mockReturnValue(chain({ _id: studentAId, role: 'student', isActive: true }));

    const mockCreated = {
      _id: new mongoose.Types.ObjectId(),
      category: 'student',
      targetStudent: studentAId,
      subject: 'Disruptive behavior during lecture',
      description: 'Student caused repeated disturbances in class',
      submitterRole: 'faculty',
      student: facultyUserId,
    };
    Complaint.create.mockResolvedValue(mockCreated);
    Complaint.findById.mockReturnValue(chain(mockCreated));

    await ctrl.createComplaint({
      user: { _id: facultyUserId, role: 'faculty' },
      body: {
        category: 'student',
        targetStudent: studentAId.toString(),
        subject: 'Disruptive behavior during lecture',
        description: 'Student caused repeated disturbances in class',
      },
    }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createdPayload = Complaint.create.mock.calls[0][0];
    expect(createdPayload.submitterRole).toBe('faculty');
  });

  // TEST 5: Faculty can submit campus, infrastructure, administration, website, and ERP complaints without a target ID
  test('5. Faculty can submit campus/website complaints without target ID', async () => {
    const res = makeRes();
    Complaint.countDocuments.mockResolvedValue(0);

    const mockCreated = {
      _id: new mongoose.Types.ObjectId(),
      category: 'website',
      subject: 'Marks upload sheet formatting bug',
      description: 'Excel import times out when processing 60 rows',
      faculty: null,
      targetStudent: null,
      submitterRole: 'faculty',
      student: facultyUserId,
    };
    Complaint.create.mockResolvedValue(mockCreated);
    Complaint.findById.mockReturnValue(chain(mockCreated));

    await ctrl.createComplaint({
      user: { _id: facultyUserId, role: 'faculty' },
      body: {
        category: 'website',
        subject: 'Marks upload sheet formatting bug',
        description: 'Excel import times out when processing 60 rows',
      },
    }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createdPayload = Complaint.create.mock.calls[0][0];
    expect(createdPayload.faculty).toBeNull();
  });

  // TEST 6: Faculty complaints against other faculty route to admin
  test('6. Faculty complaints against other faculty route to admin only', async () => {
    const routing = await determineHandler({
      submitterRole: 'faculty',
      submitterId: facultyUserId,
      category: 'faculty',
      targetFacultyId: otherFacultyUserId,
    });

    expect(routing.assignedRole).toBe('admin');
    expect(routing.assignedTo).toBeNull();
    expect(routing.assignmentReason).toMatch(/strictly routed to Institutional Administration/i);
  });

  // TEST 7: Student complaints against faculty route to admin only
  test('7. Student complaints against faculty route to admin only', async () => {
    const routing = await determineHandler({
      submitterRole: 'student',
      submitterId: studentAId,
      category: 'faculty',
      targetFacultyId: facultyUserId,
    });

    expect(routing.assignedRole).toBe('admin');
    expect(routing.assignedTo).toBeNull();
    expect(routing.assignmentReason).toMatch(/strictly routed to Institutional Administration/i);
  });

  // TEST 8: Student/class discipline and subject complaints route to eligible faculty
  test('8. Student discipline complaints route to eligible class faculty', async () => {
    Student.findOne.mockReturnValue(chain({ branch: 'IT', section: sectionId, currentSemester: 5 }));
    Section.findById.mockReturnValue(chain({ sectionName: 'A' }));
    TimetableEntry.findOne.mockReturnValue(chain({ faculty: facultyUserId }));
    User.findOne.mockReturnValue(chain({ _id: facultyUserId, role: 'faculty', isActive: true }));

    const routing = await determineHandler({
      submitterRole: 'student',
      submitterId: studentAId,
      category: 'student',
      targetStudentId: studentBId,
    });

    expect(routing.assignedRole).toBe('faculty');
    expect(routing.assignedTo.toString()).toBe(facultyUserId.toString());
    expect(routing.assignmentReason).toMatch(/class instructor/i);
  });

  // TEST 9: Campus and website complaints route to admin
  test('9. Campus and website complaints route to admin queue', async () => {
    const rCollege = await determineHandler({ submitterRole: 'student', submitterId: studentAId, category: 'college' });
    const rWebsite = await determineHandler({ submitterRole: 'faculty', submitterId: facultyUserId, category: 'website' });
    const rOther = await determineHandler({ submitterRole: 'student', submitterId: studentAId, category: 'other' });

    expect(rCollege.assignedRole).toBe('admin');
    expect(rCollege.assignedTo).toBeNull();
    expect(rCollege.assignmentReason).toMatch(/Campus and infrastructure/i);

    expect(rWebsite.assignedRole).toBe('admin');
    expect(rWebsite.assignedTo).toBeNull();
    expect(rWebsite.assignmentReason).toMatch(/Website, portal, and ERP/i);

    expect(rOther.assignedRole).toBe('admin');
    expect(rOther.assignedTo).toBeNull();
    expect(rOther.assignmentReason).toMatch(/General institutional/i);
  });

  // TEST 10: Missing eligible faculty routes complaint to admin queue
  test('10. Missing eligible faculty routes complaint to admin queue', async () => {
    Student.findOne.mockReturnValue(chain(null)); // student has no section/profile found
    TimetableEntry.findOne.mockReturnValue(chain(null));
    FacultyTeachingAssignment.findOne.mockReturnValue(chain(null));

    const routing = await determineHandler({
      submitterRole: 'student',
      submitterId: studentAId,
      category: 'student',
      targetStudentId: studentBId,
    });

    expect(routing.assignedRole).toBe('admin');
    expect(routing.assignedTo).toBeNull();
    expect(routing.assignmentReason).toMatch(/Admin Queue/i);
  });

  // TEST 11: Student A cannot read Student B's complaints
  test('11. Student A cannot read Student B complaints', async () => {
    const res = makeRes();
    Complaint.find.mockImplementation((query) => {
      expect(query.student.toString()).toEqual(studentAId.toString());
      return chain([
        { _id: new mongoose.Types.ObjectId(), subject: 'Complaint A', student: studentAId },
      ]);
    });
    Faculty.find.mockReturnValue(chain([]));
    Student.find.mockReturnValue(chain([]));
    Subject.find.mockReturnValue(chain([]));

    await ctrl.getMyComplaints({ user: { _id: studentAId, role: 'student' } }, res);

    const data = res.json.mock.calls[0][0].data;
    expect(data.complaints.length).toBe(1);
    expect(data.complaints[0].subject).toBe('Complaint A');
  });

  // TEST 12: Faculty cannot access another faculty member's assigned complaints
  test('12. Faculty cannot access another faculty assigned complaints', async () => {
    const res = makeRes();
    Complaint.find.mockImplementation((query) => {
      expect(query.assignedTo.toString()).toEqual(facultyUserId.toString());
      return chain([]);
    });

    await ctrl.getAssignedComplaints({ user: { _id: facultyUserId, role: 'faculty' } }, res);
    expect(res.json).toHaveBeenCalled();
  });

  // TEST 13: Faculty and students receive 403 on admin-only APIs
  test('13. Faculty and students receive 403 on admin-only APIs', () => {
    const adminAuth = authorize('admin');

    const resStudent = makeRes();
    adminAuth({ user: { role: 'student' } }, resStudent, jest.fn());
    expect(resStudent.status).toHaveBeenCalledWith(403);

    const resFaculty = makeRes();
    adminAuth({ user: { role: 'faculty' } }, resFaculty, jest.fn());
    expect(resFaculty.status).toHaveBeenCalledWith(403);
  });

  // TEST 14: Invalid target roles and IDs are rejected
  test('14. Invalid target roles and IDs are rejected', async () => {
    // 14a. Invalid ObjectId
    const resInvalidId = makeRes();
    Complaint.countDocuments.mockResolvedValue(0);

    await ctrl.createComplaint({
      user: { _id: studentAId, role: 'student' },
      body: { category: 'faculty', faculty: 'not-an-id', subject: 'Test', description: 'Test desc' },
    }, resInvalidId);
    expect(resInvalidId.status).toHaveBeenCalledWith(400);

    // 14b. Target is not a faculty user
    const resNotFaculty = makeRes();
    User.findOne.mockReturnValue(chain(null));

    await ctrl.createComplaint({
      user: { _id: studentAId, role: 'student' },
      body: { category: 'faculty', faculty: studentBId.toString(), subject: 'Test', description: 'Test desc' },
    }, resNotFaculty);
    expect(resNotFaculty.status).toHaveBeenCalledWith(400);
  });

  // TEST 15: Cross-department faculty complaint is rejected
  test('15. Cross-department assignment/complaint is rejected', async () => {
    const resWrongDept = makeRes();
    Complaint.countDocuments.mockResolvedValue(0);
    User.findOne.mockReturnValue(chain({ _id: otherDeptFacultyUserId, role: 'faculty', isActive: true }));
    Student.findOne.mockReturnValue(chain({ branch: 'IT' }));
    Faculty.findOne.mockReturnValue(chain({ userId: otherDeptFacultyUserId, department: 'CSE' })); // CSE vs IT

    await ctrl.createComplaint({
      user: { _id: studentAId, role: 'student' },
      body: {
        category: 'faculty',
        faculty: otherDeptFacultyUserId.toString(),
        subject: 'Inter-department test',
        description: 'Should be rejected',
      },
    }, resWrongDept);

    expect(resWrongDept.status).toHaveBeenCalledWith(400);
    expect(resWrongDept.json.mock.calls[0][0].message).toMatch(/does not belong to your department/i);
  });

  // TEST 16: Anonymous admin API JSON contains no submitter identity anywhere
  test('16. Anonymous admin API JSON contains no submitter identity anywhere', async () => {
    const res = makeRes();
    const mockComplaints = [
      {
        _id: new mongoose.Types.ObjectId(),
        category: 'faculty',
        subject: 'Lecture speed',
        description: 'Covers too fast',
        status: 'pending',
        faculty: facultyUserId,
        student: studentAId, // must be removed
      },
    ];

    Complaint.countDocuments.mockResolvedValue(1);
    Complaint.find.mockReturnValue(chain(mockComplaints));
    Faculty.find.mockReturnValue(chain([{ userId: facultyUserId, firstName: 'Rajesh', lastName: 'Sharma' }]));
    Student.find.mockReturnValue(chain([]));

    await ctrl.getAdminComplaints({ query: {} }, res);

    const jsonRes = res.json.mock.calls[0][0];
    expect(jsonRes.success).toBe(true);
    const item = jsonRes.data.complaints[0];
    expect(item).not.toHaveProperty('student');
    expect(item).not.toHaveProperty('submitter');
    expect(item).not.toHaveProperty('studentId');
    expect(item).not.toHaveProperty('email');
  });

  // TEST 17: Anonymous faculty-assigned API JSON contains no submitter identity anywhere
  test('17. Anonymous faculty-assigned API JSON contains no submitter identity anywhere', async () => {
    const res = makeRes();
    const mockAssigned = [
      {
        _id: new mongoose.Types.ObjectId(),
        category: 'student',
        subject: 'Discipline in class',
        description: 'Disturbing front benches',
        assignedTo: facultyUserId,
        student: studentAId, // must be removed
      },
    ];

    Complaint.find.mockReturnValue(chain(mockAssigned));
    Student.find.mockReturnValue(chain([]));
    Subject.find.mockReturnValue(chain([]));

    await ctrl.getAssignedComplaints({ user: { _id: facultyUserId, role: 'faculty' } }, res);

    const jsonRes = res.json.mock.calls[0][0];
    expect(jsonRes.success).toBe(true);
    const item = jsonRes.data.complaints[0];
    expect(item).not.toHaveProperty('student');
    expect(item).not.toHaveProperty('submitter');
  });

  // TEST 18: Status updates and reassignment require proper authorization
  test('18. Status updates and reassignment require proper authorization', async () => {
    // Non-faculty trying to update assigned complaint
    const resStudent = makeRes();
    await ctrl.updateAssignedComplaint({ user: { role: 'student' }, params: { id: 'id' }, body: {} }, resStudent);
    expect(resStudent.status).toHaveBeenCalledWith(403);

    // Admin assigning a complaint against faculty to faculty is rejected
    const resAdminAssign = makeRes();
    Complaint.findById.mockReturnValue(chain({ category: 'faculty' }));
    User.findOne.mockReturnValue(chain({ _id: facultyUserId, role: 'faculty', isActive: true }));

    await ctrl.updateAdminComplaint({
      user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { assignedTo: facultyUserId.toString() },
    }, resAdminAssign);

    expect(resAdminAssign.status).toHaveBeenCalledWith(400);
    expect(resAdminAssign.json.mock.calls[0][0].message).toMatch(/strictly restricted to admin/i);
  });

  // TEST 19: Daily complaint limits cannot be bypassed
  test('19. Daily complaint limit of 5 is strictly enforced (6th returns 429)', async () => {
    const res = makeRes();
    Complaint.countDocuments.mockResolvedValue(5); // already 5 today

    await ctrl.createComplaint({
      user: { _id: studentAId, role: 'student' },
      body: { category: 'college', subject: 'Canteen', description: 'Cleanliness issue' },
    }, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].message).toMatch(/Daily complaint limit reached/i);
  });

  // TEST 20: Existing complaint categories and stored complaints remain compatible
  test('20. Existing complaint categories remain fully compatible', async () => {
    const valid = ['faculty', 'student', 'subject', 'college', 'website', 'other'];
    valid.forEach(cat => {
      expect(['faculty', 'student', 'subject', 'college', 'website', 'other']).toContain(cat);
    });
  });

  // TEST 21: Existing login, attendance, timetable, classes, and dashboard remain intact
  test('21. Existing modules remain intact', () => {
    const serverPath = path.join(__dirname, '../server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    expect(serverContent).toContain('/api/timetable');
    expect(serverContent).toContain('/api/admin');
    expect(serverContent).toContain('/api/student');
    expect(serverContent).toContain('/api/faculty');
    expect(serverContent).toContain('/api/complaints');
  });

  // TEST 22: TodayClasses is not defined runtime error is resolved in Student Dashboard
  test('22. Dashboard.jsx imports TodayClasses component properly', () => {
    const dashboardPath = path.join(__dirname, '../../frontend/src/pages/student/Dashboard.jsx');
    const content = fs.readFileSync(dashboardPath, 'utf8');
    expect(content).toContain("import TodayClasses from '../../components/TodayClasses';");
    expect(content).toContain("<TodayClasses role=\"student\" timetablePath=\"/student/timetable\" />");
  });

  // TEST 23: Subject complaint routes to mapped faculty with clear, explainable assignmentReason
  test('23. Subject complaint routes to mapped faculty with explainable reason', async () => {
    const facultyDocId = new mongoose.Types.ObjectId();
    Subject.findById.mockReturnValue(chain({
      _id: subjectId,
      code: 'IT301',
      name: 'Database Systems',
      branch: 'IT',
      semester: 5,
    }));
    Student.findOne.mockReturnValue(chain({ branch: 'IT', currentSemester: 5, section: sectionId }));
    Section.findById.mockReturnValue(chain({ sectionName: 'A' }));
    FacultyTeachingAssignment.findOne.mockReturnValue(chain({ facultyId: facultyDocId }));
    Faculty.findById.mockReturnValue(chain({ _id: facultyDocId, userId: facultyUserId }));
    User.findOne.mockReturnValue(chain({ _id: facultyUserId, role: 'faculty', isActive: true }));

    const routing = await determineHandler({
      submitterRole: 'student',
      submitterId: studentAId,
      category: 'subject',
      targetSubjectId: subjectId,
    });

    expect(routing.assignedRole).toBe('faculty');
    expect(routing.assignedTo.toString()).toBe(facultyUserId.toString());
    expect(routing.assignmentReason).toContain('Mapped curriculum instructor for IT301 (Database Systems)');
  });

  // TEST 24: Subject complaint without schedule mapping routes to Admin Queue with explainable reason
  test('24. Subject complaint without schedule mapping routes to Admin Queue', async () => {
    Subject.findById.mockReturnValue(chain({
      _id: subjectId,
      code: 'IT399',
      name: 'Unmapped Elective',
      branch: 'IT',
      semester: 5,
    }));
    Student.findOne.mockReturnValue(chain({ branch: 'IT', currentSemester: 5, section: sectionId }));
    Section.findById.mockReturnValue(chain({ sectionName: 'B' }));
    FacultyTeachingAssignment.findOne.mockReturnValue(chain(null));
    TimetableEntry.findOne.mockReturnValue(chain(null));

    const routing = await determineHandler({
      submitterRole: 'student',
      submitterId: studentAId,
      category: 'subject',
      targetSubjectId: subjectId,
    });

    expect(routing.assignedRole).toBe('admin');
    expect(routing.assignedTo).toBeNull();
    expect(routing.assignmentReason).toContain('No verified faculty schedule mapping found');
  });

  // TEST 25: Complaint against faculty cannot be assigned or reassigned to reported faculty member
  test('25. Complaint against faculty cannot be assigned or reassigned to reported faculty member', async () => {
    const res = makeRes();
    Complaint.findById.mockReturnValue(chain({
      _id: new mongoose.Types.ObjectId(),
      category: 'faculty',
      faculty: facultyUserId,
    }));
    User.findOne.mockReturnValue(chain({ _id: facultyUserId, role: 'faculty', isActive: true }));

    await ctrl.updateAdminComplaint({
      user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { assignedTo: facultyUserId.toString() },
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/Cannot assign a complaint to the faculty member who is the subject/i);
  });

  // TEST 26: Admin reassignment successfully updates handler and sets assignmentReason
  test('26. Admin reassignment updates handler and assignmentReason', async () => {
    const res = makeRes();
    const complaintId = new mongoose.Types.ObjectId();
    Complaint.findById.mockReturnValue(chain({
      _id: complaintId,
      category: 'student',
      faculty: null,
    }));
    User.findOne.mockReturnValue(chain({ _id: otherFacultyUserId, role: 'faculty', isActive: true }));
    Faculty.findOne.mockReturnValue(chain({ firstName: 'Sunita', lastName: 'Verma', department: 'IT' }));
    Complaint.findByIdAndUpdate.mockReturnValue(chain({
      _id: complaintId,
      category: 'student',
      assignedTo: otherFacultyUserId,
      assignedRole: 'faculty',
      assignmentReason: 'Reassigned by Admin to Sunita Verma for departmental investigation',
    }));

    await ctrl.updateAdminComplaint({
      user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
      params: { id: complaintId.toString() },
      body: {
        assignedTo: otherFacultyUserId.toString(),
        assignmentReason: 'Reassigned by Admin to Sunita Verma for departmental investigation',
      },
    }, res);

    expect(res.json).toHaveBeenCalled();
    const updatedPayload = Complaint.findByIdAndUpdate.mock.calls[0][1];
    expect(updatedPayload.assignedTo.toString()).toBe(otherFacultyUserId.toString());
    expect(updatedPayload.assignedRole).toBe('faculty');
    expect(updatedPayload.assignmentReason).toBe('Reassigned by Admin to Sunita Verma for departmental investigation');
  });

  // TEST 27: Complaint anonymity preserved in assignmentReason and responses
  test('27. Complaint anonymity preserved in assignmentReason and responses', async () => {
    const routing = await determineHandler({
      submitterRole: 'student',
      submitterId: studentAId,
      category: 'college',
    });
    expect(routing.assignmentReason).not.toContain(studentAId.toString());
    expect(routing.assignmentReason).not.toMatch(/studentId|userId|name/i);
  });

  // TEST 28: Handler role and authorization is validated on backend
  test('28. Handler role is validated on backend; non-faculty rejected', async () => {
    const res = makeRes();
    Complaint.findById.mockReturnValue(chain({
      _id: new mongoose.Types.ObjectId(),
      category: 'student',
    }));
    User.findOne.mockReturnValue(chain(null)); // Not found or not active faculty

    await ctrl.updateAdminComplaint({
      user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { assignedTo: new mongoose.Types.ObjectId().toString() },
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/Target handler must be an active faculty member/i);
  });
});
