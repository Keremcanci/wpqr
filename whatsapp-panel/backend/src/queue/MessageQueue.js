const { Queue } = require('bullmq')
const IORedis = require('ioredis')
const prisma = require('../config/db')

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const messageQueue = new Queue('messages', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

/**
 * Kampanya mesajlarını kuyruğa ekler.
 * recipients: [{ phone, body }]
 * Mesajlar arası 3000-8000 ms rastgele gecikme uygulanır.
 */
async function addCampaignToQueue(campaignId, recipients) {
  let cumulativeDelay = 0

  const jobs = recipients.map(({ phone, body }) => {
    const delay = Math.floor(3000 + Math.random() * 5000)
    cumulativeDelay += delay
    return {
      name: 'send-message',
      data: { campaignId, toPhone: phone, body },
      opts: { delay: cumulativeDelay },
    }
  })

  await messageQueue.addBulk(jobs)

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'running', totalCount: recipients.length },
  })

  return jobs.length
}

/**
 * Kampanya kuyruğunu durdurur (drain değil, mevcut running job'lar biter).
 * Campaign status 'failed' olarak güncellenir.
 */
async function stopCampaign(campaignId) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'failed' },
  })

  const waitingJobs = await messageQueue.getJobs(['waiting', 'delayed'])
  for (const job of waitingJobs) {
    if (job.data.campaignId === campaignId) {
      await job.remove()
    }
  }
}

module.exports = { messageQueue, addCampaignToQueue, stopCampaign, connection }
