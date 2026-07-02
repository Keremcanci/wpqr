const { Router } = require('express')
const prisma = require('../config/db')
const sessionManager = require('../whatsapp/SessionManager')
const proxyManager = require('../whatsapp/ProxyManager')

const router = Router()

// GET /api/accounts — tüm hesapları listele
router.get('/', async (_req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, phone: true, label: true, status: true,
        isBackup: true, dailySent: true, dailyLimit: true,
        lastSentAt: true, createdAt: true,
        proxyHost: true, proxyPort: true,
      },
    })
    res.json(accounts)
  } catch (err) { next(err) }
})

// POST /api/accounts — yeni hesap ekle
router.post('/', async (req, res, next) => {
  try {
    const { phone, label, isBackup = false, dailyLimit = 200 } = req.body
    if (!phone) return res.status(400).json({ error: 'phone zorunlu' })

    if (!isBackup) {
      const activeCount = await prisma.account.count({
        where: { isBackup: false, status: { not: 'banned' } },
      })
      if (activeCount >= 10) {
        return res.status(400).json({ error: 'Maksimum 10 aktif hesap ekleyebilirsiniz' })
      }
    }

    const account = await prisma.account.create({
      data: { phone, label, isBackup, dailyLimit },
    })

    // Yedek değilse hemen session başlat
    if (!isBackup) {
      sessionManager.startSession(account).catch(err =>
        console.error('[API] Session başlatma hatası:', err.message)
      )
    }

    res.status(201).json(account)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Bu telefon numarası zaten kayıtlı' })
    next(err)
  }
})

// DELETE /api/accounts/:id — hesabı sil
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const sock = sessionManager.getSession(id)
    if (sock) {
      await sock.logout().catch(() => {})
      sessionManager.removeSession(id)
    }
    await proxyManager.releaseProxy(id).catch(() => {})
    // Önce bağlı mesajları sil, sonra hesabı sil (schema'da cascade yok)
    await prisma.message.deleteMany({ where: { accountId: id } })
    await prisma.account.delete({ where: { id } })
    res.json({ success: true })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Hesap bulunamadı' })
    next(err)
  }
})

// GET /api/accounts/:id/qr — QR kod getir
router.get('/:id/qr', async (req, res, next) => {
  try {
    const account = await prisma.account.findUnique({ where: { id: req.params.id } })
    if (!account) return res.status(404).json({ error: 'Hesap bulunamadı' })
    if (account.status !== 'qr_pending') {
      return res.status(409).json({ error: 'QR şu an mevcut değil', status: account.status })
    }
    // QR Socket.io üzerinden iletilir; bu endpoint durum bilgisi döner
    res.json({ status: account.status, message: 'QR Socket.io account:qr eventi ile iletildi' })
  } catch (err) { next(err) }
})

// POST /api/accounts/:id/reconnect — bağlantıyı yenile
router.post('/:id/reconnect', async (req, res, next) => {
  try {
    const account = await prisma.account.findUnique({ where: { id: req.params.id } })
    if (!account) return res.status(404).json({ error: 'Hesap bulunamadı' })

    const existing = sessionManager.getSession(account.id)
    if (existing) {
      await existing.logout().catch(() => {})
      sessionManager.sessions.delete(account.id)
    }

    await sessionManager.startSession(account)
    res.json({ success: true, message: 'Yeniden bağlanma başlatıldı' })
  } catch (err) { next(err) }
})

module.exports = router
