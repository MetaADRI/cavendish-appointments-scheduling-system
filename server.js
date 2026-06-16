const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./backend/routes/auth');
const adminRoutes = require('./backend/routes/admin');
const studentRoutes = require('./backend/routes/student');
const officialRoutes = require('./backend/routes/official');
const appointmentRoutes = require('./backend/routes/appointments');
const publicRoutes = require('./backend/routes/public');

// Import scheduler
const { startScheduler, getSchedulerStatus } = require('./backend/utils/scheduler');

// Import database initializer
const { initializeDatabase } = require('./initDatabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'cavendish_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
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

// Scheduler health check endpoint (admin only)
app.get('/api/admin/scheduler-status', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  res.json(getSchedulerStatus());
});

// Start scheduler (behind feature flag)
startScheduler();

// Export for Vercel
module.exports = app;

// Start server if not running as a module (e.g., Vercel/Tests)
if (require.main === module) {
  // Run database initialization before starting server
  initializeDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Cavendish Appointment System running on http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error('CRITICAL: Failed to initialize database on startup:', err);
      // Still start the server so it can report errors
      app.listen(PORT, () => {
        console.log(`Server started with DATABASE ERRORS on http://localhost:${PORT}`);
      });
    });
}