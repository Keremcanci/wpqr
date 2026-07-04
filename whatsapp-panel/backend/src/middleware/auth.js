const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'wpanel-secret-key'

module.exports = function authMiddleware(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Yetkisiz' })
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Oturum süresi doldu' })
  }
}
