const path = require('path')
const fs = require('fs')
const qrcode = require('qrcode')
const pino = require('pino')
const prisma = require('../config/db')
const proxyManager = require('./ProxyManager')

const SESSION_DIR = path.resolve(process.env.SESSION_DIR || './sessions')

// Baileys ESM — dynamic import zorunlu
let _baileys = null
async function getBaileys() {
  if (!_baileys) {
    _baileys = await import('@whiskeysockets/baileys')
  }
  return _baileys
}

class SessionManager {
  constructor() {
    this.sessions = new Map()       // accountId → socket
    this.io = null                  // Socket.io — setIO() ile enjekte edilir
    this.reconnectTimers = new Map() // accountId → setTimeout handle
  }

  setIO(io) {
    this.io = io
  }

  // DB'deki tüm aktif (ban yememiş, yedek olmayan) hesapları başlatır
  async initialize() {
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true })

    const accounts = await prisma.account.findMany({
      where: { status: { not: 'banned' }, isBackup: false },
    })

    for (const account of accounts) {
      await this.startSession(account).catch(err =>
        console.error(`[SessionManager] ${account.phone} başlatılamadı:`, err.message)
      )
    }
  }

  async startSession(account) {
    const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore } = await getBaileys()

    let agent = undefined
    if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      const { SocksProxyAgent } = await import('socks-proxy-agent')
      const proxy = await proxyManager.getProxyForAccount(account.id)
      agent = new SocksProxyAgent(
        `socks5://${proxy.proxyUser}:${proxy.proxyPass}@${proxy.proxyHost}:${proxy.proxyPort}`
      )
    } else {
      console.warn(`[SessionManager] Proxy yok, direkt bağlanıyor → ${account.phone}`)
    }

    const sessionDir = path.join(SESSION_DIR, account.id)
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

    const logger = pino({ level: 'silent' })

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      agent,
      printQRInTerminal: false,
      logger,
      browser: ['WhatsApp Panel', 'Chrome', '120.0.0'],
      // Gecikme — insan gibi görünsün
      getMessage: async () => ({ conversation: '' }),
    })

    this.sessions.set(account.id, sock)

    sock.ev.on('creds.update', async () => {
      await saveCreds()
      // Oturum dosyasını DB'ye de yedekle
      const credsFile = path.join(sessionDir, 'creds.json')
      if (fs.existsSync(credsFile)) {
        const sessionData = fs.readFileSync(credsFile, 'utf-8')
        await prisma.account.update({
          where: { id: account.id },
          data: { sessionData },
        })
      }
    })

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        const qrBase64 = await qrcode.toDataURL(qr)
        await prisma.account.update({
          where: { id: account.id },
          data: { status: 'qr_pending' },
        })
        this.io?.emit('account:qr', { accountId: account.id, qr: qrBase64 })
        console.log(`[SessionManager] QR hazır → ${account.phone}`)
      }

      if (connection === 'open') {
        console.log(`[SessionManager] Bağlandı → ${account.phone}`)
        await prisma.account.update({
          where: { id: account.id },
          data: { status: 'connected' },
        })
        this.io?.emit('account:status', { accountId: account.id, status: 'connected' })
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode
        const isBanned = statusCode === DisconnectReason.loggedOut   // 401
        const reason = isBanned ? 'banned' : 'network'
        console.log(`[SessionManager] Bağlantı kesildi → ${account.phone} (${reason}, code: ${statusCode})`)
        await this._handleDisconnect(account.id, reason)
      }
    })
  }

  async _handleDisconnect(accountId, reason) {
    // Önceki reconnect timer'ı iptal et
    if (this.reconnectTimers.has(accountId)) {
      clearTimeout(this.reconnectTimers.get(accountId))
      this.reconnectTimers.delete(accountId)
    }
    this.sessions.delete(accountId)

    if (reason === 'banned') {
      await this._markAsBanned(accountId)
      await this.activateBackup()
    } else {
      // Network hatası: 30 sn sonra yeniden bağlan
      const timer = setTimeout(async () => {
        this.reconnectTimers.delete(accountId)
        const account = await prisma.account.findUnique({ where: { id: accountId } })
        if (account && account.status !== 'banned') {
          console.log(`[SessionManager] Yeniden bağlanıyor → ${account.phone}`)
          await this.startSession(account).catch(err =>
            console.error(`[SessionManager] Reconnect hatası:`, err.message)
          )
        }
      }, 30_000)
      this.reconnectTimers.set(accountId, timer)

      // Hesap silinmiş olabilir (test/manuel silme) — güvenli güncelle
      await prisma.account.updateMany({
        where: { id: accountId },
        data: { status: 'disconnected' },
      })
      this.io?.emit('account:status', { accountId, status: 'disconnected' })
    }
  }

  async _markAsBanned(accountId) {
    await prisma.account.update({
      where: { id: accountId },
      data: { status: 'banned' },
    })
    this.io?.emit('account:status', { accountId, status: 'banned' })
    console.log(`[SessionManager] Hesap ban yedi → ${accountId}`)
  }

  async activateBackup() {
    const backup = await prisma.account.findFirst({
      where: { isBackup: true, status: { not: 'banned' } },
    })

    if (!backup) {
      console.warn('[SessionManager] Kullanılabilir yedek hesap bulunamadı!')
      this.io?.emit('account:backup_activated', { success: false, message: 'Yedek hesap yok' })
      return
    }

    const activated = await prisma.account.update({
      where: { id: backup.id },
      data: { isBackup: false },
    })

    console.log(`[SessionManager] Yedek devreye alındı → ${activated.phone}`)
    this.io?.emit('account:backup_activated', { success: true, accountId: activated.id, phone: activated.phone })

    await this.startSession(activated).catch(err =>
      console.error(`[SessionManager] Yedek başlatma hatası:`, err.message)
    )
  }

  async sendMessage(accountId, toPhone, message, imageUrl = null) {
    const sock = this.sessions.get(accountId)
    if (!sock) throw new Error(`Aktif oturum yok: ${accountId}`)

    const jid = toPhone.replace(/\D/g, '') + '@s.whatsapp.net'

    let result
    if (imageUrl) {
      const axios = require('axios')
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' })
      const buffer = Buffer.from(response.data)
      result = await sock.sendMessage(jid, {
        image: buffer,
        caption: message,
      })
    } else {
      result = await sock.sendMessage(jid, { text: message })
    }

    await prisma.account.update({
      where: { id: accountId },
      data: { lastSentAt: new Date() },
    })

    return result
  }

  getSession(accountId) {
    return this.sessions.get(accountId) || null
  }

  getActiveSessions() {
    return [...this.sessions.keys()]
  }

  removeSession(accountId) {
    this.sessions.delete(accountId)
  }

  async closeAll() {
    for (const [id, sock] of this.sessions) {
      try { await sock.end() } catch {}
    }
    this.sessions.clear()
  }
}

module.exports = new SessionManager()
