# WhatsApp Panel — Bug Raporu ve Düzeltme Listesi

Aşağıdaki sorunlar öncelik sırasına göre listelenmiştir.
Her madde için ne yapılması gerektiği açıkça belirtilmiştir.

---

## KRİTİK BUGLAR (Önce Bunlar)

### BUG 1 — `campaign:progress` socket event'inde `message` objesi eksik

**Sorun:**
`MessageWorker.js` şunu gönderiyor:
```js
{ campaignId, sentCount, failCount, totalCount, lastPhone }
```
Ama `campaigns/[id]/page.tsx` `d.message` bekliyor.

**Sonuç:** Detay sayfasındaki mesaj tablosu gerçek zamanlı güncellenmiyor, sadece sayaçlar güncelleniyor.

**Yapılacak:**
`MessageWorker.js`'de socket emit'e `message` objesini ekle:
```js
socket.emit('campaign:progress', {
  campaignId,
  sentCount,
  failCount,
  totalCount,
  lastPhone,
  message: {
    phone: toPhone,
    status,        // 'sent' veya 'failed'
    error: error ?? null,
    sentAt: new Date().toISOString()
  }
})
```

---

### BUG 2 — Message status uyuşmazlığı (`'queued'` vs `'pending'`)

**Sorun:**
Worker mesajları `status: 'queued'` ile DB'ye yazıyor.
Detay sayfası filtre butonları `'pending' | 'sent' | 'failed'` bekliyor.
`'queued'` status'undaki mesajlar "Bekliyor" filtresinde görünmüyor.

**Yapılacak:**
İki seçenek var, birini seç:

**Seçenek A (önerilen):** Worker'da status'u `'pending'` olarak değiştir:
```js
// MessageWorker.js — mesaj oluştururken
status: 'pending'   // 'queued' değil
```

**Seçenek B:** Frontend'de filtre butonuna `'queued'`'i de ekle:
```tsx
// campaigns/[id]/page.tsx
filter === 'pending' ? ['pending', 'queued'].includes(m.status) : m.status === filter
```

---

### BUG 3 — `dailySent` gece yarısı sıfırlanmıyor

**Sorun:**
`dailySent` her mesajda increment ediliyor ama hiçbir yerde gece 00:00'da `dailySent = 0` yapılmıyor.
İkinci günden itibaren tüm hesaplar limitine ulaşmış sayılır, `getNextAvailableAccount()` her zaman `null` döner — **sistem tamamen durur.**

**Yapılacak:**
`app.js` veya ayrı bir `scheduler.js` dosyasına cron job ekle:

```js
// npm install node-cron
import cron from 'node-cron'

// Her gece 00:00'da tüm hesapların dailySent'ini sıfırla
cron.schedule('0 0 * * *', async () => {
  await prisma.account.updateMany({
    data: { dailySent: 0 }
  })
  console.log('[Cron] dailySent sıfırlandı')
}, {
  timezone: 'Europe/Istanbul'
})
```

---

## EKSİKLİKLER

### EKSİKLİK 4 — `ExcelUpload.tsx` spinner'da `border-3` Tailwind'de yok

**Sorun:**
Spinner'da `border-3 border-blue-500` kullanılıyor.
Tailwind'de `border-3` class'ı tanımlı değil (sadece `border`, `border-2`, `border-4` var).
Spinner border'sız görünür.

**Yapılacak:**
```tsx
// Eski
<div className="border-3 border-blue-500 rounded-full animate-spin" />

// Yeni
<div className="border-2 border-blue-500 rounded-full animate-spin" />
```

---

### EKSİKLİK 5 — Dashboard grafiği mock veri kullanıyor

**Sorun:**
`mockActivity()` her render'da rastgele sayılar üretiyor.
Backend'den gerçek saatlik mesaj verisi çekilmiyor.

**Yapılacak:**

Backend'de `GET /api/dashboard` endpoint'ine son 24 saatin saatlik mesaj sayısını ekle:
```js
// dashboard.js
const hourlyStats = await prisma.$queryRaw`
  SELECT
    EXTRACT(HOUR FROM "sentAt") as hour,
    COUNT(*) as count
  FROM "Message"
  WHERE "sentAt" > NOW() - INTERVAL '24 hours'
    AND status = 'sent'
  GROUP BY hour
  ORDER BY hour
