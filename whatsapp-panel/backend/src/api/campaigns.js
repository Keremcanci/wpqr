const { Router } = require('express')
const prisma = require('../config/db')
const { addCampaignToQueue, stopCampaign } = require('../queue/MessageQueue')

const router = Router()

// GET /api/campaigns — kampanya geçmişi
router.get('/', async (_req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { template: { select: { name: true } } },
    })
    res.json(campaigns)
  } catch (err) { next(err) }
})

// GET /api/campaigns/:id — detay ve ilerleme
router.get('/:id', async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        template: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: { id: true, toPhone: true, status: true, error: true, sentAt: true },
        },
      },
    })
    if (!campaign) return res.status(404).json({ error: 'Kampanya bulunamadı' })
    res.json(campaign)
  } catch (err) { next(err) }
})

// POST /api/campaigns — kampanya oluştur (mesajları kuyruğa MessageQueue ekler)
router.post('/', async (req, res, next) => {
  try {
    const { name, templateId, recipients } = req.body
    // recipients: [{ phone, variables: { isim, soyisim } }]
    if (!name || !templateId || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'name, templateId ve recipients zorunlu' })
    }

    const template = await prisma.template.findUnique({ where: { id: templateId } })
    if (!template) return res.status(404).json({ error: 'Template bulunamadı' })

    const campaign = await prisma.campaign.create({
      data: {
        name,
        templateId,
        totalCount: recipients.length,
        status: 'pending',
      },
    })

    const preparedMessages = recipients.map(({ phone, variables = {} }) => {
      let body = template.body
      for (const [key, val] of Object.entries(variables)) {
        body = body.replace(new RegExp(`\\{${key}\\}`, 'g'), val)
      }
      return { phone, body, imageUrl: template.imageUrl || null }
    })

    // Mesajları kuyruğa ekle
    const queuedCount = await addCampaignToQueue(campaign.id, preparedMessages)

    res.status(201).json({ ...campaign, queuedCount })
  } catch (err) { next(err) }
})

// POST /api/campaigns/:id/stop — kampanyayı durdur
router.post('/:id/stop', async (req, res, next) => {
  try {
    await stopCampaign(req.params.id)
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } })
    if (!campaign) return res.status(404).json({ error: 'Kampanya bulunamadı' })
    res.json({ success: true, campaign })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kampanya bulunamadı' })
    next(err)
  }
})

module.exports = router
