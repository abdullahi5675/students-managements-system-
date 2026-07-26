import express from 'express';
import bcrypt from 'bcrypt';
import pool from './db.js';

const router = express.Router();

// Middleware to ensure user is Admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  next();
};

router.use(requireAdmin);

// Get roles
router.get('/roles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.full_name, u.email, r.name as role_name,
             COALESCE(s.department, u.department) as department,
             COALESCE(u.faculty, '—') as faculty,
             s.level, s.matric_no
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN students s ON u.id = s.user_id
      ORDER BY u.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create User
router.post('/users', async (req, res) => {
  const { username, password, role_id, full_name, email, matric_no, department, faculty, level } = req.body;
  
  const cleanEmail = (email || username || '').trim().toLowerCase();
  const cleanName = (full_name || '').trim();
  const cleanDept = (department || '').trim();
  const cleanFac = (faculty || '').trim();
  
  if (!cleanEmail || !password || !cleanName || !role_id) {
    return res.status(400).json({ error: 'Full Name, Email, Password, and Role are required.' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    
    await pool.query('BEGIN');
    const userRes = await pool.query(
      'INSERT INTO users (username, password_hash, role_id, full_name, email, department, faculty) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [cleanEmail, hash, role_id, cleanName, cleanEmail, cleanDept, cleanFac]
    );
    
    const userId = userRes.rows[0].id;
    
    // Check if role is student
    const roleRes = await pool.query('SELECT name FROM roles WHERE id = $1', [role_id]);
    if (roleRes.rows[0].name === 'Student') {
      await pool.query(
        'INSERT INTO students (user_id, matric_no, department, level) VALUES ($1, $2, $3, $4)',
        [userId, matric_no || cleanEmail, cleanDept, level || 100]
      );
    }
    
    await pool.query('COMMIT');
    res.json({ message: 'User account created successfully!', id: userId });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'A user with this Email address already exists.' });
    }
    res.status(500).json({ error: 'Failed to create user. Please check database details.' });
  }
});

// Get courses
router.get('/courses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses ORDER BY level ASC, course_code ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create Course
router.post('/courses', async (req, res) => {
  const { course_code, title, credit_units, department, faculty, semester, level } = req.body;
  try {
    await pool.query(
      'INSERT INTO courses (course_code, title, credit_units, department, faculty, semester, level) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [course_code, title, credit_units, department, faculty, semester, level || 100]
    );
    res.json({ message: 'Course created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// Get Allocations
router.get('/allocations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ca.id, ca.lecturer_id, ca.course_id, ca.session, u.full_name as lecturer_name, u.email as lecturer_email, c.course_code, c.title as course_title, c.department, c.level, c.semester
      FROM course_allocations ca
      JOIN users u ON ca.lecturer_id = u.id
      JOIN courses c ON ca.course_id = c.id
      ORDER BY ca.session DESC, c.course_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch allocations' });
  }
});

// Allocate Course
router.post('/allocations', async (req, res) => {
  const { lecturer_id, course_id, session } = req.body;
  if (!lecturer_id || !course_id) {
    return res.status(400).json({ error: 'Please select both a Lecturer and a Course.' });
  }
  const cleanSession = (session || '2025/2026').trim();
  try {
    await pool.query(
      'INSERT INTO course_allocations (lecturer_id, course_id, session) VALUES ($1, $2, $3)',
      [lecturer_id, course_id, cleanSession]
    );
    res.json({ message: 'Course allocated to lecturer successfully!' });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'This course is already allocated to this lecturer for this session.' });
    }
    res.status(500).json({ error: 'Failed to allocate course' });
  }
});

// Delete Allocation
router.delete('/allocations/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM course_allocations WHERE id = $1', [req.params.id]);
    res.json({ message: 'Allocation removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove allocation' });
  }
});

// Get Audit Logs
router.get('/audit-logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.username 
      FROM audit_logs a 
      LEFT JOIN users u ON a.user_id = u.id 
      ORDER BY a.created_at DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Promote Students
router.post('/promote-students', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE students 
       SET level = level + 100 
       WHERE level < 500`
    );
    res.json({ message: `Successfully promoted ${result.rowCount} students to the next level.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to promote students' });
  }
});

// Delete User
router.delete('/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Delete Course
router.delete('/courses/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

export default router;
