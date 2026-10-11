const ExcelJS = require('exceljs');

const formatYearLabel = (value) => {
  const year = Number(value);
  if (year === 1) return '1st Year';
  if (year === 2) return '2nd Year';
  if (year === 3) return '3rd Year';
  if (year === 4) return '4th Year';
  return '';
};

// Create a workbook with students data
const createStudentWorkbook = (students) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Students');

  // Define columns
  worksheet.columns = [
    { header: 'Enrollment No', key: 'enrollmentNo', width: 15 },
    { header: 'First Name', key: 'firstName', width: 15 },
    { header: 'Last Name', key: 'lastName', width: 15 },
    { header: 'Email', key: 'email', width: 20 },
    { header: 'Branch/Department', key: 'branch', width: 15 },
    { header: 'Current Semester', key: 'currentSemester', width: 15 },
    { header: 'Section', key: 'section', width: 10 },
    { header: 'Year', key: 'year', width: 15 },
    { header: 'Session', key: 'session', width: 12 },
    { header: 'DOB', key: 'dob', width: 12 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Address', key: 'address', width: 25 },
    { header: 'Father Name', key: 'fatherName', width: 15 },
    { header: 'Mother Name', key: 'motherName', width: 15 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center' };

  // Add data rows
  students.forEach((student) => {
    const row = {
      enrollmentNo: student.enrollmentNo,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email || '',
      branch: student.branch,
      currentSemester: student.currentSemester,
      section: student.section || '',
      year: formatYearLabel(student.year),
      session: student.session || '',
      dob: student.dob ? new Date(student.dob).toLocaleDateString() : '',
      gender: student.gender || '',
      phone: student.phone || '',
      address: student.address || '',
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
    };
    worksheet.addRow(row);
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook;
};

// Create a workbook template for student bulk upload
const createStudentTemplateWorkbook = (students) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Students');

  worksheet.columns = [
    { header: 'rollNo', key: 'rollNo', width: 18 },
    { header: 'fullName', key: 'fullName', width: 24 },
    { header: 'email', key: 'email', width: 24 },
    { header: 'phone', key: 'phone', width: 18 },
    { header: 'branch', key: 'branch', width: 22 },
    { header: 'semester', key: 'semester', width: 12 },
  ];

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center' };

  students.forEach((student) => {
    worksheet.addRow({
      rollNo: student.rollNo,
      fullName: student.fullName,
      email: student.email || '',
      phone: student.phone || '',
      branch: student.branch,
      semester: student.semester,
    });
  });

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  return workbook;
};

// Create a workbook with faculty data
const createFacultyWorkbook = (faculty) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Faculty');

  // Define columns
  worksheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 15 },
    { header: 'First Name', key: 'firstName', width: 15 },
    { header: 'Last Name', key: 'lastName', width: 15 },
    { header: 'Email', key: 'email', width: 20 },
    { header: 'Department', key: 'department', width: 15 },
    { header: 'Designation', key: 'designation', width: 15 },
    { header: 'Qualification', key: 'qualification', width: 20 },
    { header: 'Joining Date', key: 'joiningDate', width: 12 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Address', key: 'address', width: 25 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5C3E' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center' };

  // Add data rows
  faculty.forEach((member) => {
    const row = {
      employeeId: member.employeeId,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email || '',
      department: member.department || '',
      designation: member.designation || '',
      qualification: member.qualification || '',
      joiningDate: member.joiningDate ? new Date(member.joiningDate).toLocaleDateString() : '',
      phone: member.phone || '',
      address: member.address || '',
    };
    worksheet.addRow(row);
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  return workbook;
};

// Create a workbook template for faculty bulk upload
const createFacultyTemplateWorkbook = (faculty) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Faculty');

  worksheet.columns = [
    { header: 'employeeId', key: 'employeeId', width: 18 },
    { header: 'fullName', key: 'fullName', width: 24 },
    { header: 'email', key: 'email', width: 24 },
    { header: 'phone', key: 'phone', width: 18 },
    { header: 'department', key: 'department', width: 22 },
    { header: 'designation', key: 'designation', width: 18 },
  ];

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5C3E' } };
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center' };

  faculty.forEach((member) => {
    worksheet.addRow({
      employeeId: member.employeeId,
      fullName: member.fullName,
      email: member.email || '',
      phone: member.phone || '',
      department: member.department || '',
      designation: member.designation || '',
    });
  });

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  return workbook;
};

module.exports = {
  createStudentWorkbook,
  createFacultyWorkbook,
  createStudentTemplateWorkbook,
  createFacultyTemplateWorkbook,
};
