const express = require('express')
const { db, rowToEmployee, logActivity, logWork, logOfficePresence } = require('../db/database')

const router = express.Router()

function formatClockIn(date = new Date()) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

router.post('/clock-in/:id', (req, res) => {
  const emp = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id)
  if (!emp) return res.status(404).json({ error: 'Employee not found' })
  if (emp.status !== 'Active') return res.status(400).json({ error: 'Employee is not active' })

  const now = new Date()
  const hour = now.getHours()
  const clockIn = formatClockIn(now)
  const attendance = hour >= 9 ? 'late' : 'present'

  db.prepare(`UPDATE employees SET clock_in = ?, attendance = ? WHERE id = ?`).run(clockIn, attendance, req.params.id)
  
  // Log work contribution for today
  logWork(req.params.id)
  if (emp.working_mode !== 'Remote') {
    logOfficePresence(req.params.id)
  }

  const employee = rowToEmployee(db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id))
  const activity = logActivity({
    icon: 'fa-clock',
    color: 'text-teal-400',
    text: `${emp.name} clocked in • ${emp.department} floor`,
    dept: 'All'
  })

  req.app.get('io').emit('attendance:clock-in', { employee, activity })
  req.app.get('io').emit('metrics:update', req.app.get('getMetrics')())
  res.json(employee)
})

router.post('/clock-in-all', (req, res) => {
  const absent = db.prepare(`
    SELECT * FROM employees WHERE status = 'Active' AND clock_in IS NULL
  `).all()

  const clockIn = formatClockIn()
  const update = db.prepare(`UPDATE employees SET clock_in = ?, attendance = 'present' WHERE id = ?`)

  absent.forEach(emp => {
    update.run(clockIn, emp.id)
    logWork(emp.id)
    if (emp.working_mode !== 'Remote') {
      logOfficePresence(emp.id)
    }
  })

  const activity = logActivity({
    icon: 'fa-clock',
    color: 'text-teal-400',
    text: `Bulk clock-in completed • ${absent.length} employees marked present`,
    dept: 'HR'
  })

  req.app.get('io').emit('attendance:clock-in-all', { count: absent.length, activity })
  req.app.get('io').emit('metrics:update', req.app.get('getMetrics')())
  res.json({ count: absent.length })
})

router.get('/log', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM employees WHERE clock_in IS NOT NULL AND status = 'Active' ORDER BY clock_in ASC
  `).all()
  res.json(rows.map(rowToEmployee))
})

module.exports = router
