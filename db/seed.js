const { db, initSchema, recalculateStreak, recalculateOfficeStreak } = require('./database')

initSchema()

// Clean up database so it can re-seed cleanly
db.prepare('DELETE FROM leaves').run()
db.prepare('DELETE FROM contributions').run()
db.prepare('DELETE FROM office_presences').run()
db.prepare('DELETE FROM employees').run()
db.prepare('DELETE FROM recent_hires').run()
db.prepare('DELETE FROM activities').run()

const employees = [
  [1, 'Emma Thompson', 'Senior Software Engineer', 'Engineering', 'emma.t@nexatech.com', 'Mar 12, 2023', 'bg-blue-500', 8500, 'Active', 'present', '08:02 AM', 98, 'emma123', 0, 'New York HQ', 'Hybrid', 'Desk 412'],
  [2, 'Liam Rodriguez', 'DevOps Lead', 'Engineering', 'liam.r@nexatech.com', 'Jan 05, 2024', 'bg-pink-500', 9200, 'Active', 'late', '09:15 AM', 94, 'liam123', 0, 'Seattle HQ', 'In-Office', 'Desk 102'],
  [3, 'Priya Sharma', 'Financial Analyst', 'Finance', 'priya.s@nexatech.com', 'Nov 20, 2022', 'bg-emerald-500', 7200, 'Active', 'present', '08:45 AM', 97, 'priya123', 0, 'London Hub', 'Hybrid', 'Desk 308'],
  [4, 'James Okoro', 'UI/UX Designer', 'Design', 'james.o@nexatech.com', 'Jul 10, 2024', 'bg-purple-500', 7800, 'Active', 'present', '08:30 AM', 96, 'james123', 0, 'London Hub', 'In-Office', 'Desk 201'],
  [5, 'Sophie Laurent', 'Product Manager', 'Product', 'sophie.l@nexatech.com', 'Feb 28, 2023', 'bg-orange-500', 8800, 'Active', 'present', '08:10 AM', 99, 'sophie123', 0, 'New York HQ', 'Hybrid', 'Desk 409'],
  [6, 'Michael Chen', 'Backend Engineer', 'Engineering', 'michael.c@nexatech.com', 'Apr 15, 2024', 'bg-cyan-500', 8100, 'Active', 'absent', null, 91, 'michael123', 0, 'Remote', 'Remote', 'N/A'],
  [7, 'Rachel Green', 'Security Engineer', 'Engineering', 'rachel.g@nexatech.com', 'Sep 03, 2023', 'bg-rose-500', 9500, 'On Leave', 'leave', null, 95, 'rachel123', 0, 'Seattle HQ', 'In-Office', 'Desk 115'],
  [8, 'Thomas Reed', 'Sales Director', 'Sales', 'thomas.r@nexatech.com', 'Jun 18, 2022', 'bg-lime-500', 10200, 'Active', 'present', '07:55 AM', 93, 'thomas123', 0, 'Seattle HQ', 'In-Office', 'Desk 118'],
  [9, 'Anita Desai', 'HR Business Partner', 'HR', 'anita.d@nexatech.com', 'Aug 22, 2023', 'bg-fuchsia-500', 7400, 'Active', 'present', '08:00 AM', 100, 'anita123', 1, 'New York HQ', 'In-Office', 'Desk 401'],
  [10, 'Carlos Vega', 'Cloud Architect', 'Engineering', 'carlos.v@nexatech.com', 'Dec 01, 2023', 'bg-indigo-500', 11000, 'Active', 'present', '08:05 AM', 97, 'carlos123', 0, 'Remote', 'Remote', 'N/A']
]

const insertEmp = db.prepare(`
  INSERT INTO employees (id, name, role, department, email, joined, avatar_color, salary, status, attendance, clock_in, attendance_rate, password, is_admin, office_location, working_mode, desk_number)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

employees.forEach(e => insertEmp.run(...e))

const leaves = [
  [6, 'Michael Chen', 'MC', 'Vacation', 'Aug 15', 'Aug 22', 6, 'pending'],
  [7, 'Rachel Green', 'RG', 'Sick', 'Aug 10', 'Aug 12', 3, 'pending'],
  [8, 'Thomas Reed', 'TR', 'Personal', 'Aug 28', 'Aug 30', 2, 'approved']
]

const insertLeave = db.prepare(`
  INSERT INTO leaves (employee_id, name, avatar, type, start_date, end_date, days, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
leaves.forEach(l => insertLeave.run(...l))

const hires = [
  ['Diego Morales', 'Backend Engineer', 'Engineering', 'Aug 1'],
  ['Fatima Khan', 'Content Strategist', 'Marketing', 'Jul 29'],
  ['Henry Dubois', 'Accountant', 'Finance', 'Jul 22']
]

const insertHire = db.prepare(`INSERT INTO recent_hires (name, role, dept, joined) VALUES (?, ?, ?, ?)`)
hires.forEach(h => insertHire.run(...h))

const activities = [
  ['fa-code-branch', 'text-blue-400', 'Emma Thompson merged PR #482 → staging deploy triggered', 'Engineering'],
  ['fa-server', 'text-amber-400', 'Production health check passed • 99.97% uptime (30d)', 'DevOps'],
  ['fa-user-plus', 'text-emerald-400', 'Onboarding session started for Diego Morales • IT provisioning complete', 'HR'],
  ['fa-shield-halved', 'text-violet-400', 'SOC alert resolved • VPN auth spike cleared in 4m', 'Security']
]

const insertAct = db.prepare(`INSERT INTO activities (icon, color, text, dept) VALUES (?, ?, ?, ?)`)
activities.forEach(a => insertAct.run(...a))

// Seed 90 days of random contributions and office presences for all employees
const insertContrib = db.prepare(`
  INSERT INTO contributions (employee_id, date, count)
  VALUES (?, ?, ?)
`)

const insertPresence = db.prepare(`
  INSERT INTO office_presences (employee_id, date)
  VALUES (?, ?)
`)

const getLocalDateStr = (d) => {
  const offset = d.getTimezoneOffset()
  const localDate = new Date(d.getTime() - (offset * 60 * 1000))
  return localDate.toISOString().split('T')[0]
}

const today = new Date()

// Loop through each seeded employee
for (let id = 1; id <= 10; id++) {
  const emp = db.prepare(`SELECT working_mode FROM employees WHERE id = ?`).get(id)
  const mode = emp.working_mode

  // Let's seed history for the past 90 days
  for (let d = 0; d < 90; d++) {
    const tempDate = new Date()
    tempDate.setDate(today.getDate() - d)
    const dateStr = getLocalDateStr(tempDate)

    const dayOfWeek = tempDate.getDay() // 0 = Sunday, 6 = Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6)
    
    // Seed contributions (Work Contributions)
    const probability = isWeekend ? 0.15 : 0.82
    if (Math.random() < probability) {
      const count = Math.floor(Math.random() * 5) + 1
      insertContrib.run(id, dateStr, count)
    }

    // Seed office presence (coming to the office)
    if (!isWeekend && mode !== 'Remote') {
      const presenceProb = mode === 'In-Office' ? 0.90 : 0.50
      if (Math.random() < presenceProb) {
        insertPresence.run(id, dateStr)
        db.prepare(`UPDATE employees SET total_office_days = total_office_days + 1 WHERE id = ?`).run(id)
      }
    }
  }
  // Recalculate streaks
  recalculateStreak(id)
  recalculateOfficeStreak(id)
}

console.log('✅ Database seeded with IT company demo data, 90-day contribution history, and office presence records.')
