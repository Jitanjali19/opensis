require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const ExamSchedule = require('../models/ExamSchedule');
const Notice = require('../models/Notice');
const LibraryBook = require('../models/LibraryBook');
const Assignment = require('../models/Assignment');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');
const Section = require('../models/Section');
const Room = require('../models/Room');
const TimetableEntry = require('../models/TimetableEntry');

async function seed() {
  if (process.env.NODE_ENV !== 'development') {
    console.error('❌ Seed can only run in development environment. Aborting.');
    process.exit(1);
  }

  const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve, reject) => {
    readline.question('⚠️  This will DELETE ALL DATA and re-seed. Type "yes" to confirm: ', (answer) => {
      readline.close();
      if (answer.trim().toLowerCase() !== 'yes') {
        console.log('Aborted.');
        process.exit(0);
      }
      resolve();
    });
  });

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany(), Admin.deleteMany(), Student.deleteMany(), Faculty.deleteMany(),
    Subject.deleteMany(), Section.deleteMany(), Room.deleteMany(), TimetableEntry.deleteMany(), ExamSchedule.deleteMany(),
    Notice.deleteMany(), LibraryBook.deleteMany(), Assignment.deleteMany(),
    Fee.deleteMany(), Attendance.deleteMany(),
  ]);
  console.log('Cleared existing data');

  const hash = (p) => bcrypt.hash(p, 12);

  // Admin
  const adminUser = await User.create({ email: 'admin@college.edu', passwordHash: await hash('Admin@123'), role: 'admin' });
  const admin = await Admin.create({ userId: adminUser._id, firstName: 'Super', lastName: 'Admin', phone: '9000000000' });

  // Faculty
  const f1User = await User.create({ email: 'prof.sharma@college.edu', passwordHash: await hash('Faculty@123'), role: 'faculty' });
  const f2User = await User.create({ email: 'prof.gupta@college.edu', passwordHash: await hash('Faculty@123'), role: 'faculty' });
  const f3User = await User.create({ email: 'prof.verma@college.edu', passwordHash: await hash('Faculty@123'), role: 'faculty' });

  const faculty1 = await Faculty.create({
    userId: f1User._id, employeeId: 'EMP001', firstName: 'Rajesh', lastName: 'Sharma',
    department: 'IT', designation: 'Associate Professor', qualification: 'M.Tech',
    joiningDate: new Date('2018-07-01'), phone: '9111111111',
  });
  const faculty2 = await Faculty.create({
    userId: f2User._id, employeeId: 'EMP002', firstName: 'Priya', lastName: 'Gupta',
    department: 'CSE', designation: 'Assistant Professor', qualification: 'Ph.D',
    joiningDate: new Date('2020-01-15'), phone: '9222222222',
  });
  const faculty3 = await Faculty.create({
    userId: f3User._id, employeeId: 'EMP003', firstName: 'Amit', lastName: 'Verma',
    department: 'IT', designation: 'Assistant Professor', qualification: 'M.Tech',
    joiningDate: new Date('2021-07-01'), phone: '9333333333',
  });

  // Subjects
  const sub1 = await Subject.create({ code: 'IT501', name: 'Data Structures & Algorithms', type: 'theory', branch: 'IT', semester: 5, credits: 4, facultyId: faculty1._id });
  const sub2 = await Subject.create({ code: 'IT502', name: 'Computer Networks', type: 'theory', branch: 'IT', semester: 5, credits: 3, facultyId: faculty1._id });
  const sub3 = await Subject.create({ code: 'CSE501', name: 'Database Management Systems', type: 'theory', branch: 'CSE', semester: 5, credits: 4, facultyId: faculty2._id });
  const sub4 = await Subject.create({ code: 'CSE502', name: 'Operating Systems Lab', type: 'lab', branch: 'CSE', semester: 5, credits: 2, facultyId: faculty2._id });
  const sub5 = await Subject.create({ code: 'IT503', name: 'Web Technology Lab', type: 'lab', branch: 'IT', semester: 5, credits: 2, facultyId: faculty3._id });

  // Update faculty subjects
  await Faculty.findByIdAndUpdate(faculty1._id, { subjectsTaught: [sub1._id, sub2._id] });
  await Faculty.findByIdAndUpdate(faculty2._id, { subjectsTaught: [sub3._id, sub4._id] });
  await Faculty.findByIdAndUpdate(faculty3._id, { subjectsTaught: [sub5._id] });

  const section = await Section.create({ department: 'IT', year: 3, sectionName: 'A', batches: ['A1', 'A2', 'A3'] });
  const [room101, lab1, lab2] = await Room.create([
    { name: 'Room 101', type: 'classroom' },
    { name: 'Computer Lab 1', type: 'lab' },
    { name: 'Computer Lab 2', type: 'lab' },
  ]);

  // Students
  const makeStudent = async (email, enrollNo, first, last, batch) => {
    const u = await User.create({ email, passwordHash: await hash('Student@123'), role: 'student' });
    const s = await Student.create({
      userId: u._id, enrollmentNo: enrollNo, firstName: first, lastName: last,
      branch: 'IT', currentSemester: 5, section: section._id, batch, year: 3,
      session: '2024-25', gender: 'female', phone: '9000000001',
      fatherName: 'Ram ' + last, motherName: 'Sita ' + last,
    });
    return s;
  };

  const s1 = await makeStudent('alice@student.college.edu', '0801IT221001', 'Alice', 'Patel', 'A1');
  const s2 = await makeStudent('bob@student.college.edu', '0801IT221002', 'Bob', 'Verma', 'A2');
  const s3 = await makeStudent('carol@student.college.edu', '0801IT221003', 'Carol', 'Singh', 'A3');

  await TimetableEntry.insertMany([
    { section: section._id, subject: sub1._id, faculty: f1User._id, room: room101._id, day: 1, startSlot: 1, slotCount: 1, academicYear: '2024-25', semester: 5 },
    { section: section._id, subject: sub1._id, faculty: f1User._id, room: room101._id, day: 3, startSlot: 4, slotCount: 1, academicYear: '2024-25', semester: 5 },
    { section: section._id, subject: sub2._id, faculty: f1User._id, room: room101._id, day: 2, startSlot: 2, slotCount: 1, academicYear: '2024-25', semester: 5 },
    { section: section._id, subject: sub4._id, batch: 'A1', faculty: f2User._id, room: lab1._id, day: 4, startSlot: 1, slotCount: 2, academicYear: '2024-25', semester: 5 },
    { section: section._id, subject: sub5._id, batch: 'A2', faculty: f3User._id, room: lab2._id, day: 5, startSlot: 5, slotCount: 2, academicYear: '2024-25', semester: 5 },
  ]);

  // Fees for students
  for (const student of [s1, s2, s3]) {
    await Fee.create({ studentId: student._id, session: '2024-25', semester: 5, amount: 45000, dueDate: new Date('2024-08-31') });
  }

  // Exam Schedule
  await ExamSchedule.create({
    session: '2024-25', semester: 5, branch: 'IT', examType: 'end',
    entries: [
      { subjectId: sub1._id, date: new Date('2024-11-15'), startTime: '10:00', endTime: '13:00', venue: 'Hall A' },
      { subjectId: sub2._id, date: new Date('2024-11-18'), startTime: '10:00', endTime: '13:00', venue: 'Hall B' },
    ],
  });

  // Notices
  await Notice.create({ title: 'Semester Exam Schedule Released', body: 'End semester exams for Semester 5 start from November 15. Please check the exam schedule section.', audience: 'all', postedBy: admin._id, isPinned: true });
  await Notice.create({ title: 'Assignment Submission Deadline', body: 'All pending assignments must be submitted by October 30, 2024. Late submissions will not be accepted.', audience: 'students', postedBy: admin._id });

  // Library Books
  await LibraryBook.insertMany([
    { bookId: 'LB001', title: 'Introduction to Algorithms', author: 'Cormen et al.', isbn: '978-0262033848', copiesTotal: 5, copiesAvailable: 3 },
    { bookId: 'LB002', title: 'Computer Networks', author: 'Andrew Tanenbaum', isbn: '978-0132126953', copiesTotal: 4, copiesAvailable: 2 },
    { bookId: 'LB003', title: 'Database System Concepts', author: 'Silberschatz et al.', isbn: '978-0073523323', copiesTotal: 3, copiesAvailable: 3 },
    { bookId: 'LB004', title: 'Operating System Concepts', author: 'Silberschatz et al.', isbn: '978-1118063330', copiesTotal: 4, copiesAvailable: 4 },
    { bookId: 'LB005', title: 'Clean Code', author: 'Robert C. Martin', isbn: '978-0132350884', copiesTotal: 2, copiesAvailable: 1 },
  ]);

  // Sample assignment
  await Assignment.create({
    title: 'Implement BFS and DFS',
    description: 'Implement Breadth First Search and Depth First Search algorithms and compare their time complexities.',
    subjectId: sub1._id,
    facultyId: faculty1._id,
    dueDate: new Date('2024-10-30'),
    maxMarks: 20,
  });

  // Sample attendance
  await Attendance.create({
    subjectId: sub1._id, facultyId: faculty1._id,
    date: new Date('2024-10-01'), semester: 5, branch: 'IT', section: 'A',
    records: [
      { studentId: s1._id, status: 'present' },
      { studentId: s2._id, status: 'present' },
      { studentId: s3._id, status: 'absent' },
    ],
  });

  console.log('\n✅ Seed complete!\n');
  console.log('Admin:    admin@college.edu         / Admin@123');
  console.log('Faculty:  prof.sharma@college.edu   / Faculty@123');
  console.log('Faculty:  prof.gupta@college.edu    / Faculty@123');
  console.log('Student:  alice@student.college.edu / Student@123');
  console.log('Student:  bob@student.college.edu   / Student@123');
  console.log('Student:  carol@student.college.edu / Student@123');

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
