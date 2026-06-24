const { Router } = require('express')
const multer = require('multer')
const XLSX = require('xlsx')

const router = Router()

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ]
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true)
    } else {
      cb(new Error('Sadece .xlsx, .xls veya .csv dosyaları yüklenebilir'))
    }
  },
})

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('90') && digits.length === 12) return '+' + digits
  if (digits.startsWith('0') && digits.length === 11) return '+9' + digits
  if (digits.length === 10) return '+90' + digits
  return null
}

// POST /api/upload/excel
router.post('/excel', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya bulunamadı' })

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const valid = []
  const invalid = []

  // İlk satır başlık olabilir — telefon gibi görünmüyorsa atla
  const startRow = String(rows[0]?.[0]).replace(/\D/g, '').length >= 7 ? 0 : 1

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    const rawPhone = String(row[0] || '').trim()

    // Tamamen boş satırları sessizce atla
    if (!rawPhone && !String(row[1] || '').trim() && !String(row[2] || '').trim()) continue

    const phone = normalizePhone(rawPhone)
    const isim = String(row[1] || '').trim()
    const soyisim = String(row[2] || '').trim()

    if (phone) {
      valid.push({ phone, variables: { isim, soyisim } })
    } else {
      invalid.push({ row: i + 1, value: rawPhone })
    }

    if (valid.length >= 10000) break // max 10.000 numara
  }

  res.json({
    total: valid.length + invalid.length,
    valid: valid.length,
    invalidCount: invalid.length,
    recipients: valid,
    invalidRows: invalid,
  })
})

module.exports = router
