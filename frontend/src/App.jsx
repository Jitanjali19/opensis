import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

// Icons for nav
import {
  LayoutDashboard, Users, UserCheck, BookOpen, Bell, Calendar,
  Clock, GraduationCap, User, ClipboardList, FileText,
  MessageSquare, BarChart3, CalendarDays, Zap
} from "lucide-react";

// Common pages
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";
import Students from "./pages/admin/Students";
import StudentDetail from "./pages/admin/StudentDetail";
import EnrollStudent from "./pages/admin/EnrollStudent";
import Faculty from "./pages/admin/Faculty";
import FacultyDetail from "./pages/admin/FacultyDetail";
import EnrollFaculty from "./pages/admin/EnrollFaculty";
import EditStudent from "./pages/admin/EditStudent";
import EditFaculty from "./pages/admin/EditFaculty";
import Subjects from "./pages/admin/Subjects";
import Notices from "./pages/admin/Notices";
import AdminExamSchedule from "./pages/admin/ExamSchedule";
import AdminClassSchedule from "./pages/admin/ClassSchedule";
import AdminResults from "./pages/admin/Results";
import BulkUploadStudents from "./pages/admin/BulkUploadStudents";
import BulkUploadFaculty from "./pages/admin/BulkUploadFaculty";
import SeedTestData from "./pages/admin/SeedTestData";
import AdminFeedback from "./pages/admin/Feedback";

// Student pages
import StudentDashboard from "./pages/student/Dashboard";
import StudentProfile from "./pages/student/Profile";
import StudentAttendance from "./pages/student/Attendance";
import StudentAssignments from "./pages/student/Assignments";
import StudentNotices from "./pages/student/Notices";
import StudentExam from "./pages/student/Exam";
import StudentFees from "./pages/student/Fees";
import StudentLibrary from "./pages/student/Library";
import StudentFeedback from "./pages/student/Feedback";
import StudentClasses from "./pages/student/Classes";

// Faculty pages
import FacultyDashboard from "./pages/faculty/Dashboard";
import FacultyProfile from "./pages/faculty/Profile";
import FacultyAttendance from "./pages/faculty/Attendance";
import FacultyAssignments from "./pages/faculty/Assignments";
import FacultyMarks from "./pages/faculty/Marks";
import FacultySchedule from "./pages/faculty/Schedule";
import FacultyNotices from "./pages/faculty/Notices";
import FacultyFeedback from "./pages/faculty/Feedback";

