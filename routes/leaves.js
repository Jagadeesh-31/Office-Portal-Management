const express = require('express')
const { db, rowToLeave, logActivity } = require('../db/database')

const router = express.Router()

router.get('/', (req, res) => {
  const { status, employeeId } = req.query
  let sql = `SELECT * FROM leaves WHERE 1=1`
  const params = []
  if (status) {
    sql += ` AND status = ?`
    params.push(status)
  }
  if (employeeId) {
    sql += ` AND employee_id = ?`
    params.push(employeeId)
  }
  sql += ` ORDER BY created_at DESC`
  res.json(db.prepare(sql).all(...params).map(rowToLeave))
})

router.post('/', (req, res) => {
  const { name, avatar, type, start, end, days, employeeId } = req.body

  const result = db.prepare(`
    INSERT INTO leaves (employee_id, name, avatar, type, start_date, end_date, days, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(employeeId || null, name, avatar, type, start, end, days || 1)

  const leave = rowToLeave(db.prepare(`SELECT * FROM leaves WHERE id = ?`).get(result.lastInsertRowid))
  const activity = logActivity({
    icon: 'fa-plane-departure',
    color: 'text-rose-400',
    text: `${name} submitted leave request • pending HR review`,
    dept: 'HR'
  })

  req.app.get('io').emit('leave:created', { leave, activity })
  req.app.get('io').emit('metrics:update', req.app.get('getMetrics')())
  res.status(201).json(leave)
})

router.patch('/:id/approve', (req, res) => {
  const existing = db.prepare(`SELECT * FROM leaves WHERE id = ?`).get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Leave not found' })

  db.prepare(`UPDATE leaves SET status = 'approved' WHERE id = ?`).run(req.params.id)
  if (existing.employee_id) {
    db.prepare(`UPDATE employees SET status = 'On Leave', attendance = 'leave' WHERE id = ?`).run(existing.employee_id)
  }

  const leave = rowToLeave(db.prepare(`SELECT * FROM leaves WHERE id = ?`).get(req.params.id))
  const activity = logActivity({
    icon: 'fa-check',
    color: 'text-emerald-400',
    text: `Leave approved for ${existing.name} • calendar updated`,
    dept: 'HR'
  })

  req.app.get('io').emit('leave:approved', { leave, activity })
  req.app.get('io').emit('metrics:update', req.app.get('getMetrics')())
  res.json(leave)
})

router.delete('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM leaves WHERE id = ?`).get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Leave not found' })

  db.prepare(`DELETE FROM leaves WHERE id = ?`).run(req.params.id)
  req.app.get('io').emit('leave:deleted', { id: parseInt(req.params.id) })
  req.app.get('io').emit('metrics:update', req.app.get('getMetrics')())
  res.json({ success: true })
})

module.exports = router
