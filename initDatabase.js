require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL;
  
  // For PostgreSQL, we usually connect directly to the database.
  // Neon provides the database name in the connection string.
  const clientConfig = connectionString ? {
    connectionString,
    ssl: { rejectUnauthorized: false }
  } : {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432
  };

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('Connected to PostgreSQL server');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        student_number VARCHAR(50) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'admin', 'official')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Ensure title column exists (from migrate_add_title.js)
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR(255)');
    console.log('Users table and title column checked');

    // Create index
    await client.query('CREATE INDEX IF NOT EXISTS idx_student_number ON users(student_number)');

    // Create appointments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        appointment_code VARCHAR(50) UNIQUE NOT NULL,
        student_id INT NOT NULL REFERENCES users(id),
        official_id INT NOT NULL REFERENCES users(id),
        purpose TEXT NOT NULL,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        mode VARCHAR(20) NOT NULL CHECK (mode IN ('Virtual', 'Physical')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_progress', 'completed', 'missed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure slot tracking columns exist (from migrate_slot_tracking.js)
    await client.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent SMALLINT DEFAULT 0');
    await client.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS student_present SMALLINT DEFAULT 0');
    await client.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS official_present SMALLINT DEFAULT 0');
    await client.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS started_at TIMESTAMP');
    await client.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP');
    await client.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS presence_note TEXT');
    console.log('Appointments table and tracking columns checked');

    // Create unique index to prevent double-booking
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS ux_official_date_time ON appointments (official_id, appointment_date, appointment_time)');
    console.log('Unique index on appointments created or already exists');

    // Create official_availability table
    await client.query(`
      CREATE TABLE IF NOT EXISTS official_availability (
        id SERIAL PRIMARY KEY,
        official_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week VARCHAR(20) NOT NULL CHECK (day_of_week IN ('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (official_id, day_of_week)
      )
    `);
    console.log('Official availability table created or already exists');

    // Create notifications table (referenced in scheduler.js)
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id),
        appointment_id INT REFERENCES appointments(id),
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_read SMALLINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Notifications table created or already exists');

    // Create scheduler_state table (referenced in scheduler.js)
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduler_state (
        id SERIAL PRIMARY KEY,
        appointment_id INT NOT NULL REFERENCES appointments(id),
        operation_type VARCHAR(50) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details TEXT
      )
    `);
    console.log('Scheduler state table created or already exists');

    // Seed admin user
    const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
    await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, status) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (email) DO UPDATE SET password_hash = $3, role = 'admin', status = 'active'`,
      ['System Admin', 'admin@cavendish.edu.zm', adminPasswordHash, 'admin', 'active']
    );
    console.log('Admin user seeded and updated (if exists)');

    // Seed official user
    const officialPasswordHash = await bcrypt.hash('Dean123!', 10);
    const officialEmail = 'dean@cavendish.edu.zm';
    
    const officialResult = await client.query(
      `INSERT INTO users (full_name, email, title, password_hash, role, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (email) DO UPDATE SET role = 'official', status = 'active'
       RETURNING id`,
      ['Precious Mate', officialEmail, 'Dean of Students', officialPasswordHash, 'official', 'active']
    );
    
    const officialId = officialResult.rows[0].id;
    console.log(`Official user seeded with ID: ${officialId}`);

    // Seed default availability for the official (Monday - Friday)
    const workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    for (const day of workingDays) {
      await client.query(
        'INSERT INTO official_availability (official_id, day_of_week) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [officialId, day]
      );
    }
    console.log('Default availability seeded for official');

    console.log('Database initialization completed successfully!');
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initializeDatabase();