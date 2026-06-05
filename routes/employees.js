const express = require('express')
const { db, rowToEmployee, logActivity, logWork, recalculateStreak } = require('../db/database')

const router = express.Router()

router.get('/', (req, res) => {
  const { department, search } = req.query
  let sql = `SELECT * FROM employees WHERE 1=1`
  const params = []

  if (department) {
    sql += ` AND department = ?`
    params.push(department)
  }
  if (search) {
    sql += ` AND (name LIKE ? OR role LIKE ? OR department LIKE ? OR email LIKE ?)`
    const q = `%${search}%`
    params.push(q, q, q, q)
  }

  sql += ` ORDER BY id ASC`
  const rows = db.prepare(sql).all(...params)
  res.json(rows.map(rowToEmployee))
})

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Employee not found' })
  res.json(rowToEmployee(row))
})

router.post('/', (req, res) => {
  const { name, role, department, email, salary, status, officeLocation, workingMode, deskNumber } = req.body
  if (!name) return res.status(400).json({ error: 'Name is required' })

  const colors = ['bg-lime-400', 'bg-fuchsia-400', 'bg-sky-400', 'bg-teal-400', 'bg-violet-400']
  const avatarColor = colors[Math.floor(Math.random() * colors.length)]
  const joined = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const attendance = status === 'On Leave' ? 'leave' : 'absent'

  const result = db.prepare(`
    INSERT INTO employees (name, role, department, email, joined, avatar_color, salary, status, attendance, office_location, working_mode, desk_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, 
    role || 'Associate', 
    department, 
    email || 'new@nexatech.com', 
    joined, 
    avatarColor, 
    salary || 6500, 
    status || 'Active', 
    attendance,
    officeLocation || 'Main Campus, Blg 3',
    workingMode || 'Hybrid',
    deskNumber || 'Desk 412'
  )

  db.prepare(`INSERT INTO recent_hires (name, role, dept, joined) VALUES (?, ?, ?, ?)`)
    .run(name, role || 'Associate', department, 'Today')

  const employee = rowToEmployee(db.prepare(`SELECT * FROM employees WHERE id = ?`).get(result.lastInsertRowid))
  const activity = logActivity({
    icon: 'fa-user-plus',
    color: 'text-emerald-400',
    text: `${name} added to ${department} • account provisioned`,
    dept: 'HR'
  })

  req.app.get('io').emit('employee:created', { employee, activity })
  req.app.get('io').emit('metrics:update', req.app.get('getMetrics')())

  res.status(201).json(employee)
})

router.put('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Employee not found' })

  const { name, role, department, email, salary, status, officeLocation, workingMode, deskNumber } = req.body
  const attendance = status === 'On Leave' ? 'leave' : existing.attendance

  db.prepare(`
    UPDATE employees SET name=?, role=?, department=?, email=?, salary=?, status=?, attendance=?, office_location=?, working_mode=?, desk_number=?
    WHERE id=?
  `).run(
    name ?? existing.name,
    role ?? existing.role,
    department ?? existing.department,
    email ?? existing.email,
    salary ?? existing.salary,
    status ?? existing.status,
    attendance,
    officeLocation ?? existing.office_location,
    workingMode ?? existing.working_mode,
    deskNumber ?? existing.desk_number,
    req.params.id
  )

  const employee = rowToEmployee(db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id))
  req.app.get('io').emit('employee:updated', { employee })
  req.app.get('io').emit('metrics:update', req.app.get('getMetrics')())
  res.json(employee)
})

router.delete('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Employee not found' })

  db.prepare(`UPDATE employees SET status = 'Inactive', attendance = 'absent' WHERE id = ?`).run(req.params.id)
  req.app.get('io').emit('employee:deleted', { id: parseInt(req.params.id) })
  req.app.get('io').emit('metrics:update', req.app.get('getMetrics')())
  res.json({ success: true })
})

router.get('/:id/contributions', (req, res) => {
  const emp = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id)
  if (!emp) return res.status(404).json({ error: 'Employee not found' })

  const today = new Date()
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(today.getDate() - 90)
  
  const getLocalDateStr = (d) => {
    const offset = d.getTimezoneOffset()
    const localDate = new Date(d.getTime() - (offset * 60 * 1000))
    return localDate.toISOString().split('T')[0]
  }
  const minDateStr = getLocalDateStr(ninetyDaysAgo)

  const rows = db.prepare(`
    SELECT date, count FROM contributions
    WHERE employee_id = ? AND date >= ?
    ORDER BY date ASC
  `).all(req.params.id, minDateStr)

  res.json({
    currentStreak: emp.current_streak || 0,
    maxStreak: emp.max_streak || 0,
    officeStreak: emp.office_streak || 0,
    maxOfficeStreak: emp.max_office_streak || 0,
    contributions: rows
  })
})

router.post('/:id/work', (req, res) => {
  const emp = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id)
  if (!emp) return res.status(404).json({ error: 'Employee not found' })
  if (emp.status !== 'Active') return res.status(400).json({ error: 'Employee is not active' })

  const contribution = logWork(req.params.id)
  const employee = rowToEmployee(db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id))
  
  const activity = logActivity({
    icon: 'fa-code-branch',
    color: 'text-emerald-400',
    text: `${emp.name} logged work • task completed / contribution recorded`,
    dept: emp.department
  })

  req.app.get('io').emit('employee:updated', { employee })
  req.app.get('io').emit('activity:new', activity)
  req.app.get('io').emit('metrics:update', req.app.get('getMetrics')())

  res.json({
    success: true,
    employee,
    contribution
  })
})

module.exports = router

