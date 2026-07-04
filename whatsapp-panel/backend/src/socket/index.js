const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET ortam değişkeni tanımlı değil')

let io = null

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('Yetkisiz'))
    try {
      socket.user = jwt.verify(token, JWT_SECRET)
      next()
    } catch {
      next(new Error('Yetkisiz'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`[Socket.io] İstemci bağlandı: ${socket.id}`)

    socket.on('disconnect', () => {
      console.log(`[Socket.io] İstemci ayrıldı: ${socket.id}`)
    })
  })

  return io
}

function getIO() {
  if (!io) throw new Error('Socket.io henüz başlatılmadı')
  return io
}

module.exports = { initSocket, getIO }
