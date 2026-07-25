import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
    console.log("Connecting to PostgreSQL to create the database...");
    
    // Connect to the default 'postgres' database to create our new database
    const initialClient = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: 'postgres', // Connect to default db first
        password: process.env.DB_PASSWORD || 'Abdullahi20@',
        port: process.env.DB_PORT || 5432,
    });

    try {
        await initialClient.connect();
        
        // Check if database exists
        const res = await initialClient.query("SELECT datname FROM pg_database WHERE datname = 'srms_db'");
        if (res.rowCount === 0) {
            await initialClient.query('CREATE DATABASE srms_db');
            console.log("✅ Database 'srms_db' created successfully.");
        } else {
            console.log("ℹ️ Database 'srms_db' already exists.");
        }
    } catch (err) {
        console.error("❌ Error creating database:", err.message);
        return; // stop execution if we can't create the db
    } finally {
        await initialClient.end();
    }

    console.log("\nConnecting to 'srms_db' to create tables...");

    // Now connect to the newly created 'srms_db'
    const dbClient = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: 'srms_db',
        password: process.env.DB_PASSWORD || 'Abdullahi20@',
        port: process.env.DB_PORT || 5432,
    });

    try {
        await dbClient.connect();
        
        // Read the init.sql file
        const sqlFilePath = path.join(__dirname, '..', 'database', 'init.sql');
        const sqlQuery = fs.readFileSync(sqlFilePath, 'utf8');
        
        // Execute the SQL to create tables and insert default roles
        await dbClient.query(sqlQuery);
        console.log("✅ Tables created and roles populated successfully.");
        console.log("\n🎉 Database setup is 100% complete! You can now start the server with 'npm start'.");
        
    } catch (err) {
        console.error("❌ Error creating tables:", err.message);
    } finally {
        await dbClient.end();
    }
}

setupDatabase();
