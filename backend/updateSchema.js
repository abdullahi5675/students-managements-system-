import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function updateDb() {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255);`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS faculty VARCHAR(255);`);
    
    await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS faculty VARCHAR(255);`);
    await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS level INT DEFAULT 100;`);
    
    await pool.query(`ALTER TABLE course_allocations ADD COLUMN IF NOT EXISTS session VARCHAR(20) DEFAULT '2025/2026';`);
    
    await pool.query(`ALTER TABLE results ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS course_registrations (
        id SERIAL PRIMARY KEY,
        student_id INT REFERENCES students(id) ON DELETE CASCADE,
        course_id INT REFERENCES courses(id) ON DELETE CASCADE,
        session VARCHAR(20) NOT NULL DEFAULT '2025/2026',
        semester INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, course_id, session)
      );
    `);
    
    console.log("Database schema successfully updated!");
  } catch (err) {
    console.error("Error updating database schema:", err);
  } finally {
    pool.end();
  }
}

updateDb();
