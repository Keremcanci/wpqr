const axios = require('axios')
const prisma = require('../config/db')
const { encrypt, decrypt } = require('../utils/crypto')

const ENCRYPTED_SETTING_KEYS = new Set(['PROXY_PASSWORD', 'PROXY_API_KEY'])
// DataImpulse'ta session ayrımı kullanıcı adıyla değil PORT numarasıyla yapılır:
// aynı login:password, farklı port = farklı sticky IP. Havuzu maksimum hesap
// sayısının (10) çok üzerinde tutuyoruz ki port aralığı asla tükenmesin.
const PORT_POOL_SIZE = 100

async function getSetting(key) {
  const row = await prisma.setting.findUnique({ where: { key } })
  if (!row) return process.env[key] || ''
  return ENCRYPTED_SETTING_KEYS.has(key) ? decrypt(row.value) : row.value
}

class ProxyManager {
  // Havuzdaki, başka hiçbir hesabın kullanmadığı en küçük portu döndürür.
  async _pickFreePort(accountId, basePort, excludePort = null) {
    const others = await prisma.account.findMany({
      where: { id: { not: accountId }, proxyPort: { not: null } },
      select: { proxyPort: true },
    })
    const used = new Set(others.map(a => a.proxyPort))
    if (excludePort) used.add(excludePort)
    for (let offset = 0; offset < PORT_POOL_SIZE; offset++) {
      const port = basePort + offset
      if (!used.has(port)) return port
    }
    throw new Error('Kullanılabilir proxy portu kalmadı (havuz dolu)')
  }

  // 9Proxy API üzerinden mevcut IP'yi sorgular (opsiyonel doğrulama için)
  async _fetchCurrentIp(proxyUser, proxyPass, proxyHost, proxyPort) {
    try {
      const proxyUrl = `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`
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
   * Belirtilen accountId için sticky proxy bilgilerini döndürür ve Account
   * kaydını günceller. Hesabın daha önce atanmış bir portu varsa (sticky)
   * onu korur; yoksa havuzdan boş bir port seçer.
   */
  async getProxyForAccount(accountId) {
    const proxyHost = await getSetting('PROXY_HOST')
    const proxyUsername = await getSetting('PROXY_USERNAME')
    const proxyPassword = await getSetting('PROXY_PASSWORD')
    const basePort = parseInt(await getSetting('PROXY_PORT') || '10000', 10)

    const existing = await prisma.account.findUnique({ where: { id: accountId }, select: { proxyPort: true } })
    const hasStickyPort = existing?.proxyPort != null &&
      existing.proxyPort >= basePort && existing.proxyPort < basePort + PORT_POOL_SIZE
    const proxyPort = hasStickyPort ? existing.proxyPort : await this._pickFreePort(accountId, basePort)

    const proxyUser = proxyUsername
    const proxyPass = proxyPassword

    const proxyConfig = {
      proxyHost,
      proxyPort,
      proxyUser,
      proxyPass,
    }

    await prisma.account.update({
      where: { id: accountId },
      data: { ...proxyConfig, proxyPass: encrypt(proxyPass) },
    })

    return proxyConfig
  }

  /**
   * Proxy düştüğünde hesaba havuzdan farklı bir port (dolayısıyla farklı IP)
   * atar.
   */
  async refreshProxy(accountId) {
    const proxyHost = await getSetting('PROXY_HOST')
    const proxyUsername = await getSetting('PROXY_USERNAME')
    const proxyPassword = await getSetting('PROXY_PASSWORD')
    const basePort = parseInt(await getSetting('PROXY_PORT') || '10000', 10)

    const account = await prisma.account.findUnique({ where: { id: accountId } })
    if (!account) throw new Error(`Account bulunamadı: ${accountId}`)

    const proxyPort = await this._pickFreePort(accountId, basePort, account.proxyPort)

    const proxyUser = proxyUsername
    const proxyPass = proxyPassword

    const proxyConfig = {
      proxyHost,
      proxyPort,
      proxyUser,
      proxyPass,
    }

    await prisma.account.update({
      where: { id: accountId },
      data: { ...proxyConfig, proxyPass: encrypt(proxyPass) },
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
module.exports.getSetting = getSetting
