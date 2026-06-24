const axios = require('axios')
const prisma = require('../config/db')

// 9Proxy GB-based sticky session:
// Username format → PROXY_USERNAME-session-SESSION_ID:PROXY_PASSWORD
// SESSION_ID sabit tutulduğu sürece aynı IP dönmeye devam eder.
// API'den yeni session açmaya gerek yok; username formatıyla sticky sağlanır.

const PROXY_HOST = 'proxy.9proxy.com'
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '9000', 10)

if (!process.env.PROXY_USERNAME || !process.env.PROXY_PASSWORD) {
  console.warn('[ProxyManager] UYARI: PROXY_USERNAME veya PROXY_PASSWORD tanımlı değil. Proxy bağlantıları başarısız olacak.')
}

class ProxyManager {
  // accountId için deterministik session kimliği üretir.
  // Aynı accountId → hep aynı IP (sticky session).
  _sessionId(accountId) {
    // 9Proxy session ID'si alfanümerik ve 8 karakter olmalı
    return accountId.replace(/-/g, '').slice(0, 8)
  }

  // 9Proxy API üzerinden mevcut IP'yi sorgular (opsiyonel doğrulama için)
  async _fetchCurrentIp(proxyUser, proxyPass) {
    try {
      const proxyUrl = `http://${proxyUser}:${proxyPass}@${PROXY_HOST}:${PROXY_PORT}`
      const response = await axios.get('https://api.ipify.org?format=json', {
        proxy: false,
        httpAgent: undefined,
        // axios doğrudan SOCKS desteklemez; HTTP proxy üzerinden IP kontrol et
        headers: { 'Proxy-Authorization': `Basic ${Buffer.from(`${proxyUser}:${proxyPass}`).toString('base64')}` },
        timeout: 10000,
      })
      return response.data?.ip || null
    } catch {
      return null
    }
  }

  /**
   * Belirtilen accountId için 9Proxy sticky session bilgilerini döndürür
   * ve Account kaydını günceller.
   */
  async getProxyForAccount(accountId) {
    const sessionId = this._sessionId(accountId)
    const proxyUser = `${process.env.PROXY_USERNAME}-session-${sessionId}`
    const proxyPass = process.env.PROXY_PASSWORD

    const proxyConfig = {
      proxyHost: PROXY_HOST,
      proxyPort: PROXY_PORT,
      proxyUser,
      proxyPass,
    }

    await prisma.account.update({
      where: { id: accountId },
      data: proxyConfig,
    })

    return proxyConfig
  }

  /**
   * Proxy düştüğünde yeni bir session ID üretip hesabı günceller.
   * 9Proxy'de "yenile" = farklı session ID ile farklı IP almak demektir.
   */
  async refreshProxy(accountId) {
    // Yeni session ID için timestamp suffix ekle
    const suffix = Date.now().toString().slice(-4)
    const account = await prisma.account.findUnique({ where: { id: accountId } })
    if (!account) throw new Error(`Account bulunamadı: ${accountId}`)

    const baseId = this._sessionId(accountId)
    const newSessionId = (baseId.slice(0, 4) + suffix).slice(0, 8)
    const proxyUser = `${process.env.PROXY_USERNAME}-session-${newSessionId}`
    const proxyPass = process.env.PROXY_PASSWORD

    const proxyConfig = {
      proxyHost: PROXY_HOST,
      proxyPort: PROXY_PORT,
      proxyUser,
      proxyPass,
    }

    await prisma.account.update({
      where: { id: accountId },
      data: proxyConfig,
    })

    return proxyConfig
  }

  /**
   * Hesap kapanınca proxy alanlarını temizler.
   * (9Proxy GB-based plan'da gerçek anlamda "release" yoktur;
   *  kayıt tutmak için DB'den siliyoruz.)
   */
  async releaseProxy(accountId) {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        proxyHost: null,
        proxyPort: null,
        proxyUser: null,
        proxyPass: null,
      },
    })
  }
}

module.exports = new ProxyManager()
