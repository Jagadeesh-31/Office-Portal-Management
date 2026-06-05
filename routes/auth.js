const express = require('express')
const { db, rowToEmployee } = require('../db/database')

const router = express.Router()

router.post('/login', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const row = db.prepare('SELECT * FROM employees WHERE email = ?').get(email)
  if (!row) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const employee = rowToEmployee(row)
  if (employee.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  if (employee.status === 'Inactive') {
    return res.status(403).json({ error: 'Your account has been deactivated' })
  }

  // Exclude password from response for basic security
  const { password: _, ...userWithoutPassword } = employee

  res.json({
    success: true,
    user: userWithoutPassword
  })
})

router.post('/logout', (req, res) => {
  res.json({ success: true })
})

router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization']
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const email = authHeader.replace('Bearer ', '').trim()
  const row = db.prepare('SELECT * FROM employees WHERE email = ?').get(email)
  if (!row) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const employee = rowToEmployee(row)
  const { password: _, ...userWithoutPassword } = employee
  res.json(userWithoutPassword)
})

module.exports = router
