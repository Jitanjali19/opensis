# College ERP - SGSITS Indore

A role-based college ERP built with the MERN stack. The portal supports academic
session and term aware data across academics, timetables, examinations, results,
feedback, and complaints.

## Portals

- **Admin** - institutional oversight, academic setup, exam workflow, results,
  feedback analytics, and complaint management.
- **Student** - subjects, attendance, assignments, timetable, exams, results,
  fees, library, feedback, and complaints.
- **Faculty** - teaching subjects, attendance, assignments, marks, timetable,
  feedback, and complaints.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Node.js, Express, MongoDB, Mongoose |
| Auth | JWT access/refresh tokens, bcrypt |
| Frontend | React 18, Vite, Tailwind CSS, React Router v6 |
| Client libraries | Axios, react-to-print, lucide-react, react-hot-toast, date-fns |
| File handling | Multer, ExcelJS, xlsx, mammoth, PDFKit |
| Shared config | `shared/academicConfig.json`, `shared/roomConfig.json` |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- MongoDB connection string (local MongoDB or MongoDB Atlas)

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure the backend

Create `backend/.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your-mongodb-connection-string
JWT_ACCESS_SECRET=your-access-token-secret
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CLIENT_URL=http://localhost:5173
COLLEGE_NAME=SGSITS Indore
```

The backend `.env` file is ignored by Git.

### 3. Run the application

```bash
# Terminal 1 - backend
cd backend
npm run dev

# Terminal 2 - frontend
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The frontend proxies `/api`, `/uploads`, and `/docs` to `http://localhost:5000`.

---

## Academic Session and Term

The shared academic configuration defines:

- Departments: CSE, IT, ECE, IP, BM, CIVIL, MC
- Academic years: 2024-2025, 2025-2026, 2026-2027, 2027-2028
- Semesters 1-2 for first year, 3-4 for second year, 5-6 for third year, and
  7-8 for final year

Terms follow semester parity:

- `july-december` - odd semesters
- `january-june` - even semesters

Student and faculty requests send the selected session and term through
`X-Academic-Session` and `X-Academic-Term` headers. Student and faculty portals
have a global session/term selector; admin pages use page-level filters instead.
Changing the global term remounts the active page so session/term-aware data is
fetched again.

---

## Features

### Admin

- Dashboard statistics
- Student management: enrollment, bulk upload, edit, detail view
- Faculty management: enrollment, bulk upload, edit, detail view
- Subjects and labs: session-aware schemes, credits, marks distribution,
  electives, and faculty teaching assignments
- Class Timetable: session, term, semester, section, room, and batch aware
- Exam Timetable: upload and manage files by session, term, and exam type
  (`End Semester`, `Mid Semester 1`, `Mid Semester 2`)
- Admit Cards: select session, term, branch, and semester; generate all cards,
  view generated status, or delete generated cards
- Results: approve/reject faculty marks, generate gradesheets, view analytics,
  and process revaluation requests
- Feedback: configure the feedback window and review ratings, comments, faculty
  rankings, and analytics
- Complaints: view all complaints, filter by session/term/category/status,
  assign handlers, and respond
- Notices: publish targeted notices

### Student

- Dashboard and profile
- My Subjects and weekly timetable
- Attendance history and subject-wise percentages
- Assignments and submissions
- Exams & Results: exam timetable, issued admit card, gradesheet, internal
  marks, and revaluation requests
- Fees: summary, mock payment, and printable receipt
- Library: issued books, due dates, fines, and history
- Feedback: submit subject/faculty feedback and view history
- Complaints: submit and track complaints, with current-term default and an
  "All terms" option
- Notices with pinned notices and unread state

### Faculty

- Dashboard and profile
- My Subjects and weekly timetable
- Attendance: mark attendance and view past records
- Assignments: create assignments, view submissions, and grade
- Marks: manual entry, Excel upload, internal/coursework upload, and result view
- Feedback: view student feedback
- Complaints: resolve assigned complaints and track submitted complaints, with
  current-term default and an "All terms" option
- Notices

---

## Session/Term-Aware Modules

- **Complaints** store `session`, `term`, and optional `semester`. Student and
  faculty lists default to the selected term; `?allTerms=true` returns history.
  Admin list and summary support `session` and `term` filters.
- **Exam timetables** are unique by session, term, and exam type.
- **Admit cards** are unique by student, session, term, and exam type.
- **Class timetable entries** are session-scoped; term is enforced by semester
  parity.
- **Feedback** is scoped by session and term, including feedback-window config.

---

## API Areas

| Prefix | Purpose |
| --- | --- |
| `/api/auth` | Login, refresh, profile, password reset |
| `/api/admin` | Admin management, exam timetable, admit cards, results, feedback |
| `/api/student` | Student dashboard, attendance, exams, results, fees, library |
| `/api/faculty` | Faculty teaching, attendance, assignments, marks, feedback |
| `/api/complaints` | Complaint submission, assignment, and resolution |
| `/api/timetable` | Class timetable operations |
| `/api/sections` | Sections and batches |

Protected routes require `Authorization: Bearer <access-token>`.

---

## Project Structure

```text
college-erp/
|-- backend/
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middleware/
|   |   |-- migrations/
|   |   |-- models/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- uploads/
|   |   `-- utils/
|   |-- scripts/
|   |-- tests/
|   |-- seed-it-2026.js
|   |-- server.js
|   `-- package.json
|-- frontend/
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   |-- constants/
|   |   |-- context/
|   |   `-- pages/
|   |       |-- admin/
|   |       |-- faculty/
|   |       `-- student/
|   `-- package.json
|-- shared/
|   |-- academicConfig.json
|   `-- roomConfig.json
`-- README.md
```

---

## Data Models

**Accounts:** User, Admin, Student, Faculty, StudentAcademicHistory

**Academics:** Subject, Lab, LabBatch, Section, Room, TimetableEntry,
FacultyTeachingAssignment

**Examinations and results:** ExamTimetable, AdmitCard, Result, SubjectMarks,
ResultUploadBatch, ResultLock, RevaluationRequest, GradingRule

**Campus workflows:** Attendance, Assignment, Fee, LibraryBook, LibraryIssue,
Notice, Feedback, FeedbackConfig, Complaint

---

## Verification

```bash
cd backend
npm test

cd ../frontend
npm run build
```
