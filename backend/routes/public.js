const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// Get public statistics for homepage
router.get('/statistics', async (req, res) => {
  try {
    // Count active students
    const { rows: studentsResult } = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'student' AND status = 'active'"
    );
    
    // Count total appointments
    const { rows: appointmentsResult } = await pool.query(
      'SELECT COUNT(*) as count FROM appointments'
    );
    
    // Count active officials
    const { rows: officialsResult } = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'official' AND status = 'active'"
    );

    res.json({
      activeStudents: parseInt(studentsResult[0].count),
      totalAppointments: parseInt(appointmentsResult[0].count),
      activeOfficials: parseInt(officialsResult[0].count)
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all officials' availability (public)
router.get('/officials/availability', async (req, res) => {
  try {
    // Get all active officials with their availability
    const { rows: officials } = await pool.query(`
      SELECT 
        u.id, 
        u.full_name, 
        u.title, 
        u.email,
        string_agg(oa.day_of_week, ',' ORDER BY array_position(ARRAY['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], oa.day_of_week)) as available_days
      FROM users u
      LEFT JOIN official_availability oa ON u.id = oa.official_id
      WHERE u.role = 'official' AND u.status = 'active'
      GROUP BY u.id, u.full_name, u.title, u.email
      ORDER BY u.full_name ASC
    `);

    // Format the response
    const formattedOfficials = officials.map(official => ({
      id: official.id,
      full_name: official.full_name,
      title: official.title,
      email: official.email,
      available_days: official.available_days ? official.available_days.split(',') : []
    }));

    res.json({ officials: formattedOfficials });
  } catch (error) {
    console.error('Get officials availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
