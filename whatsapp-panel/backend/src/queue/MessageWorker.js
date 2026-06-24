const { Worker } = require('bullmq')
const prisma = require('../config/db')
const sessionManager = require('../whatsapp/SessionManager')
const { connection } = require('./MessageQueue')
const { getIO } = require('../socket')

// Round-robin için global index
let accountRotationIndex = 0

// Hesap seçimi ve dailySent artışını atomik tek sorguda yapar.
// updateMany WHERE dailySent < dailyLimit → count=0 ise limit dolmuş demektir.
async function claimAccountSlot() {
  const accounts = await prisma.account.findMany({
    where: { status: 'connected', isBackup: false },
    orderBy: { createdAt: 'asc' },
  })

  if (accounts.length === 0) return null

  for (let i = 0; i < accounts.length; i++) {
    const idx = (accountRotationIndex + i) % accounts.length
    const candidate = accounts[idx]

    const result = await prisma.account.updateMany({
      where: { id: candidate.id, dailySent: { lt: candidate.dailyLimit } },
      data: { dailySent: { increment: 1 } },
    })

    if (result.count > 0) {
      accountRotationIndex = (idx + 1) % accounts.length
      return candidate
    }
  }

  return null // tüm hesaplar günlük limite ulaştı
}

async function processMessage(job) {
  const { campaignId, toPhone, body } = job.data

  // Kampanya durdurulmuş mu?
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  })
  if (!campaign || campaign.status === 'failed') {
    return { skipped: true, reason: 'campaign stopped' }
  }

  // Hesap seç ve dailySent'i atomik artır
  const account = await claimAccountSlot()
  if (!account) {
    // Tüm hesaplar limitli → kuyruğu durdur, uyar
    try { getIO().emit('campaign:error', { campaignId, reason: 'limit' }) } catch {}
    throw new Error('Kullanılabilir hesap yok — günlük limit doldu')
  }

  // DB'ye mesaj kaydı oluştur
  const message = await prisma.message.create({
    data: { campaignId, accountId: account.id, toPhone, body, status: 'pending' },
  })

  try {
    await sessionManager.sendMessage(account.id, toPhone, body)

    await prisma.message.update({
      where: { id: message.id },
      data: { status: 'sent', sentAt: new Date() },
    })

    // Kampanya sayacını güncelle
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { sentCount: { increment: 1 } },
      select: { sentCount: true, totalCount: true, failCount: true },
    })

    try {
      getIO().emit('campaign:progress', {
        campaignId,
        sentCount: updated.sentCount,
        failCount: updated.failCount,
        totalCount: updated.totalCount,
        lastPhone: toPhone,
        message: {
          id: message.id,
          toPhone,
          status: 'sent',
          error: null,
          sentAt: new Date().toISOString(),
        },
      })

      if (updated.sentCount + updated.failCount >= updated.totalCount) {
        await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'completed' } })
        getIO().emit('campaign:completed', { campaignId, ...updated })
      }
    } catch {}

    return { success: true, messageId: message.id }
  } catch (err) {
    await prisma.message.update({
      where: { id: message.id },
      data: { status: 'failed', error: err.message },
    })

    // Gönderim başarısız → önceden claim ettiğimiz dailySent slot'unu geri ver
    await prisma.account.update({
      where: { id: account.id },
      data: { dailySent: { decrement: 1 } },
    }).catch(() => {})

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { failCount: { increment: 1 } },
    })

    try {
      getIO().emit('campaign:error', {
        campaignId,
        toPhone,
        error: err.message,
        message: {
          id: message.id,
          toPhone,
          status: 'failed',
          error: err.message,
          sentAt: null,
        },
      })
    } catch {}

    throw err // BullMQ retry mekanizmasını tetikler
  }
}

function startWorker() {
  const worker = new Worker('messages', processMessage, {
    connection,
    concurrency: 5,
  })

  worker.on('completed', (job) => {
    console.log(`[Worker] Job tamamlandı: ${job.id}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job başarısız: ${job?.id} — ${err.message}`)
  })

  console.log('[Worker] MessageWorker başlatıldı (concurrency: 5)')
  return worker
}

module.exports = { startWorker, processMessage }
