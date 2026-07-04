const { Router } = require('express')
const prisma = require('../config/db')

const router = Router()

const ALLOWED_KEYS = ['PROXY_API_KEY', 'PROXY_USERNAME', 'PROXY_PASSWORD', 'PROXY_PORT']

// GET /api/settings
router.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: ALLOWED_KEYS } } })
    const settings = {}
    for (const key of ALLOWED_KEYS) {
      const row = rows.find(r => r.key === key)
      settings[key] = row ? row.value : ''
    }
    // Şifre ve API key maskele
    if (settings.PROXY_PASSWORD) settings.PROXY_PASSWORD = '••••••••'
    if (settings.PROXY_API_KEY) settings.PROXY_API_KEY = '••••••••'
    res.json(settings)
  } catch (err) { next(err) }
})

// POST /api/settings
router.post('/', async (req, res, next) => {
  try {
    const updates = []
    for (const key of ALLOWED_KEYS) {
      if (req.body[key] === undefined) continue
      // Maskelenmiş değer geldiyse güncelleme
      if (req.body[key] === '••••••••') continue
      updates.push(
        prisma.setting.upsert({
          where: { key },
          update: { value: req.body[key] },
          create: { key, value: req.body[key] },
        })
      )
    }
    await Promise.all(updates)
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
