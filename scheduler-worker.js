require('dotenv').config();
const { startScheduler, getSchedulerStatus } = require('./backend/utils/scheduler');
const { initializeDatabase } = require('./initDatabase');

const PORT = process.env.PORT || process.env.SCHEDULER_PORT || 4000;

async function main() {
  console.log('=== Cavendish Scheduler Worker ===');

  try {
    await initializeDatabase();
    console.log('Database initialized');
  } catch (err) {
    console.error('Database init failed:', err);
    process.exit(1);
  }

  if (process.env.ENABLE_SLOT_TRACKER !== 'true') {
    console.log('ENABLE_SLOT_TRACKER is not true — scheduler disabled. Exiting.');
    process.exit(0);
  }

  startScheduler();

  // Health check endpoint
  const express = require('express');
  const app = express();
  app.get('/health', (req, res) => {
    res.json({
      status: 'running',
      scheduler: getSchedulerStatus(),
      uptime: process.uptime()
    });
  });

  app.listen(PORT, () => {
    console.log(`Scheduler worker health check on http://localhost:${PORT}`);
    console.log(`Scheduler interval: ${process.env.SCHEDULER_INTERVAL_SECONDS || 30}s`);
  });
}

main();
