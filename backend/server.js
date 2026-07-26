import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import adminRoutes from './adminRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 5000;

// Middleware for verifying JWT and extracting user
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Middleware for audit logging
const auditLog = async (req, action, details) => {
  try {
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.ip || req.connection.remoteAddress;
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [userId, action, details, ipAddress]
    );
  } catch (error) {
    console.error('Audit log failed:', error);
  }
};

// Basic route
app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to the Student Result Management System API' });
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role_name, department: user.department, faculty: user.faculty },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    req.user = { id: user.id }; // for audit log
    await auditLog(req, 'LOGIN', `User ${username} logged in successfully`);
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role_name,
        full_name: user.full_name,
        department: user.department,
        faculty: user.faculty
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Student Self-Registration Endpoint
app.post('/api/auth/register-student', async (req, res) => {
  const { full_name, email, reg_number, department, level, password } = req.body;
  
  if (!full_name || !email || !reg_number || !department || !level || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const roleRes = await pool.query("SELECT id FROM roles WHERE name = 'Student'");
    if (roleRes.rows.length === 0) return res.status(500).json({ error: 'Student role not found' });
    const studentRoleId = roleRes.rows[0].id;
    
    const hash = await bcrypt.hash(password, 10);
    
    await pool.query('BEGIN');
    const userRes = await pool.query(
      'INSERT INTO users (username, password_hash, role_id, full_name, email) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [reg_number, hash, studentRoleId, full_name, email]
    );
    const userId = userRes.rows[0].id;
    
    await pool.query(
      'INSERT INTO students (user_id, matric_no, department, level) VALUES ($1, $2, $3, $4)',
      [userId, reg_number, department, level]
    );
    
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [userId, 'STUDENT_REGISTER', `Student ${reg_number} registered successfully`, req.ip || req.connection.remoteAddress]
    );
    
    await pool.query('COMMIT');
    res.json({ message: 'Registration successful! You can now log in.' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    if (err.constraint === 'users_username_key') return res.status(400).json({ error: 'Registration Number already exists' });
    if (err.constraint === 'users_email_key') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Admin Routes
app.use('/api/admin', authenticateToken, adminRoutes);

// Lecturer: Get my assigned courses
// --- STUDENT COURSE REGISTRATION ENDPOINTS ---

// Student: Get courses available for registration (with carryover detection)
app.get('/api/courses/available-for-registration', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Student') return res.status(403).json({ error: 'Unauthorized' });
  
  const targetSession = (req.query.session || '2025/2026').trim();
  const targetSemester = parseInt(req.query.semester) || 1;
  const targetLevel = parseInt(req.query.level) || 100;
  
  try {
    const studentRes = await pool.query('SELECT id, department, level FROM students WHERE user_id = $1', [req.user.id]);
    if (studentRes.rows.length === 0) return res.status(404).json({ error: 'Student record not found' });
    const student = studentRes.rows[0];
    
    // Fetch courses matching selected level, department, and semester
    const coursesRes = await pool.query(
      `SELECT c.* 
       FROM courses c 
       WHERE c.semester = $1 
         AND c.level = $2 
         AND (LOWER(TRIM(c.department)) = LOWER(TRIM($3)) OR LOWER(TRIM(c.department)) = 'general')
       ORDER BY c.course_code ASC`,
      [targetSemester, targetLevel, student.department]
    );
    
    // Fetch carryover courses (courses where student previously received F)
    const carryoversRes = await pool.query(
      `SELECT DISTINCT c.* 
       FROM results r 
       JOIN courses c ON r.course_id = c.id 
       WHERE r.student_id = $1 AND r.grade = 'F' AND c.semester = $2`,
      [student.id, targetSemester]
    );
    
    // Combine courses, tagging carryovers
    const carryoverIds = new Set(carryoversRes.rows.map(c => c.id));
    const allAvailable = [...coursesRes.rows];
    
    // Append carryovers if not already present
    carryoversRes.rows.forEach(co => {
      if (!allAvailable.some(a => a.id === co.id)) {
        allAvailable.push(co);
      }
    });
    
    const formattedCourses = allAvailable.map(c => ({
      ...c,
      is_carryover: carryoverIds.has(c.id)
    }));
    
    // Fetch existing registrations for this session
    const regRes = await pool.query(
      `SELECT course_id FROM course_registrations WHERE student_id = $1 AND session = $2`,
      [student.id, targetSession]
    );
    const registeredIds = regRes.rows.map(r => r.course_id);
    
    res.json({
      courses: formattedCourses,
      registered_ids: registeredIds,
      student
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch available courses' });
  }
});

// Student: Register courses
app.post('/api/courses/register', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Student') return res.status(403).json({ error: 'Unauthorized' });
  
  const { course_ids, session, semester } = req.body;
  if (!Array.isArray(course_ids) || course_ids.length === 0) {
    return res.status(400).json({ error: 'Please select at least one course to register.' });
  }
  
  const targetSession = (session || '2025/2026').trim();
  const targetSemester = parseInt(semester) || 1;
  
  try {
    const studentRes = await pool.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
    if (studentRes.rows.length === 0) return res.status(404).json({ error: 'Student record not found' });
    const studentId = studentRes.rows[0].id;
    
    await pool.query('BEGIN');
    
    for (const courseId of course_ids) {
      await pool.query(
        `INSERT INTO course_registrations (student_id, course_id, session, semester) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (student_id, course_id, session) DO NOTHING`,
        [studentId, courseId, targetSession, targetSemester]
      );
    }
    
    await auditLog(req, 'COURSE_REGISTRATION', `Registered ${course_ids.length} courses for ${targetSession}`);
    await pool.query('COMMIT');
    
    res.json({ message: 'Course registration completed successfully!' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to register courses' });
  }
});

// Student: Get registered courses list
app.get('/api/courses/my-registrations', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const studentRes = await pool.query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
    if (studentRes.rows.length === 0) return res.status(404).json({ error: 'Student record not found' });
    
    const result = await pool.query(
      `SELECT cr.id, cr.session, cr.semester, c.course_code, c.title, c.credit_units, c.department, c.level
       FROM course_registrations cr
       JOIN courses c ON cr.course_id = c.id
       WHERE cr.student_id = $1
       ORDER BY cr.session DESC, cr.semester ASC, c.course_code ASC`,
      [studentRes.rows[0].id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Lecturer: Get allocated courses filtered by session/semester/level
app.get('/api/courses/my-courses', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Lecturer') return res.status(403).json({ error: 'Unauthorized' });
  
  const { session, semester, level } = req.query;
  
  try {
    let query = `SELECT c.*, ca.session,
                        (SELECT rejection_reason FROM results r WHERE r.course_id = c.id AND r.status = 'Rejected' LIMIT 1) as rejection_reason,
                        (SELECT status FROM results r WHERE r.course_id = c.id LIMIT 1) as status
                 FROM courses c 
                 JOIN course_allocations ca ON c.id = ca.course_id 
                 WHERE ca.lecturer_id = $1 `;
    const params = [req.user.id];
    
    if (session) {
      params.push(session.trim());
      query += ` AND ca.session = $${params.length} `;
    }
    if (semester) {
      params.push(parseInt(semester));
      query += ` AND c.semester = $${params.length} `;
    }
    if (level) {
      params.push(parseInt(level));
      query += ` AND c.level = $${params.length} `;
    }
    
    query += ` ORDER BY c.course_code ASC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Lecturer: Get registered students for a specific course & session
app.get('/api/courses/:id/students', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Lecturer') return res.status(403).json({ error: 'Unauthorized' });
  
  const courseId = req.params.id;
  const session = (req.query.session || '2025/2026').trim();
  
  try {
    // Primary query: Fetch students who officially registered for this course
    let result = await pool.query(
      `SELECT s.id as student_id, u.full_name, s.matric_no, s.level, s.department,
              r.ca_score, r.exam_score, r.status
       FROM course_registrations cr
       JOIN students s ON cr.student_id = s.id
       JOIN users u ON s.user_id = u.id
       LEFT JOIN results r ON s.id = r.student_id AND r.course_id = $1
       WHERE cr.course_id = $1 AND cr.session = $2
       ORDER BY s.matric_no ASC`,
      [courseId, session]
    );
    
    // Fallback: If no student registered yet for this session, fetch students in course's department so lecturer can grade
    if (result.rows.length === 0) {
      const courseRes = await pool.query('SELECT department, level FROM courses WHERE id = $1', [courseId]);
      if (courseRes.rows.length > 0) {
        const courseDept = courseRes.rows[0].department;
        const courseLvl = courseRes.rows[0].level;
        result = await pool.query(
          `SELECT s.id as student_id, u.full_name, s.matric_no, s.level, s.department,
                  r.ca_score, r.exam_score, r.status
           FROM students s
           JOIN users u ON s.user_id = u.id
           LEFT JOIN results r ON s.id = r.student_id AND r.course_id = $1
           WHERE LOWER(TRIM(s.department)) = LOWER(TRIM($2)) AND s.level = $3
           ORDER BY s.matric_no ASC`,
          [courseId, courseDept, courseLvl]
        );
      }
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Result Upload Endpoint
app.post('/api/results/upload', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Lecturer') {
    return res.status(403).json({ error: 'Unauthorized to upload results' });
  }
  
  const { results, course_id } = req.body;
  
  try {
    await pool.query('BEGIN');
    
    for (const r of results) {
      const ca = parseFloat(r.ca_score) || 0;
      const exam = parseFloat(r.exam_score) || 0;
      const total = ca + exam;
      
      let grade = 'F';
      if (total >= 70) grade = 'A';
      else if (total >= 60) grade = 'B';
      else if (total >= 50) grade = 'C';
      else if (total >= 45) grade = 'D';
      else if (total >= 40) grade = 'E';

      await pool.query(
        `INSERT INTO results (student_id, course_id, ca_score, exam_score, total_score, grade, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
         ON CONFLICT (student_id, course_id) 
         DO UPDATE SET ca_score = EXCLUDED.ca_score, exam_score = EXCLUDED.exam_score, 
                       total_score = EXCLUDED.total_score, grade = EXCLUDED.grade, status = 'Pending', updated_at = CURRENT_TIMESTAMP`,
        [r.student_id, course_id, ca, exam, total, grade]
      );
    }
    
    await auditLog(req, 'RESULT_UPLOAD', `Uploaded results for course ID ${course_id}`);
    await pool.query('COMMIT');
    
    res.json({ message: 'Results uploaded successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to upload results' });
  }
});

// Officer: Get pending results grouped by course
app.get('/api/results/pending', authenticateToken, async (req, res) => {
  if (!req.user.role.includes('Officer')) return res.status(403).json({ error: 'Unauthorized' });
  
  const targetStatus = req.user.role === 'Department_Officer' ? 'Pending' : 'Dept_Approved';
  const roleType = req.user.role;
  const userDept = (req.user.department || '').trim();
  const userFac = (req.user.faculty || '').trim();
  
  const { session, semester } = req.query;
  
  try {
    let query = `SELECT r.course_id, c.course_code, c.title, c.department, c.faculty, c.level, c.semester, COUNT(r.student_id) as student_count, r.status
                 FROM results r
                 JOIN courses c ON r.course_id = c.id
                 WHERE r.status = $1 `;
    
    const params = [targetStatus];
    
    if (roleType === 'Department_Officer' && userDept) {
        params.push(userDept);
        query += ` AND LOWER(TRIM(c.department)) = LOWER(TRIM($${params.length})) `;
    } else if (roleType === 'Faculty_Officer' && userFac) {
        params.push(userFac);
        query += ` AND LOWER(TRIM(c.faculty)) = LOWER(TRIM($${params.length})) `;
    }
    
    if (semester) {
        params.push(parseInt(semester));
        query += ` AND c.semester = $${params.length} `;
    }
    
    query += ` GROUP BY r.course_id, c.course_code, c.title, c.department, c.faculty, c.level, c.semester, r.status`;
    
    let result = await pool.query(query, params);
    
    // Fallback if department filter returned 0
    if (result.rows.length === 0) {
        const fallbackQuery = `SELECT r.course_id, c.course_code, c.title, c.department, c.faculty, c.level, c.semester, COUNT(r.student_id) as student_count, r.status
                               FROM results r
                               JOIN courses c ON r.course_id = c.id
                               WHERE r.status = $1
                               GROUP BY r.course_id, c.course_code, c.title, c.department, c.faculty, c.level, c.semester, r.status`;
        result = await pool.query(fallbackQuery, [targetStatus]);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Officer: Get approved results grouped by course
app.get('/api/results/approved', authenticateToken, async (req, res) => {
  if (!req.user.role.includes('Officer')) return res.status(403).json({ error: 'Unauthorized' });
  
  const roleType = req.user.role;
  const userDept = (req.user.department || '').trim();
  const userFac = (req.user.faculty || '').trim();
  
  try {
    let query = `SELECT r.course_id, c.course_code, c.title, c.department, c.faculty, COUNT(r.student_id) as student_count, r.status
                 FROM results r
                 JOIN courses c ON r.course_id = c.id
                 WHERE 1=1 `;
    const params = [];
    
    if (roleType === 'Department_Officer') {
        query += ` AND r.status IN ('Dept_Approved', 'Faculty_Approved') `;
        if (userDept) {
            query += ` AND LOWER(TRIM(c.department)) = LOWER(TRIM($1)) `;
            params.push(userDept);
        }
    } else if (roleType === 'Faculty_Officer') {
        query += ` AND r.status = 'Faculty_Approved' `;
        if (userFac) {
            query += ` AND LOWER(TRIM(c.faculty)) = LOWER(TRIM($1)) `;
            params.push(userFac);
        }
    }
    
    query += ` GROUP BY r.course_id, c.course_code, c.title, c.department, c.faculty, r.status`;
    
    let result = await pool.query(query, params);
    
    // Fallback if department filter returned 0
    if (result.rows.length === 0) {
        const targetApprovedStatus = roleType === 'Department_Officer' ? ['Dept_Approved', 'Faculty_Approved'] : ['Faculty_Approved'];
        const fallbackApprovedQuery = `SELECT r.course_id, c.course_code, c.title, c.department, c.faculty, COUNT(r.student_id) as student_count, r.status
                                       FROM results r
                                       JOIN courses c ON r.course_id = c.id
                                       WHERE r.status = ANY($1)
                                       GROUP BY r.course_id, c.course_code, c.title, c.department, c.faculty, r.status`;
        result = await pool.query(fallbackApprovedQuery, [targetApprovedStatus]);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Officer: View detailed marks for a course before approval
app.get('/api/results/course/:id', authenticateToken, async (req, res) => {
    if (!req.user.role.includes('Officer')) return res.status(403).json({ error: 'Unauthorized' });
    
    try {
        const result = await pool.query(
            `SELECT s.matric_no, u.full_name, r.ca_score, r.exam_score, r.total_score, r.grade
             FROM results r
             JOIN students s ON r.student_id = s.id
             JOIN users u ON s.user_id = u.id
             WHERE r.course_id = $1`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch course marks' });
    }
});

// Officer: Reject Results with a message
app.post('/api/results/reject', authenticateToken, async (req, res) => {
    const { course_id, message } = req.body;
    
    if (!req.user.role.includes('Officer')) return res.status(403).json({ error: 'Unauthorized' });
    
    try {
        await pool.query(
            `UPDATE results 
             SET status = 'Rejected', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE course_id = $2`,
            [message, course_id]
        );
        await auditLog(req, 'RESULT_REJECTED', `Course ID ${course_id} results rejected by ${req.user.role}. Reason: ${message}`);
        res.json({ message: 'Results have been rejected and returned to the lecturer.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reject results' });
    }
});

// Result Approval Endpoint (For Dept / Faculty Officers)
app.post('/api/results/approve', authenticateToken, async (req, res) => {
  const { course_id, new_status } = req.body;
  
  if (req.user.role !== 'Department_Officer' && req.user.role !== 'Faculty_Officer') {
    return res.status(403).json({ error: 'Unauthorized to approve results' });
  }

  // Strict transition check: Dept_Officer approves 'Pending' -> 'Dept_Approved', Faculty_Officer approves 'Dept_Approved' -> 'Faculty_Approved'
  let currentRequiredStatus = 'Pending';
  if (req.user.role === 'Faculty_Officer') {
    currentRequiredStatus = 'Dept_Approved';
  }
  
  try {
    const result = await pool.query(
      `UPDATE results SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE course_id = $2 AND status = $3`,
      [new_status, course_id, currentRequiredStatus]
    );
    
    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Results cannot be approved at this stage or are not pending approval.' });
    }
    
    await auditLog(req, 'RESULT_APPROVAL', `Updated status to ${new_status} for course ID ${course_id}`);
    
    res.json({ message: `Results successfully updated to ${new_status.replace(/_/g, ' ')}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update result status' });
  }
});

// Student View Results
app.get('/api/results/my-results', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Student') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  try {
    const studentQuery = await pool.query('SELECT s.id, s.matric_no, s.department, s.level, u.full_name FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = $1', [req.user.id]);
    if (studentQuery.rows.length === 0) return res.status(404).json({ error: 'Student profile not found' });
    
    const student = studentQuery.rows[0];
    
    // Fetch all Faculty_Approved results for the student
    const result = await pool.query(
      `SELECT r.*, c.course_code, c.title, c.credit_units, c.semester, c.department as course_dept 
       FROM results r 
       JOIN courses c ON r.course_id = c.id 
       WHERE r.student_id = $1 AND r.status = 'Faculty_Approved'
       ORDER BY c.semester ASC, c.course_code ASC`,
      [student.id]
    );
    
    const results = result.rows;
    const gradePoints = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'F': 0 };
    
    let cumulativeCredits = 0;
    let cumulativePoints = 0;
    
    // Group results by Semester
    const semesterMap = {};
    
    results.forEach(r => {
      const gpaPoint = gradePoints[r.grade] || 0;
      const pointEarned = r.credit_units * gpaPoint;
      
      cumulativeCredits += r.credit_units;
      cumulativePoints += pointEarned;
      
      const semKey = `Semester ${r.semester}`;
      if (!semesterMap[semKey]) {
        semesterMap[semKey] = {
          semesterName: `Semester ${r.semester === 1 ? 'I (First Semester)' : 'II (Second Semester)'}`,
          semesterNum: r.semester,
          courses: [],
          semCredits: 0,
          semPoints: 0,
          sgpa: '0.00'
        };
      }
      
      semesterMap[semKey].courses.push({ ...r, gpa_point: gpaPoint, point_earned: pointEarned });
      semesterMap[semKey].semCredits += r.credit_units;
      semesterMap[semKey].semPoints += pointEarned;
    });
    
    // Calculate SGPA for each semester
    Object.keys(semesterMap).forEach(key => {
      const sem = semesterMap[key];
      sem.sgpa = sem.semCredits > 0 ? (sem.semPoints / sem.semCredits).toFixed(2) : '0.00';
    });
    
    const cgpa = cumulativeCredits > 0 ? (cumulativePoints / cumulativeCredits).toFixed(2) : '0.00';
    
    res.json({
      student,
      results,
      semesters: Object.values(semesterMap),
      cgpa,
      totalCredits: cumulativeCredits,
      totalPoints: cumulativePoints
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
