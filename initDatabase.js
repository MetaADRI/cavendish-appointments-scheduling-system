require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL;

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
        title VARCHAR(255),
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'admin', 'official')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ users table');

    await client.query('CREATE INDEX IF NOT EXISTS idx_student_number ON users(student_number)');

    // Create appointments table with ALL required columns
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
        status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_progress', 'completed', 'missed')),
        reminder_sent SMALLINT DEFAULT 0,
        student_present SMALLINT DEFAULT 0,
        official_present SMALLINT DEFAULT 0,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        presence_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ appointments table (with slot tracking columns)');

    // Create unique constraint to prevent double-booking
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_official_date_time
      ON appointments (official_id, appointment_date, appointment_time)
    `);
    console.log('✓ double-booking unique index');

    // Create official_availability table
    await client.query(`
      CREATE TABLE IF NOT EXISTS official_availability (
        id SERIAL PRIMARY KEY,
        official_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week VARCHAR(15) NOT NULL CHECK (day_of_week IN ('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (official_id, day_of_week)
      )
    `);
    console.log('✓ official_availability table');

    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        appointment_id INT REFERENCES appointments(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_read SMALLINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ notifications table');

    // Create scheduler_state table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduler_state (
        id SERIAL PRIMARY KEY,
        appointment_id INT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        operation_type VARCHAR(50) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details TEXT
      )
    `);
    console.log('✓ scheduler_state table');

    // Seed default admin
    const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
    await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      ['System Admin', 'admin@cavendish.edu.zm', adminPasswordHash, 'admin', 'active']
    );
    console.log('✓ admin user seeded');

    // Seed default official
    const officialPasswordHash = await bcrypt.hash('Dean123!', 10);
    await client.query(
      `INSERT INTO users (full_name, email, title, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      ['Precious Mate', 'dean@cavendish.edu.zm', 'Dean of Students', officialPasswordHash, 'official', 'active']
    );
    console.log('✓ official user seeded');

    // Seed default availability for the default official
    const { rows: officialRows } = await client.query(
      "SELECT id FROM users WHERE email = 'dean@cavendish.edu.zm'"
    );
    if (officialRows.length > 0) {
      const officialId = officialRows[0].id;
      const defaultDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      for (const day of defaultDays) {
        await client.query(
          `INSERT INTO official_availability (official_id, day_of_week)
           VALUES ($1, $2)
           ON CONFLICT (official_id, day_of_week) DO NOTHING`,
          [officialId, day]
        );
      }
      console.log('✓ default availability seeded for Dean');
    }

    console.log('Database initialization completed successfully!');

  } catch (error) {
    console.error('Database initialization failed:', error.message);
  } finally {
    await client.end();
  }
}

// Only run directly (not when imported as module)
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initializeDatabase };
