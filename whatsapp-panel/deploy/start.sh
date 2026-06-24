#!/bin/bash
# WhatsApp Panel — Uygulama Başlatma Scripti (PM2)
# Adım 16'dan önce .env dosyalarını doğru doldurduğunuzdan emin olun.
set -e

BACKEND_DIR="$(cd "$(dirname "$0")/../backend" && pwd)"
FRONTEND_DIR="$(cd "$(dirname "$0")/../frontend" && pwd)"

echo "=== Backend bağımlılıkları kuruluyor ==="
cd "$BACKEND_DIR"
npm install

echo "=== Prisma migrate çalıştırılıyor ==="
npx prisma migrate deploy
npx prisma generate

echo "=== Frontend build alınıyor ==="
cd "$FRONTEND_DIR"
npm install
npm run build

echo "=== PM2 ile servisler başlatılıyor ==="
# Varsa eski processleri durdur
pm2 delete wp-backend  2>/dev/null || true
pm2 delete wp-frontend 2>/dev/null || true

cd "$BACKEND_DIR"
pm2 start src/app.js --name wp-backend --node-args="--max-old-space-size=512"

cd "$FRONTEND_DIR"
pm2 start npm --name wp-frontend -- start

echo "=== Sunucu yeniden başlayınca otomatik çalış ==="
pm2 startup
pm2 save

echo ""
echo "=== BAŞLATMA TAMAMLANDI ==="
pm2 list
