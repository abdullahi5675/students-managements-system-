import bcrypt from 'bcrypt';
import pool from './db.js';

async function seedAdmin() {
    console.log("Seeding admin account...");
    const hash = await bcrypt.hash('admin123', 10);
    try {
        const res = await pool.query("SELECT id FROM roles WHERE name = 'Admin'");
        if (res.rows.length > 0) {
            const adminRoleId = res.rows[0].id;
            await pool.query(
                'INSERT INTO users (username, password_hash, role_id, full_name, email) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO UPDATE SET password_hash = $2',
                ['admin', hash, adminRoleId, 'System Administrator', 'admin@srms.edu']
            );
            console.log('Admin seeded successfully.');
        } else {
            console.log('Admin role not found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

seedAdmin();
