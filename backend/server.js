require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./src/config/db');

const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');
const studentRoutes = require('./src/routes/student');
const facultyRoutes = require('./src/routes/faculty');

const app = express();

// Auto-seed: check if admin exists, if not seed the database
const autoSeed = async () => {
  const User = require('./src/models/User');
  const count = await User.countDocuments();
  if (count === 0) {
    console.log('⚡ No users found — auto-seeding database...');
    // Run seed inline
    const bcrypt = require('bcryptjs');
    const Admin = require('./src/models/Admin');
    const Student = require('./src/models/Student');
    const Faculty = require('./src/models/Faculty');
    const Subject = require('./src/models/Subject');
    const ClassSchedule = require('./src/models/ClassSchedule');
    const ExamSchedule = require('./src/models/ExamSchedule');
    const Notice = require('./src/models/Notice');
    const LibraryBook = require('./src/models/LibraryBook');
    const Assignment = require('./src/models/Assignment');
    const Fee = require('./src/models/Fee');
    const Attendance = require('./src/models/Attendance');

    const hash = (p) => bcrypt.hash(p, 12);

    const adminUser = await User.create({ email: 'admin@college.edu', passwordHash: await hash('Admin@123'), role: 'admin' });
    const admin = await Admin.create({ userId: adminUser._id, firstName: 'Super', lastName: 'Admin', phone: '9000000000' });

    const f1User = await User.create({ email: 'prof.sharma@college.edu', passwordHash: await hash('Faculty@123'), role: 'faculty' });
    const f2User = await User.create({ email: 'prof.gupta@college.edu', passwordHash: await hash('Faculty@123'), role: 'faculty' });

    const faculty1 = await Faculty.create({ userId: f1User._id, employeeId: 'EMP001', firstName: 'Rajesh', lastName: 'Sharma', department: 'IT', designation: 'Associate Professor', qualification: 'M.Tech', joiningDate: new Date('2018-07-01'), phone: '9111111111' });
    const faculty2 = await Faculty.create({ userId: f2User._id, employeeId: 'EMP002', firstName: 'Priya', lastName: 'Gupta', department: 'CSE', designation: 'Assistant Professor', qualification: 'Ph.D', joiningDate: new Date('2020-01-15'), phone: '9222222222' });

    const sub1 = await Subject.create({ code: 'IT501', name: 'Data Structures & Algorithms', branch: 'IT', semester: 5, credits: 4, facultyId: faculty1._id });
    const sub2 = await Subject.create({ code: 'IT502', name: 'Computer Networks', branch: 'IT', semester: 5, credits: 3, facultyId: faculty1._id });
    const sub3 = await Subject.create({ code: 'CSE501', name: 'Database Management Systems', branch: 'CSE', semester: 5, credits: 4, facultyId: faculty2._id });
    const sub4 = await Subject.create({ code: 'CSE502', name: 'Operating Systems', branch: 'CSE', semester: 5, credits: 3, facultyId: faculty2._id });

    await Faculty.findByIdAndUpdate(faculty1._id, { subjectsTaught: [sub1._id, sub2._id] });
    await Faculty.findByIdAndUpdate(faculty2._id, { subjectsTaught: [sub3._id, sub4._id] });

    const makeStudent = async (email, enrollNo, first, last) => {
      const u = await User.create({ email, passwordHash: await hash('Student@123'), role: 'student' });
      return Student.create({ userId: u._id, enrollmentNo: enrollNo, firstName: first, lastName: last, branch: 'IT', currentSemester: 5, section: 'A', year: 3, session: '2024-25', gender: 'female', phone: '9000000001', fatherName: 'Ram ' + last, motherName: 'Sita ' + last });
    };

    const s1 = await makeStudent('alice@student.college.edu', '0801IT221001', 'Alice', 'Patel');
    const s2 = await makeStudent('bob@student.college.edu', '0801IT221002', 'Bob', 'Verma');
    const s3 = await makeStudent('carol@student.college.edu', '0801IT221003', 'Carol', 'Singh');

    for (const student of [s1, s2, s3]) {
      await Fee.create({ studentId: student._id, session: '2024-25', semester: 5, amount: 45000, dueDate: new Date('2024-08-31') });
    }

    await ClassSchedule.create({ session: '2024-25', semester: 5, branch: 'IT', section: 'A', timetable: [
      { day: 'Monday', slot: '9:00-10:00', subjectId: sub1._id, facultyId: faculty1._id, room: 'Lab 101' },
      { day: 'Monday', slot: '10:00-11:00', subjectId: sub2._id, facultyId: faculty1._id, room: 'Room 201' },
      { day: 'Tuesday', slot: '9:00-10:00', subjectId: sub1._id, facultyId: faculty1._id, room: 'Lab 101' },
      { day: 'Wednesday', slot: '11:00-12:00', subjectId: sub2._id, facultyId: faculty1._id, room: 'Room 201' },
      { day: 'Thursday', slot: '9:00-10:00', subjectId: sub1._id, facultyId: faculty1._id, room: 'Lab 101' },
      { day: 'Friday', slot: '10:00-11:00', subjectId: sub2._id, facultyId: faculty1._id, room: 'Room 201' },
    ]});

    await ExamSchedule.create({ session: '2024-25', semester: 5, branch: 'IT', examType: 'end', entries: [
      { subjectId: sub1._id, date: new Date('2024-11-15'), startTime: '10:00', endTime: '13:00', venue: 'Hall A' },
      { subjectId: sub2._id, date: new Date('2024-11-18'), startTime: '10:00', endTime: '13:00', venue: 'Hall B' },
    ]});

    await Notice.create({ title: 'Semester Exam Schedule Released', body: 'End semester exams for Semester 5 start from November 15. Please check the exam schedule section.', audience: 'all', postedBy: admin._id, isPinned: true });
    await Notice.create({ title: 'Assignment Submission Deadline', body: 'All pending assignments must be submitted by October 30, 2024. Late submissions will not be accepted.', audience: 'students', postedBy: admin._id });

    await LibraryBook.insertMany([
      { bookId: 'LB001', title: 'Introduction to Algorithms', author: 'Cormen et al.', isbn: '978-0262033848', copiesTotal: 5, copiesAvailable: 3 },
      { bookId: 'LB002', title: 'Computer Networks', author: 'Andrew Tanenbaum', isbn: '978-0132126953', copiesTotal: 4, copiesAvailable: 2 },
      { bookId: 'LB003', title: 'Database System Concepts', author: 'Silberschatz et al.', isbn: '978-0073523323', copiesTotal: 3, copiesAvailable: 3 },
      { bookId: 'LB004', title: 'Operating System Concepts', author: 'Silberschatz et al.', isbn: '978-1118063330', copiesTotal: 4, copiesAvailable: 4 },
      { bookId: 'LB005', title: 'Clean Code', author: 'Robert C. Martin', isbn: '978-0132350884', copiesTotal: 2, copiesAvailable: 1 },
    ]);

    await Assignment.create({ title: 'Implement BFS and DFS', description: 'Implement Breadth First Search and Depth First Search algorithms and compare their time complexities.', subjectId: sub1._id, facultyId: faculty1._id, dueDate: new Date('2024-10-30'), maxMarks: 20 });

    await Attendance.create({ subjectId: sub1._id, facultyId: faculty1._id, date: new Date('2024-10-01'), semester: 5, branch: 'IT', section: 'A', records: [
      { studentId: s1._id, status: 'present' },
      { studentId: s2._id, status: 'present' },
      { studentId: s3._id, status: 'absent' },
    ]});

    console.log('✅ Auto-seed complete! Demo users ready.');
  } else {
    console.log(`✅ Database has ${count} users — skipping seed.`);
  }
};

