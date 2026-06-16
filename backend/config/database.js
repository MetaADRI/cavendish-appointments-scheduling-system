const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL if available (common for Render/Neon), 
// otherwise fall back to individual components
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false // Enable SSL for cloud databases
});

module.exports = pool;