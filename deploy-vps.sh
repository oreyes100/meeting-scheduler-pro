#!/usr/bin/env bash
# deploy-vps.sh — Ejecutar DIRECTAMENTE en el servidor (no via SSH remoto)
# Arregla SSL, despliega MSP, configura Cuentas
set -e

echo "=== 1/4 SSL: renovar certificado ==="
if command -v certbot &>/dev/null; then
  sudo certbot renew --force-renewal --quiet
  sudo nginx -s reload 2>/dev/null || sudo systemctl reload nginx 2>/dev/null || true
  echo "OK: certbot renovado"
else
  # Generar self-signed por 365 días si no hay certbot
  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/congregaciontj.key \
    -out /etc/ssl/certs/congregaciontj.crt \
    -subj "/CN=congregaciontj.duckdns.org" 2>/dev/null
  echo "WARN: certbot no encontrado — generado self-signed 365 días"
  echo "      Instala certbot y corre: sudo certbot --nginx -d congregaciontj.duckdns.org"
fi

echo ""
echo "=== 2/4 MSP: pull + build ==="
cd /opt/msp

# Pull desde GitHub
git fetch origin vps-selfhosted
git checkout vps-selfhosted
git pull origin vps-selfhosted

# Build Next.js
npm run build

# Verificar que la base coincide con el schema tras las migraciones de arranque
node scripts/check-schema.mjs /opt/msp/data/msp.db || echo 'WARN: revisar migraciones de base de datos'

echo ""
echo "=== 3/4 MSP: copiar standalone ==="
cp -r .next/standalone/. /opt/msp/standalone/ 2>/dev/null || true
cp -r .next/static /opt/msp/standalone/.next/static
cp -r public /opt/msp/standalone/public

echo ""
echo "=== 4/4 MSP: reiniciar PM2 ==="
PM2=/home/devops/.npm-global/bin/pm2
$PM2 restart meeting-scheduler-pro --update-env

sleep 3
STATUS=$($PM2 list 2>&1 | grep meeting-scheduler-pro | grep -c "online" || echo "0")
if [ "$STATUS" -gt "0" ]; then
  echo "OK: PM2 online"
else
  echo "WARN: PM2 no está online — revisar: $PM2 logs meeting-scheduler-pro"
fi

echo ""
echo "=== Verificación final ==="
sleep 2
HTTP=$(curl -sk --max-time 10 https://congregaciontj.duckdns.org/api/health -w "%{http_code}" -o /dev/null 2>/dev/null)
echo "HTTPS /api/health: $HTTP"


echo ""
echo "=== DONE ==="
echo "Si HTTPS sigue fallando: sudo certbot --nginx -d congregaciontj.duckdns.org"
