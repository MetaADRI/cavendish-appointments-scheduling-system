const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

const pool = require('./backend/config/database');
const { initializeDatabase } = require('./initDatabase');

// Import routes
const authRoutes = require('./backend/routes/auth');
const adminRoutes = require('./backend/routes/admin');
const studentRoutes = require('./backend/routes/student');
const officialRoutes = require('./backend/routes/official');
const appointmentRoutes = require('./backend/routes/appointments');
const publicRoutes = require('./backend/routes/public');

const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = process.env.VERCEL === '1';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration with PostgreSQL store (works across serverless instances)
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'cavendish_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isVercel || process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/officials', officialRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/public', publicRoutes);

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/availability', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'availability.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin-dashboard', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

app.get('/official-dashboard', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'official') {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'official-dashboard.html'));
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Export for Vercel
module.exports = app;

// On Vercel, init DB silently on cold start (best-effort, won't crash)
if (isVercel) {
  initializeDatabase().catch(err => {
    console.error('Vercel DB init failed (will retry on next cold start):', err.message);
  });
}

// Local development server with scheduler
if (require.main === module) {
  (async () => {
    try {
      await initializeDatabase();
      console.log('Database initialized');

      if (process.env.ENABLE_SLOT_TRACKER === 'true') {
        const { startScheduler } = require('./backend/utils/scheduler');
        startScheduler();
      }
    } catch (err) {
      console.error('Startup error:', err);
    }

    app.listen(PORT, () => {
      console.log(`Cavendish Appointment System running on http://localhost:${PORT}`);
    });
  })();
}