`
```

Frontend'de `mockActivity()` yerine bu veriyi kullan.

---

### EKSİKLİK 6 — `stopCampaign` BullMQ'deki delayed job'ları temizlemiyor

**Sorun:**
Kampanya durdurulunca sadece DB'de `status: 'failed'` yapılıyor.
Kuyruktaki delayed job'lar Redis'te beklemeye devam ediyor — Redis şişiyor.

**Yapılacak:**
```js
// campaigns.js — stopCampaign fonksiyonu içine ekle
import { Queue } from 'bullmq'
const messageQueue = new Queue('messages')

// Kampanyaya ait tüm bekleyen job'ları sil
const waitingJobs = await messageQueue.getJobs(['waiting', 'delayed'])
for (const job of waitingJobs) {
  if (job.data.campaignId === campaignId) {
    await job.remove()
  }
}
```

---

### EKSİKLİK 7 — Sidebar aktif link `/campaigns/*` altında çalışmıyor

**Sorun:**
Sidebar `pathname === href` ile kesin eşleşme yapıyor.
`/campaigns/abc123` veya `/campaigns/new` sayfasındayken "Kampanyalar" linki aktif görünmüyor.

**Yapılacak:**
```tsx
// Sidebar.tsx — aktif link kontrolünü değiştir

// Eski
const isActive = pathname === href

// Yeni
const isActive = pathname === href || pathname.startsWith(href + '/')
```

---

## İYİLEŞTİRME ÖNERİLERİ

### İYİLEŞTİRME 8 — CORS production'da tüm origin'lere açık

**Sorun:**
`app.use(cors())` kısıtlama olmadan tüm domainlere izin veriyor.

**Yapılacak:**
```js
// app.js
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}))
```

`.env`'e ekle:
```
CORS_ORIGIN=https://DOMAIN_ADI.com
```

---

### İYİLEŞTİRME 9 — `campaigns.js`'de kullanılmayan `messages` array dead code

**Sorun:**
Campaign oluştururken `accountId: null` içeren bir `messages` array oluşturuluyor ama DB'ye yazılmıyor.

**Yapılacak:**
İlgili dead code bloğunu tamamen sil. Mesajlar zaten `MessageWorker.js` tarafından oluşturuluyor.

---

### İYİLEŞTİRME 10 — Graceful shutdown yok

**Sorun:**
Process sonlandırılınca (PM2 restart, SIGTERM) aktif Baileys session'ları kapatılmıyor.
Session dosyaları bozulabilir, hesaplar disconnect görünebilir.

**Yapılacak:**
```js
// app.js — en alta ekle
async function shutdown() {
  console.log('[Shutdown] Baileys sessionları kapatılıyor...')
  await sessionManager.closeAll()   // tüm socket.end() çağrıları
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
```

`SessionManager.js`'e `closeAll()` metodu ekle:
```js
async closeAll() {
  for (const [id, sock] of this.sessions) {
    try { await sock.end() } catch {}
  }
  this.sessions.clear()
}
```

---

## ÖZET — Öncelik Sırası

| # | Tür | Açıklama | Kritiklik |
|---|-----|----------|-----------|
| 1 | Bug | campaign:progress'e message objesi ekle | 🔴 Kritik |
| 2 | Bug | status 'queued' → 'pending' yap | 🔴 Kritik |
| 3 | Bug | dailySent gece 00:00'da sıfırla (cron) | 🔴 Kritik |
| 4 | Eksiklik | border-3 → border-2 | 🟡 Orta |
| 5 | Eksiklik | Dashboard'a gerçek API verisi bağla | 🟡 Orta |
| 6 | Eksiklik | stopCampaign'de BullMQ job'larını temizle | 🟡 Orta |
| 7 | Eksiklik | Sidebar startsWith ile aktif link | 🟡 Orta |
| 8 | İyileştirme | CORS origin kısıtla | 🟢 Düşük |
| 9 | İyileştirme | Dead code sil | 🟢 Düşük |
| 10 | İyileştirme | Graceful shutdown ekle | 🟢 Düşük |
