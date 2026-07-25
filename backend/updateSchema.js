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
    
    await pool.query(`ALTER TABLE results ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`);
    
    console.log("Database schema successfully updated for Phase 4!");
  } catch (err) {
    console.error("Error updating database schema:", err);
  } finally {
    pool.end();
  }
}

updateDb();
