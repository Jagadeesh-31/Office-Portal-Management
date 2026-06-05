const express = require('express')
const http = require('http')
const path = require('path')
const cors = require('cors')
const { Server } = require('socket.io')
const { initSchema, getMetrics, logActivity, db, rowToEmployee, logOfficePresence } = require('./db/database')
const apiRouter = require('./routes/api')

const PORT = process.env.PORT || 3000
const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

initSchema()

const employeeCount = db.prepare('SELECT COUNT(*) as c FROM employees').get().c
if (employeeCount === 0) {
  require('./db/seed')
}

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.set('io', io)
app.set('getMetrics', getMetrics)

app.use('/api', apiRouter)

io.on('connection', (socket) => {
  socket.emit('metrics:update', getMetrics())
  console.log(`Client connected (${io.engine.clientsCount} online)`)
})

// Simulated IT company live events (server-side real-time)
const IT_NAMES = [
  'Alex Chen', 'Jordan Lee', 'Sam Rivera', 'Taylor Kim', 'Morgan Patel',
  'Casey Nguyen', 'Riley Okafor', 'Jamie Santos', 'Drew Walsh', 'Quinn Brooks'
]

const ACTIVITY_TEMPLATES = [
  { icon: 'fa-code-branch', color: 'text-blue-400', dept: 'Engineering',
    text: (n) => `${n} merged PR #${Math.floor(Math.random() * 900 + 100)} → staging deploy triggered` },
  { icon: 'fa-server', color: 'text-amber-400', dept: 'DevOps',
    text: () => `Production health check passed • 99.97% uptime (30d)` },
  { icon: 'fa-shield-halved', color: 'text-violet-400', dept: 'Security',
    text: () => `SOC alert resolved • VPN auth spike cleared in 4m` },
  { icon: 'fa-laptop-code', color: 'text-cyan-400', dept: 'Engineering',
    text: (n) => `${n} joined daily standup • Sprint 24 on track` },
  { icon: 'fa-money-bill-transfer', color: 'text-indigo-400', dept: 'Finance',
    text: () => `Payroll batch validated • records synced` },
  { icon: 'fa-bug', color: 'text-red-400', dept: 'QA',
    text: (n) => `${n} closed critical bug • release v2.4.1 unblocked` },
  { icon: 'fa-cloud', color: 'text-sky-400', dept: 'Cloud',
    text: () => `AWS cost report generated • 8% under budget this month` }
]

function broadcastActivity(template) {
  const name = IT_NAMES[Math.floor(Math.random() * IT_NAMES.length)]
  const activity = logActivity({
    icon: template.icon,
    color: template.color,
    text: template.text(name),
    dept: template.dept
  })
  io.emit('activity:new', activity)
}

function simulateRandomClockIn() {
  const absent = db.prepare(`
    SELECT * FROM employees WHERE status = 'Active' AND clock_in IS NULL ORDER BY RANDOM() LIMIT 1
  `).get()
  if (!absent) return

  const now = new Date()
  const clockIn = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const attendance = now.getHours() >= 9 ? 'late' : 'present'

  db.prepare(`UPDATE employees SET clock_in = ?, attendance = ? WHERE id = ?`).run(clockIn, attendance, absent.id)
  if (absent.working_mode !== 'Remote') {
    logOfficePresence(absent.id)
  }

  const employee = rowToEmployee(db.prepare(`SELECT * FROM employees WHERE id = ?`).get(absent.id))
  const activity = logActivity({
    icon: 'fa-clock',
    color: 'text-teal-400',
    text: `${absent.name} clocked in • ${absent.department} floor`,
    dept: 'All'
  })

  io.emit('attendance:clock-in', { employee, activity })
  io.emit('metrics:update', getMetrics())
}

setInterval(() => {
  const template = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)]
  broadcastActivity(template)
}, 8000)

setInterval(() => {
  if (Math.random() > 0.45) simulateRandomClockIn()
}, 10000)

server.listen(PORT, () => {
  console.log(`\n🚀 Pulse running at http://localhost:${PORT}`)
  console.log(`   API:  http://localhost:${PORT}/api/metrics`)
  console.log(`   Real-time: WebSocket via Socket.io\n`)
})
