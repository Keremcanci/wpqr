const { Router } = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../config/db')

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'wpanel-secret-key'

// İlk çalıştırmada admin kullanıcısı yoksa oluştur
async function ensureAdminExists() {
  const count = await prisma.user.count()
  if (count === 0) {
    const hash = await bcrypt.hash('admin123', 10)
    await prisma.user.create({ data: { username: 'admin', passwordHash: hash } })
    console.log('[Auth] Varsayılan admin kullanıcısı oluşturuldu → admin / admin123')
  }
}
ensureAdminExists().catch(console.error)

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunlu' })

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' })

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, username: user.username })
})

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Yetkisiz' })

  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET)
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Tüm alanlar zorunlu' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' })

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Mevcut şifre hatalı' })

    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } })
    res.json({ success: true })
  } catch {
    res.status(401).json({ error: 'Oturum geçersiz' })
  }
})

module.exports = router
