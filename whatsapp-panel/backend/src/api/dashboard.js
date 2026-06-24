const { Router } = require('express')
const prisma = require('../config/db')
const sessionManager = require('../whatsapp/SessionManager')

const router = Router()

// Istanbul gece yarısını UTC olarak döndürür.
// Türkiye UTC+3 sabit (2016'dan beri DST yok).
function istanbulMidnightUTC() {
  const OFFSET_MS = 3 * 60 * 60 * 1000
  const nowUtcMs = Date.now() + OFFSET_MS          // şu an Istanbul saati (ms)
  const midnight = new Date(nowUtcMs)
  midnight.setUTCHours(0, 0, 0, 0)                 // Istanbul gece yarısı
  return new Date(midnight.getTime() - OFFSET_MS)  // UTC'ye çevir
}

// GET /api/dashboard — genel istatistikler
router.get('/', async (_req, res, next) => {
  try {
    const todayStart = istanbulMidnightUTC()
    const [
      totalAccounts,
      connectedAccounts,
      bannedAccounts,
      backupAccounts,
      totalCampaigns,
      runningCampaigns,
      todaySent,
      todayFailed,
    ] = await Promise.all([
      prisma.account.count(),
      prisma.account.count({ where: { status: 'connected' } }),
      prisma.account.count({ where: { status: 'banned' } }),
      prisma.account.count({ where: { isBackup: true } }),
      prisma.campaign.count(),
      prisma.campaign.count({ where: { status: 'running' } }),
      prisma.message.count({
        where: { status: 'sent', sentAt: { gte: todayStart } },
      }),
      prisma.message.count({
        where: { status: 'failed', createdAt: { gte: todayStart } },
      }),
    ])

    const hourlyStats = await prisma.$queryRaw`
      SELECT
        EXTRACT(HOUR FROM "sentAt" AT TIME ZONE 'Europe/Istanbul') as hour,
        COUNT(*) as count
      FROM "Message"
      WHERE "sentAt" > NOW() - INTERVAL '24 hours'
        AND status = 'sent'
      GROUP BY hour
      ORDER BY hour
    `

    res.json({
      accounts: {
        total: totalAccounts,
        connected: connectedAccounts,
        banned: bannedAccounts,
        backup: backupAccounts,
        activeSessions: sessionManager.getActiveSessions().length,
      },
      campaigns: {
        total: totalCampaigns,
        running: runningCampaigns,
      },
      today: {
        sent: todaySent,
        failed: todayFailed,
      },
      hourlyStats: hourlyStats.map(r => ({
        hour: parseInt(String(r.hour), 10),
        count: parseInt(String(r.count), 10),
      })),
    })
  } catch (err) { next(err) }
})

module.exports = router
