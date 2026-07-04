require('dotenv').config()
const http = require('http')
const express = require('express')
const cors = require('cors')
const cron = require('node-cron')
const { initSocket } = require('./socket')
const sessionManager = require('./whatsapp/SessionManager')
const accountsRouter = require('./api/accounts')
const templatesRouter = require('./api/templates')
const campaignsRouter = require('./api/campaigns')
const dashboardRouter = require('./api/dashboard')
const uploadRouter = require('./api/upload')
const settingsRouter = require('./api/settings')
const authRouter = require('./api/auth')
const authMiddleware = require('./middleware/auth')
const { startWorker } = require('./queue/MessageWorker')
const prisma = require('./config/db')

const path = require('path')
const fs = require('fs')

const app = express()
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())

// ── Statik dosyalar (görseller) ───────────────────────────────────────────────
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || './uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })
app.use('/uploads', express.static(UPLOADS_DIR))

// ── Cron: dailySent her gece 00:00'da sıfırla ────────────────────────────────
cron.schedule('0 0 * * *', async () => {
  await prisma.account.updateMany({ data: { dailySent: 0 } })
  console.log('[Cron] dailySent sıfırlandı')
}, { timezone: 'Europe/Istanbul' })

// ── Sağlık kontrolü ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', activeSessions: sessionManager.getActiveSessions().length })
})

// ── API Router'ları ───────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/accounts', authMiddleware, accountsRouter)
app.use('/api/templates', authMiddleware, templatesRouter)
app.use('/api/campaigns', authMiddleware, campaignsRouter)
app.use('/api/dashboard', authMiddleware, dashboardRouter)
app.use('/api/upload', authMiddleware, uploadRouter)
app.use('/api/settings', authMiddleware, settingsRouter)

// ── Global hata yöneticisi ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[App] Hata:', err.message)
  res.status(500).json({ error: err.message })
})

// ── HTTP sunucusu + Socket.io ─────────────────────────────────────────────────
const server = http.createServer(app)
const io = initSocket(server)

// SessionManager'a Socket.io instance'ını ver
sessionManager.setIO(io)

// ── Sunucuyu başlat ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

server.listen(PORT, async () => {
  console.log(`[App] Sunucu çalışıyor → http://localhost:${PORT}`)

  // DB'deki aktif hesapları başlat
  await sessionManager.initialize().catch(err => {
    console.error('[App] SessionManager başlatma hatası:', err.message)
  })

  startWorker()
})

async function shutdown() {
  console.log('[Shutdown] Baileys sessionları kapatılıyor...')
  await sessionManager.closeAll()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

module.exports = { app, server, io }
