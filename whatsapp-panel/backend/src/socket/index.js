const { Server } = require('socket.io')

let io = null

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
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
