const { Router } = require('express')
const prisma = require('../config/db')

const router = Router()

// GET /api/templates
router.get('/', async (_req, res, next) => {
  try {
    const templates = await prisma.template.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(templates)
  } catch (err) { next(err) }
})

// POST /api/templates
router.post('/', async (req, res, next) => {
  try {
    const { name, body, imageUrl } = req.body
    if (!name || !body) return res.status(400).json({ error: 'name ve body zorunlu' })
    const template = await prisma.template.create({ data: { name, body, imageUrl: imageUrl || null } })
    res.status(201).json(template)
  } catch (err) { next(err) }
})

// PUT /api/templates/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, body, imageUrl } = req.body
    const template = await prisma.template.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(body && { body }),
        imageUrl: imageUrl !== undefined ? (imageUrl || null) : undefined,
      },
    })
    res.json(template)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Template bulunamadı' })
    next(err)
  }
})

// DELETE /api/templates/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.template.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Template bulunamadı' })
    if (err.code === 'P2003') return res.status(409).json({ error: 'Bu şablona bağlı kampanyalar var, önce kampanyaları silin' })
    next(err)
  }
})

module.exports = router
