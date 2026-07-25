# 🎓 Student Result Management System (SRMS)

A modern, responsive, web-based Student Result Management System built with Node.js, Express, PostgreSQL, HTML5, CSS3, and JavaScript (ES6+).

---

## 🌟 Key Features

### 👤 Role-Based Access Control (RBAC)
- **Admin**: Create staff/user accounts, manage course registrations, allocate courses to lecturers, advance student levels, and view system audit logs.
- **Lecturers**: View allocated courses, input/edit CA (max 30) and semester exam (max 70) scores, view student rosters, and handle score resubmissions for rejected broadsheets.
- **Department Examination Officer**: Review pending result broadsheets for department courses, approve (`Dept_Approved`) or reject with feedback reasons, and view printable result broadsheets.
- **Faculty Examination Officer**: Perform final faculty-level result review (`Faculty_Approved`) or reject back to lecturer, print faculty broadsheets, and release results.
- **Student**: View published results categorized by semester, view Semester GPA (SGPA) and Cumulative GPA (CGPA), and generate/print official Academic Transcripts / Statements of Result.

### 📊 Academic Grade & GPA Engine
- 5.0 Grade Point Average System:
  - **A (70-100)**: 5.0 Points
  - **B (60-69)**: 4.0 Points
  - **C (50-59)**: 3.0 Points
  - **D (45-49)**: 2.0 Points
  - **E (40-44)**: 1.0 Point
  - **F (0-39)**: 0.0 Points
- Automatic **Semester GPA (SGPA)** and **Cumulative GPA (CGPA)** calculation.
- Degree Classifications (First Class, Second Class Upper, Second Class Lower, Third Class, Fail).

---

## 🏗️ Project Architecture

```
Gandu/
├── backend/
│   ├── adminRoutes.js      # Admin management routes (Users, Courses, Allocations, Logs)
│   ├── db.js               # PostgreSQL database connection pool
│   ├── package.json        # Node.js dependencies and scripts
│   ├── seedAdmin.js        # Initial Admin user seeder script
│   ├── server.js           # Core API endpoints & Auth middleware
│   ├── setupDb.js          # Database setup and schema initialization
│   └── updateSchema.js     # Schema migration script
├── database/
│   └── init.sql            # Database tables schema and initial roles
├── frontend/
│   ├── app.js              # Client-side SPA routing, API integration & UI renderers
│   ├── index.html          # Main HTML entry point
│   └── styles.css          # Responsive design CSS system
├── .gitignore              # Git ignore rules for secrets and node_modules
└── README.md               # Project documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [PostgreSQL](https://www.postgresql.org/) database server

### 1. Database Setup
1. Create PostgreSQL database:
   ```sql
   CREATE DATABASE srms_db;
   ```
2. Import database schema:
   ```bash
   cd backend
   npm run setup-db
   ```
   Or execute `database/init.sql` directly in your PostgreSQL client (pgAdmin / psql).

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment variables file and configure your database credentials:
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your PostgreSQL password:
   ```env
   PORT=5000
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=srms_db
   DB_PASSWORD=your_password
   DB_PORT=5432
   JWT_SECRET=supersecretjwtkey_for_srms
   ```
4. Start the backend server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
- Open `frontend/index.html` in your web browser or serve via Live Server / local static server.

---

## 🔒 Security & Best Practices
- **Password Security**: Passwords hashed using `bcrypt` (salt rounds: 10).
- **JWT Authentication**: Role-based endpoints protected via HTTP Bearer token middleware.
- **Data Protection**: Sensitive credential files (`.env`) and `node_modules` strictly excluded via `.gitignore`.

---

## 📜 License
This project is licensed under the MIT License.
