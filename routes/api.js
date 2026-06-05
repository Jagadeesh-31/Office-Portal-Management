const express = require('express')
const { db, rowToActivity, getMetrics } = require('../db/database')
const employeesRouter = require('./employees')
const leavesRouter = require('./leaves')
const attendanceRouter = require('./attendance')
const authRouter = require('./auth')

const router = express.Router()

router.use('/employees', employeesRouter)
router.use('/leaves', leavesRouter)
router.use('/attendance', attendanceRouter)
router.use('/auth', authRouter)

router.get('/metrics', (req, res) => {
  res.json(getMetrics())
})

router.get('/activities', (req, res) => {
  const rows = db.prepare(`SELECT * FROM activities ORDER BY created_at DESC LIMIT 20`).all()
  res.json(rows.map(rowToActivity))
})

router.get('/recent-hires', (req, res) => {
  const rows = db.prepare(`SELECT name, role, dept, joined FROM recent_hires ORDER BY id DESC LIMIT 5`).all()
  res.json(rows.map(r => ({ name: r.name, role: r.role, dept: r.dept, joined: r.joined })))
})

router.get('/departments', (req, res) => {
  const rows = db.prepare(`
    SELECT department as dept, COUNT(*) as count
    FROM employees WHERE status != 'Inactive'
    GROUP BY department ORDER BY count DESC
  `).all()
  const total = rows.reduce((s, r) => s + r.count, 0)
  res.json(rows.map(r => ({
    dept: r.dept,
    count: r.count,
    pct: total ? Math.round((r.count / total) * 100) : 0
  })))
})

router.get('/payroll', (req, res) => {
  const rows = db.prepare(`SELECT * FROM employees WHERE status != 'Inactive'`).all()
  const payroll = rows.map(row => {
    const deduction = Math.round(row.salary * 0.15)
    const net = row.salary - deduction
    const paid = row.status === 'Active' && row.attendance !== 'leave'
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      avatarColor: row.avatar_color,
      salary: row.salary,
      deduction,
      net,
      paid
    }
  })
  const gross = payroll.reduce((s, p) => s + p.salary, 0)
  const deductions = payroll.reduce((s, p) => s + p.deduction, 0)
  res.json({ employees: payroll, gross, deductions, net: gross - deductions })
})

router.get('/report/csv', (req, res) => {
  const emps = db.prepare(`SELECT * FROM employees WHERE status != 'Inactive'`).all()
  const lines = [
    'ID,Name,Role,Department,Email,Joined,Salary,Working Mode,Office Location,Desk Number,Work Streak,Office Streak,Total Office Days',
    ...emps.map(e => `${e.id},"${e.name}","${e.role}","${e.department}",${e.email},"${e.joined}",${e.salary},"${e.working_mode}","${e.office_location}","${e.desk_number}",${e.current_streak},${e.office_streak},${e.total_office_days}`)
  ]

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename=pulse-workforce-report-${new Date().toISOString().slice(0, 10)}.csv`)
  res.send(lines.join('\n'))
})

router.get('/workforce-dynamics', (req, res) => {
  // 1. Working Mode Breakdown
  const modes = db.prepare(`
    SELECT working_mode as mode, COUNT(*) as count
    FROM employees WHERE status != 'Inactive'
    GROUP BY working_mode
  `).all()
  
  // 2. Office Streak Leaders
  const leaders = db.prepare(`
    SELECT name, department, role, office_streak as streak, max_office_streak as maxStreak, avatar_color
    FROM employees WHERE status = 'Active' AND working_mode != 'Remote'
    ORDER BY office_streak DESC, max_office_streak DESC LIMIT 5
  `).all()

  // 3. Office Presence Trend (Last 7 days)
  const presenceTrend = []
  const today = new Date()
  const activeInOfficeCount = db.prepare(`SELECT COUNT(*) as c FROM employees WHERE status = 'Active' AND working_mode != 'Remote'`).get().c
  
  const getLocalDateStr = (d) => {
    const offset = d.getTimezoneOffset()
    const localDate = new Date(d.getTime() - (offset * 60 * 1000))
    return localDate.toISOString().split('T')[0]
  }

  for (let i = 6; i >= 0; i--) {
    const tempDate = new Date()
    tempDate.setDate(today.getDate() - i)
    const dateStr = getLocalDateStr(tempDate)
    const dayName = tempDate.toLocaleDateString('en-US', { weekday: 'short' })
    
    const count = db.prepare(`SELECT COUNT(*) as c FROM office_presences WHERE date = ?`).get(dateStr).c
    presenceTrend.push({
      date: dateStr,
      day: dayName,
      count,
      rate: activeInOfficeCount ? Math.min(100, Math.round((count / activeInOfficeCount) * 100)) : 0
    })
  }

  res.json({
    modes,
    leaders,
    presenceTrend
  })
})

module.exports = router