connectDB().then(() => autoSeed()).catch(err => console.error('Auto-seed error:', err));

// Enable CORS for specific origin
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173', // Use environment variable for frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Allow credentials (cookies, etc.)
};
app.use(cors(corsOptions));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')));
// Serve project docs (sample CSV/XLSX) at /docs
app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));

// Serve dynamically generated XLSX samples for frontend downloads
const { createStudentWorkbook, createFacultyWorkbook, createStudentTemplateWorkbook, createFacultyTemplateWorkbook } = require('./src/utils/excelExport');

app.get('/docs/sample_students.xlsx', async (req, res) => {
  try {
    // Simple sample rows matching the current bulk upload format
    const samples = [
      { rollNo: 'STU001', fullName: 'Rahul Sharma', email: 'rahul.sharma@college.edu', branch: 'IT', semester: 1 },
      { rollNo: 'STU002', fullName: 'Priya Verma', email: 'priya.verma@college.edu', branch: 'CSE', semester: 3 },
    ];

    const workbook = createStudentTemplateWorkbook(samples);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sample_students.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating student sample XLSX', err);
    res.status(500).send('Failed to generate sample');
  }
});

app.get('/docs/sample_faculty.xlsx', async (req, res) => {
  try {
    const samples = [
      { employeeId: 'FAC001', fullName: 'Amit Mishra', email: 'amit.mishra@college.edu', department: 'IT', designation: 'Professor' },
      { employeeId: 'FAC002', fullName: 'Neha Bhat', email: 'neha.bhat@college.edu', department: 'CSE', designation: 'Assistant Professor' },
    ];

    const workbook = createFacultyTemplateWorkbook(samples);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sample_faculty.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating faculty sample XLSX', err);
    res.status(500).send('Failed to generate sample');
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/faculty', facultyRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.message && err.message.includes('Invalid file format')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File size limit exceeded. Maximum size is 10MB.' });
  }
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
