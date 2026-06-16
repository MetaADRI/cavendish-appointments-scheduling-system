# Cavendish University Appointment System — Summary

**Version:** 1.0.0 · **License:** MIT

A web application for scheduling appointments between students and university officials at Cavendish University Zambia. Students request time with officials; officials set availability and approve or reject requests; administrators oversee users, appointments, and system health. The app uses fixed 30-minute slots (08:30–15:30), session-based login, and an optional background scheduler for reminders, presence prompts, and automatic completion.

For full setup, troubleshooting, API detail, and deployment, see [README.md](README.md).

---

## Tech stack

| Layer | Technology |
|--------|------------|
| Runtime | Node.js ≥ 18 |
| Server | Express.js |
| Database | MySQL 5.7+ (`mysql2`) |
| Auth | `express-session`, `bcrypt` |
| Frontend | HTML, CSS, vanilla JavaScript |
| UI | Bootstrap 5.3 |
| Config | `dotenv` (`.env`) |

**NPM scripts:** `npm start` (runs `server.js`), `npm run init-db` (runs `initDatabase.js`).

---

## Core behavior

- **Booking:** Student creates a request → official approves (or rejects) → optional scheduler sends a reminder 10 minutes before start → at start time, both parties can confirm presence → after 30 minutes the session is finalized as completed or missed.
- **Statuses:** `pending` → `approved` → `in_progress` → `completed`, with branches to `rejected` or `missed`.
- **Notifications:** Polled on the client (about every 20 seconds in the full README description).
- **Timezone:** Defaults to `Africa/Lusaka` (UTC+2); configurable via env.
- **Slot tracker:** Optional feature behind `ENABLE_SLOT_TRACKER`; requires migrations when enabled. Scheduler tick interval defaults to 30 seconds.

---

## Who uses it

| Role | Main actions |
|------|----------------|
| **Student** | Register (pending until admin approves), book appointments, view status, confirm presence, see public availability. |
| **Official** | Weekly availability (Sun–Sat), approve/reject, view schedule, confirm presence, notifications. |
| **Admin** | User management, all appointments, stats, force-end appointments, scheduler health. |

Seeded logins after `init-db` (change in production): admin `admin@cavendish.edu.zm` / `Admin123!`; sample official `dean@cavendish.edu.zm` / `Dean123!`.

---

## Repository layout (high level)

- `server.js` — HTTP entrypoint  
- `backend/` — `config/`, `middleware/`, `routes/`, `utils/` (including `scheduler.js`)  
- `public/` — pages (`index`, `login`, `signup`, dashboards, `availability.html`), `styles.css`, `slot-tracker.js`  
- `initDatabase.js`, `migrate_*.js` — schema and migrations  
- `migrations/`, `scripts/backup_database.js`, `backups/`  
- `.env` / `.env.example` — configuration  

---

## Environment variables (essentials)

| Variable | Purpose |
|----------|---------|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `PORT` | HTTP port (default 3000) |
| `SESSION_SECRET` | Session signing secret |
| `ENABLE_SLOT_TRACKER` | `true` / `false` — scheduler features |
| `TZ`, `SCHEDULER_TIMEZONE` | e.g. `Africa/Lusaka` |
| `SCHEDULER_INTERVAL_SECONDS`, `REMINDER_MINUTES_BEFORE`, `SESSION_DURATION_MINUTES` | Scheduler tuning |

Never commit `.env`; use a strong `SESSION_SECRET` in production.

---

## API surface (grouped)

- **Auth:** `POST /api/auth/signup`, `login`, `logout`; `GET /api/auth/me`  
- **Students:** officials list, profile, own appointments  
- **Officials:** own appointments, get/set availability  
- **Appointments:** create, status updates, presence, upcoming, notifications, admin force-end  
- **Public:** statistics, officials availability  
- **Admin:** users, user status, all appointments, scheduler status  

Exact paths and methods are listed in [README.md](README.md#-api-documentation).

---

## Database (conceptual)

- **users** — roles (`student` / `official` / `admin`), status (`pending` / `active` / `rejected`), credentials  
- **appointments** — student/official, slot, mode (virtual/physical), status, presence flags, timestamps  
- **official_availability** — per official, day of week  
- **notifications** — tied to users and appointments  
- **scheduler_state** — audit of scheduler operations (when slot tracking is used)  

---

## Quick start

1. Install Node.js (≥18) and MySQL; create database `cavendish_appointment_system`.  
2. Copy `.env.example` to `.env` and set DB and `SESSION_SECRET`.  
3. `npm install` → `npm run init-db` → `npm start`.  
4. Open `http://localhost:3000`.

Optional: run slot-tracker migrations and set `ENABLE_SLOT_TRACKER=true` (see README).

---

## Further docs in the repo

- `SLOT_TRACKER_IMPLEMENTATION.md` — scheduler implementation detail  
- `TEST_SLOT_TRACKER.md` — testing the slot tracker  
- `IMPLEMENTATION_COMPLETE.md` — feature completion notes  

---

*This file is a short overview; [README.md](README.md) remains the authoritative guide for installation, common errors, testing, deployment, and maintenance.*
