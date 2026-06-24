#!/bin/bash
# WhatsApp Panel — Sunucu Kurulum Scripti
# Ubuntu 24.04 LTS üzerinde çalıştırın: bash setup.sh YOUR_DOMAIN.com
set -e

DOMAIN="${1:-DOMAIN_ADI.com}"
APP_DIR="/opt/whatsapp-panel"

echo "=== [1/6] Sistem güncelleniyor ==="
apt update && apt upgrade -y
apt install -y git curl nginx certbot python3-certbot-nginx

echo "=== [2/6] Node.js 20 LTS kuruluyor ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

echo "=== [3/6] PostgreSQL kuruluyor ==="
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# Veritabanı ve kullanıcı oluştur
sudo -u postgres psql <<SQL
CREATE USER wpanel_user WITH PASSWORD 'wpanel_pass';
CREATE DATABASE wpanel OWNER wpanel_user;
GRANT ALL PRIVILEGES ON DATABASE wpanel TO wpanel_user;
SQL

echo "=== [4/6] Redis kuruluyor ==="
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server

echo "=== [5/6] Nginx yapılandırılıyor ==="
NGINX_CONF="/etc/nginx/sites-available/wpanel"
cp "$(dirname "$0")/../nginx/wpanel.conf" "$NGINX_CONF"

# Domain adını yerleştir
sed -i "s/DOMAIN_ADI.com/$DOMAIN/g" "$NGINX_CONF"

# Eski default'u devre dışı bırak
rm -f /etc/nginx/sites-enabled/default

# Sitemizi etkinleştir
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/wpanel

nginx -t
systemctl reload nginx

echo "=== [6/6] SSL sertifikası alınıyor (Let's Encrypt) ==="
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN"

echo ""
echo "=== KURULUM TAMAMLANDI ==="
echo "Domain  : https://$DOMAIN"
echo "Backend : http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Sonraki adım: deploy/start.sh ile uygulamayı başlatın."
