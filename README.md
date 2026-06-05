# Office EMS — Full Stack Employee Management System

NexaTech IT company HR dashboard with **real-time updates** via WebSockets.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML, Tailwind CSS, vanilla JavaScript |
| Backend | Node.js, Express |
| Database | SQLite (better-sqlite3) |
| Real-time | Socket.io |

## Quick Start

```bash
npm install
npm start
```

Open **http://localhost:3000**

## Development

```bash
npm run dev    # auto-restart on file changes
npm run seed   # re-seed database (only if empty)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | List employees |
| POST | `/api/employees` | Add employee |
| PUT | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Deactivate employee |
| GET | `/api/leaves` | List leave requests |
| POST | `/api/leaves` | Submit leave |
| PATCH | `/api/leaves/:id/approve` | Approve leave |
| GET | `/api/metrics` | Dashboard KPIs |
| GET | `/api/activities` | Live activity feed |
| GET | `/api/payroll` | Payroll summary |
| GET | `/api/report/csv` | Download workforce report |
| POST | `/api/attendance/clock-in/:id` | Clock in employee |
| POST | `/api/attendance/clock-in-all` | Bulk clock-in |

## Real-time Events (Socket.io)

- `metrics:update` — KPI changes
- `activity:new` — Live activity feed
- `employee:created` / `employee:updated` / `employee:deleted`
- `leave:created` / `leave:approved`
- `attendance:clock-in` / `attendance:clock-in-all`

## Project Structure

```
├── server.js           # Express + Socket.io entry point
├── db/
│   ├── database.js     # SQLite schema & helpers
│   └── seed.js         # IT company demo data
├── routes/
│   ├── api.js          # Route aggregator
│   ├── employees.js
│   ├── leaves.js
│   └── attendance.js
└── public/
    └── index.html      # Frontend dashboard
```
