const Database = require('better-sqlite3')
const path = require('path')
const os = require('os')

const dbPath = process.env.SQLITE_PATH || (
  process.env.VERCEL
    ? path.join(os.tmpdir(), 'pulse.db')
    : path.join(__dirname, 'pulse.db')
)
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT,
      department TEXT,
      email TEXT,
      joined TEXT,
      avatar_color TEXT DEFAULT 'bg-blue-500',
      salary INTEGER DEFAULT 6500,
      status TEXT DEFAULT 'Active',
      attendance TEXT DEFAULT 'absent',
      clock_in TEXT,
      attendance_rate INTEGER DEFAULT 95,
      current_streak INTEGER DEFAULT 0,
      max_streak INTEGER DEFAULT 0,
      password TEXT DEFAULT 'password123',
      is_admin INTEGER DEFAULT 0,
      office_location TEXT DEFAULT 'Main Campus, Blg 3',
      working_mode TEXT DEFAULT 'Hybrid',
      desk_number TEXT DEFAULT 'Desk 412',
      office_streak INTEGER DEFAULT 0,
      max_office_streak INTEGER DEFAULT 0,
      total_office_days INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      name TEXT NOT NULL,
      avatar TEXT,
      type TEXT,
      start_date TEXT,
      end_date TEXT,
      days INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      icon TEXT,
      color TEXT,
      text TEXT NOT NULL,
      dept TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recent_hires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT,
      dept TEXT,
      joined TEXT
    );

    CREATE TABLE IF NOT EXISTS contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS office_presences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(employee_id, date)
    );
  `)

  // Migrate existing tables if they don't have password or is_admin columns
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN password TEXT DEFAULT 'password123'`)
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN is_admin INTEGER DEFAULT 0`)
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN office_location TEXT DEFAULT 'Main Campus, Blg 3'`)
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN working_mode TEXT DEFAULT 'Hybrid'`)
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN desk_number TEXT DEFAULT 'Desk 412'`)
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN office_streak INTEGER DEFAULT 0`)
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN max_office_streak INTEGER DEFAULT 0`)
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN total_office_days INTEGER DEFAULT 0`)
  } catch (e) {}
}

function rowToEmployee(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    department: row.department,
    email: row.email,
    joined: row.joined,
    avatarColor: row.avatar_color,
    salary: row.salary,
    status: row.status,
    attendance: row.attendance,
    clockIn: row.clock_in,
    attendanceRate: row.attendance_rate,
    currentStreak: row.current_streak,
    maxStreak: row.max_streak,
    isAdmin: row.is_admin || 0,
    password: row.password || 'password123',
    officeLocation: row.office_location || 'Main Campus, Blg 3',
    workingMode: row.working_mode || 'Hybrid',
    deskNumber: row.desk_number || 'Desk 412',
    officeStreak: row.office_streak || 0,
    maxOfficeStreak: row.max_office_streak || 0,
    totalOfficeDays: row.total_office_days || 0
  }
}

function rowToLeave(row) {
  if (!row) return null
  return {
    id: row.id,
    employeeId: row.employee_id,
    name: row.name,
    avatar: row.avatar,
    type: row.type,
    start: row.start_date,
    end: row.end_date,
    days: row.days,
    status: row.status
  }
}

function rowToActivity(row) {
  return {
    id: row.id,
    icon: row.icon,
    color: row.color,
    text: row.text,
    dept: row.dept,
    time: new Date(row.created_at.replace(' ', 'T')).getTime(),
    created_at: row.created_at
  }
}

function getMetrics() {
  const total = db.prepare(`SELECT COUNT(*) as c FROM employees WHERE status != 'Inactive'`).get().c
  const onLeave = db.prepare(`SELECT COUNT(*) as c FROM employees WHERE status = 'On Leave' OR attendance = 'leave'`).get().c
  const clockedIn = db.prepare(`SELECT COUNT(*) as c FROM employees WHERE clock_in IS NOT NULL AND status = 'Active'`).get().c
  const present = db.prepare(`SELECT COUNT(*) as c FROM employees WHERE attendance IN ('present','late') AND status = 'Active'`).get().c
  const avgRow = db.prepare(`SELECT AVG(salary) as avg FROM employees WHERE status != 'Inactive'`).get()
  const pendingLeaves = db.prepare(`SELECT COUNT(*) as c FROM leaves WHERE status = 'pending'`).get().c

  const orgTotal = 248
  const presentToday = Math.max(present, clockedIn) + (orgTotal - total)

  return {
    totalEmployees: orgTotal,
    presentToday: Math.min(presentToday, orgTotal - onLeave),
    onLeave: Math.max(onLeave, pendingLeaves),
    clockedIn,
    avgSalary: Math.round(avgRow.avg || 6400),
    vacationLeaves: db.prepare(`SELECT COUNT(*) as c FROM leaves WHERE type = 'Vacation' AND status = 'pending'`).get().c,
    sickLeaves: db.prepare(`SELECT COUNT(*) as c FROM leaves WHERE type = 'Sick' AND status = 'pending'`).get().c
  }
}

function logActivity({ icon, color, text, dept }) {
  const stmt = db.prepare(`INSERT INTO activities (icon, color, text, dept) VALUES (?, ?, ?, ?)`)
  const result = stmt.run(icon, color, text, dept)
  return rowToActivity(db.prepare(`SELECT * FROM activities WHERE id = ?`).get(result.lastInsertRowid))
}

function recalculateStreak(employeeId) {
  const rows = db.prepare(`
    SELECT DISTINCT date FROM contributions 
    WHERE employee_id = ? AND count > 0 
    ORDER BY date DESC
  `).all(employeeId)

  if (rows.length === 0) {
    db.prepare(`UPDATE employees SET current_streak = 0, max_streak = 0 WHERE id = ?`).run(employeeId)
    return
  }

  // Get local date YYYY-MM-DD
  const getLocalDateStr = (d) => {
    const offset = d.getTimezoneOffset()
    const localDate = new Date(d.getTime() - (offset * 60 * 1000))
    return localDate.toISOString().split('T')[0]
  }

  const todayStr = getLocalDateStr(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = getLocalDateStr(yesterday)

  const dates = rows.map(r => r.date)
  
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    db.prepare(`UPDATE employees SET current_streak = 0 WHERE id = ?`).run(employeeId)
    return
  }

  let currentStreak = 1
  let prevDate = new Date(dates[0].replace(/-/g, '/'))

  for (let i = 1; i < dates.length; i++) {
    const currDate = new Date(dates[i].replace(/-/g, '/'))
    const diffTime = Math.abs(prevDate - currDate)
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      currentStreak++
      prevDate = currDate
    } else if (diffDays === 0) {
      continue
    } else {
      break
    }
  }

  const emp = db.prepare(`SELECT max_streak FROM employees WHERE id = ?`).get(employeeId)
  const maxStreak = Math.max(emp.max_streak || 0, currentStreak)

  db.prepare(`
    UPDATE employees 
    SET current_streak = ?, max_streak = ? 
    WHERE id = ?
  `).run(currentStreak, maxStreak, employeeId)
}

function logWork(employeeId, dateStr = null) {
  if (!dateStr) {
    const d = new Date()
    const offset = d.getTimezoneOffset()
    const localDate = new Date(d.getTime() - (offset * 60 * 1000))
    dateStr = localDate.toISOString().split('T')[0]
  }

  db.prepare(`
    INSERT INTO contributions (employee_id, date, count)
    VALUES (?, ?, 1)
    ON CONFLICT(employee_id, date) DO UPDATE SET count = count + 1
  `).run(employeeId, dateStr)

  recalculateStreak(employeeId)

  return db.prepare(`SELECT * FROM contributions WHERE employee_id = ? AND date = ?`).get(employeeId, dateStr)
}

function recalculateOfficeStreak(employeeId) {
  const rows = db.prepare(`
    SELECT DISTINCT date FROM office_presences 
    WHERE employee_id = ?
    ORDER BY date DESC
  `).all(employeeId)

  if (rows.length === 0) {
    db.prepare(`UPDATE employees SET office_streak = 0, max_office_streak = 0 WHERE id = ?`).run(employeeId)
    return
  }

  const getLocalDateStr = (d) => {
    const offset = d.getTimezoneOffset()
    const localDate = new Date(d.getTime() - (offset * 60 * 1000))
    return localDate.toISOString().split('T')[0]
  }

  const todayStr = getLocalDateStr(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = getLocalDateStr(yesterday)

  const dates = rows.map(r => r.date)
  
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    db.prepare(`UPDATE employees SET office_streak = 0 WHERE id = ?`).run(employeeId)
    return
  }

  let officeStreak = 1
  let prevDate = new Date(dates[0].replace(/-/g, '/'))

  for (let i = 1; i < dates.length; i++) {
    const currDate = new Date(dates[i].replace(/-/g, '/'))
    const diffTime = Math.abs(prevDate - currDate)
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      officeStreak++
      prevDate = currDate
    } else if (diffDays === 0) {
      continue
    } else {
      break
    }
  }

  const emp = db.prepare(`SELECT max_office_streak FROM employees WHERE id = ?`).get(employeeId)
  const maxOfficeStreak = Math.max(emp.max_office_streak || 0, officeStreak)

  db.prepare(`
    UPDATE employees 
    SET office_streak = ?, max_office_streak = ? 
    WHERE id = ?
  `).run(officeStreak, maxOfficeStreak, employeeId)
}

function logOfficePresence(employeeId, dateStr = null) {
  if (!dateStr) {
    const d = new Date()
    const offset = d.getTimezoneOffset()
    const localDate = new Date(d.getTime() - (offset * 60 * 1000))
    dateStr = localDate.toISOString().split('T')[0]
  }

  try {
    db.prepare(`
      INSERT INTO office_presences (employee_id, date)
      VALUES (?, ?)
    `).run(employeeId, dateStr)
    
    db.prepare(`
      UPDATE employees 
      SET total_office_days = total_office_days + 1 
      WHERE id = ?
    `).run(employeeId)
  } catch (e) {
    // Already logged for today, ignore
  }

  recalculateOfficeStreak(employeeId)
}

module.exports = {
  db,
  initSchema,
  rowToEmployee,
  rowToLeave,
  rowToActivity,
  getMetrics,
  logActivity,
  logWork,
  recalculateStreak,
  recalculateOfficeStreak,
  logOfficePresence
}