// Nav configs
const adminNav = [
  { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/students", label: "Students", icon: GraduationCap },
  { path: "/admin/bulk-upload-students", label: "Bulk Upload Students", icon: GraduationCap },
  { path: "/admin/faculty", label: "Faculty", icon: UserCheck },
  { path: "/admin/bulk-upload-faculty", label: "Bulk Upload Faculty", icon: UserCheck },
  { path: "/admin/subjects", label: "Subjects & Labs", icon: BookOpen },
  { path: "/admin/results", label: "Results", icon: BarChart3 },
  { path: "/admin/notices", label: "Notices", icon: Bell },
  { path: "/admin/feedback", label: "Feedback Review", icon: MessageSquare },
  { path: "/admin/exam-schedule", label: "Exam Schedule", icon: Calendar },
  { path: "/admin/class-schedule", label: "Class Schedule", icon: Clock },
  { path: "/admin/seed-test-data", label: "🧪 Seed Test Data", icon: Zap },
];

const studentNav = [
  { path: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/student/profile", label: "Profile", icon: User },
  { path: "/student/attendance", label: "Attendance", icon: ClipboardList },
  { path: "/student/assignments", label: "Assignments", icon: FileText },
  { path: "/student/classes", label: "Classes", icon: CalendarDays },
  { path: "/student/exam", label: "Exams & Results", icon: BarChart3 },
  { path: "/student/feedback", label: "Feedback", icon: MessageSquare },
  { path: "/student/notices", label: "Notices", icon: Bell },
];

const facultyNav = [
  { path: "/faculty/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/faculty/profile", label: "Profile", icon: User },
  { path: "/faculty/attendance", label: "Attendance", icon: ClipboardList },
  { path: "/faculty/assignments", label: "Assignments", icon: FileText },
  { path: "/faculty/marks", label: "Update Marks", icon: BarChart3 },
  { path: "/faculty/schedule", label: "Schedule", icon: CalendarDays },
  { path: "/faculty/notices", label: "Notices", icon: Bell },
  { path: "/faculty/feedback", label: "Student Feedback", icon: MessageSquare },
];

function AdminLayout({ children }) {
  return <Layout navItems={adminNav}>{children}</Layout>;
}
function StudentLayout({ children }) {
  return <Layout navItems={studentNav}>{children}</Layout>;
}
function FacultyLayout({ children }) {
  return <Layout navItems={facultyNav}>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={<ProtectedRoute roles={["admin"]}><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/students" element={<ProtectedRoute roles={["admin"]}><AdminLayout><Students /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/students/:id" element={<ProtectedRoute roles={["admin"]}><AdminLayout><StudentDetail /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/students/:id/edit" element={<ProtectedRoute roles={["admin"]}><AdminLayout><EditStudent /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/enroll-student" element={<ProtectedRoute roles={["admin"]}><AdminLayout><EnrollStudent /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/faculty" element={<ProtectedRoute roles={["admin"]}><AdminLayout><Faculty /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/faculty/:id" element={<ProtectedRoute roles={["admin"]}><AdminLayout><FacultyDetail /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/faculty/:id/edit" element={<ProtectedRoute roles={["admin"]}><AdminLayout><EditFaculty /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/enroll-faculty" element={<ProtectedRoute roles={["admin"]}><AdminLayout><EnrollFaculty /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/subjects" element={<ProtectedRoute roles={["admin"]}><AdminLayout><Subjects /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/notices" element={<ProtectedRoute roles={["admin"]}><AdminLayout><Notices /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/feedback" element={<ProtectedRoute roles={["admin"]}><AdminLayout><AdminFeedback /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/exam-schedule" element={<ProtectedRoute roles={["admin"]}><AdminLayout><AdminExamSchedule /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/class-schedule" element={<ProtectedRoute roles={["admin"]}><AdminLayout><AdminClassSchedule /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/results" element={<ProtectedRoute roles={["admin"]}><AdminLayout><AdminResults /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/bulk-upload-students" element={<ProtectedRoute roles={["admin"]}><AdminLayout><BulkUploadStudents /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/bulk-upload-faculty" element={<ProtectedRoute roles={["admin"]}><AdminLayout><BulkUploadFaculty /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/seed-test-data" element={<ProtectedRoute roles={["admin"]}><AdminLayout><SeedTestData /></AdminLayout></ProtectedRoute>} />

          {/* Student Routes */}
          <Route path="/student/dashboard" element={<ProtectedRoute roles={["student"]}><StudentLayout><StudentDashboard /></StudentLayout></ProtectedRoute>} />
          <Route path="/student/profile" element={<ProtectedRoute roles={["student"]}><StudentLayout><StudentProfile /></StudentLayout></ProtectedRoute>} />
          <Route path="/student/attendance" element={<ProtectedRoute roles={["student"]}><StudentLayout><StudentAttendance /></StudentLayout></ProtectedRoute>} />
          <Route path="/student/assignments" element={<ProtectedRoute roles={["student"]}><StudentLayout><StudentAssignments /></StudentLayout></ProtectedRoute>} />
          <Route path="/student/classes" element={<ProtectedRoute roles={["student"]}><StudentLayout><StudentClasses /></StudentLayout></ProtectedRoute>} />
          <Route path="/student/exam" element={<ProtectedRoute roles={["student"]}><StudentLayout><StudentExam /></StudentLayout></ProtectedRoute>} />
          <Route path="/student/fees" element={<ProtectedRoute roles={["student"]}><StudentLayout><StudentFees /></StudentLayout></ProtectedRoute>} />
          <Route path="/student/library" element={<ProtectedRoute roles={["student"]}><StudentLayout><StudentLibrary /></StudentLayout></ProtectedRoute>} />
          <Route path="/student/feedback" element={<ProtectedRoute roles={["student"]}><StudentLayout><StudentFeedback /></StudentLayout></ProtectedRoute>} />
          <Route path="/student/notices" element={<ProtectedRoute roles={["student"]}><StudentLayout><StudentNotices /></StudentLayout></ProtectedRoute>} />

          {/* Faculty Routes */}
          <Route path="/faculty/dashboard" element={<ProtectedRoute roles={["faculty"]}><FacultyLayout><FacultyDashboard /></FacultyLayout></ProtectedRoute>} />
          <Route path="/faculty/profile" element={<ProtectedRoute roles={["faculty"]}><FacultyLayout><FacultyProfile /></FacultyLayout></ProtectedRoute>} />
          <Route path="/faculty/attendance" element={<ProtectedRoute roles={["faculty"]}><FacultyLayout><FacultyAttendance /></FacultyLayout></ProtectedRoute>} />
          <Route path="/faculty/assignments" element={<ProtectedRoute roles={["faculty"]}><FacultyLayout><FacultyAssignments /></FacultyLayout></ProtectedRoute>} />
          <Route path="/faculty/marks" element={<ProtectedRoute roles={["faculty"]}><FacultyLayout><FacultyMarks /></FacultyLayout></ProtectedRoute>} />
          <Route path="/faculty/schedule" element={<ProtectedRoute roles={["faculty"]}><FacultyLayout><FacultySchedule /></FacultyLayout></ProtectedRoute>} />
          <Route path="/faculty/feedback" element={<ProtectedRoute roles={["faculty"]}><FacultyLayout><FacultyFeedback /></FacultyLayout></ProtectedRoute>} />
          <Route path="/faculty/notices" element={<ProtectedRoute roles={["faculty"]}><FacultyLayout><FacultyNotices /></FacultyLayout></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
