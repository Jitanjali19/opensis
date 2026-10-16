# College ERP — Modern College Management System

A full-featured **College Management System (ERP)** built with the **MERN stack** (MongoDB, Express, React, Node.js). Supports three roles: **Admin**, **Student**, and **Faculty** — each with dedicated dashboards and features.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+
- **MongoDB** (local or Atlas connection string)
- **npm** or **yarn**

### 1. Clone & Install

```bash
# Backend
cd college-erp/backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Environment Setup

Create `backend/.env` (see `.env.example`):

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/college-erp
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
CLIENT_URL=http://localhost:5173
```

### 3. Seed Database

```bash
cd backend
npm run seed
```

### 4. Run Development Servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@college.edu | Admin@123 |
| **Faculty** | prof.sharma@college.edu | Faculty@123 |
| **Faculty** | prof.gupta@college.edu | Faculty@123 |
| **Student** | alice@student.college.edu | Student@123 |
| **Student** | bob@student.college.edu | Student@123 |
| **Student** | carol@student.college.edu | Student@123 |

---

## ✨ Features

### 🔐 Authentication
- JWT-based login with access + refresh tokens
- Forgot password (reset token in dev mode)
- Role-based access control (Admin / Student / Faculty)

### 👨‍💼 Admin Panel
- **Dashboard** — Stats overview (students, faculty, subjects, notices)
- **Enroll Student** — Full registration form
- **Students List** — Filterable by branch/semester, with detail view
- **Enroll Faculty** — Full registration form
- **Faculty List** — With detail view and subjects taught
- **Subjects** — Create and list subjects, assign to faculty
- **Notices** — Create, list, delete with audience targeting (all/students/faculty)
- **Exam Schedule** — Create exam schedules with subject-date-time-venue rows
- **Fee Management** — View all fee records

### 🎓 Student Portal
- **Dashboard** — Attendance %, pending assignments, unpaid fees, recent notices
- **Profile** — View + edit phone/address
- **Attendance** — Subject-wise table with progress bars and percentages
- **Assignments** — View, upload submissions, view grades/feedback
- **Exams & Results** — Exam schedule, admit card (printable), results with SGPA, revaluation request
- **Fees** — Summary cards, pay button (mock), receipt download (printable)
- **Library** — Issued books, due dates, overdue alerts, fines
- **Feedback** — Star rating form per subject with feedback history
- **Notices** — Read-only list with pinned notice support

### 👩‍🏫 Faculty Portal
- **Dashboard** — My subjects, recent notices
- **Profile** — View + edit phone/address/designation/qualification
- **Attendance** — Mark attendance grid + past attendance history
- **Assignments** — Create, list by subject, view submissions, inline grading
- **Update Marks** — Bulk marks entry (internal + external), auto SGPA/grade calculation
- **Notices** — Read-only list

### 📄 PDF Features
- **Admit Card** — Printable admit card with student info + exam schedule (via react-to-print)
- **Fee Receipt** — Printable receipt with transaction details (via react-to-print)

---

## 🏗 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express, MongoDB (Mongoose), JWT, bcrypt, multer, express-validator |
| **Frontend** | React 18 (Vite), Tailwind CSS, React Router v6, axios, react-hot-toast, lucide-react, date-fns, react-to-print |
| **Dev Tools** | nodemon, Vite dev server with API proxy |

---

## 📁 Project Structure

```
college-erp/
├── backend/
│   ├── src/
│   │   ├── config/        (db.js)
│   │   ├── controllers/   (auth, admin, student, faculty)
│   │   ├── middleware/     (auth.js, upload.js)
│   │   ├── models/        (16 Mongoose models)
│   │   ├── routes/        (auth, admin, student, faculty)
│   │   ├── seed/          (seed.js)
│   │   ├── uploads/       (file storage)
│   │   └── utils/         (jwt.js)
│   ├── .env / .env.example
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/           (axios.js with interceptors)
│   │   ├── components/    (Layout, ProtectedRoute)
│   │   ├── context/       (AuthContext)
│   │   ├── pages/
│   │   │   ├── Login, ForgotPassword, ResetPassword, NotFound
│   │   │   ├── admin/     (11 pages)
│   │   │   ├── student/   (10 pages)
│   │   │   └── faculty/   (7 pages)
│   │   ├── App.jsx, main.jsx, index.css
│   │   └── tailwind.config.js
│   └── package.json
└── README.md
```

---

## 📊 Data Models (16 total)

User, Student, Faculty, Admin, Subject, Attendance, Assignment, Notice, ExamSchedule, Result, Fee, LibraryBook, LibraryIssue, Feedback, RevaluationRequest

---

## 🎯 Demo Flow

1. **Login as Admin** → Enroll a student → Enroll a faculty → Create subject → Post a notice
2. **Login as Student** → Dashboard stats → View profile → View attendance → Download admit card → View notices
3. **Login as Faculty** → Mark attendance → Create assignment → View submissions → Grade

---

## 📋 Seed Data Includes

- 1 Admin, 3 Students (IT, Sem 5), 2 Faculty (IT + CSE)
- 4 Subjects (IT501, IT502, CSE501, CSE502)
- 1 Exam Schedule
- 2 Notices (1 pinned)
- 5 Library Books
- 1 Sample Assignment
- 1 Sample Attendance Record
- Fee records for all students

---

## 📝 License

MIT
