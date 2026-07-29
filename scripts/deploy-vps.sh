#!/usr/bin/env bash
# /opt/deploy-msp.sh — deploy automático desde GitHub Actions
# Instalar en VPS: cp scripts/deploy-vps.sh /opt/deploy-msp.sh && chmod +x /opt/deploy-msp.sh
set -euo pipefail

REPO="https://github.com/oreyes100/meeting-scheduler-pro.git"
BRANCH="vps-selfhosted"
BUILD_DIR="/tmp/msp-build-$$"
PROD_DIR="/opt/msp"
PM2=/home/devops/.npm-global/bin/pm2

echo "[deploy] $(date) — branch $BRANCH"

# Build en directorio temporal
git clone "$REPO" "$BUILD_DIR" --branch "$BRANCH" --depth 1
cd "$BUILD_DIR"
npm ci --prefer-offline
npm run build

# Limpiar dirs que pueden tener archivos root-owned de deploys anteriores
# (si falla, ignorar — lo nuevo se copiará encima)
sudo rm -rf "$PROD_DIR/.next/standalone" 2>/dev/null || true
sudo rm -rf "$PROD_DIR/.next/server" 2>/dev/null || true

# Swap: layout del VPS tiene server.js en raíz de /opt/msp, .next/ a su lado
# 1. Servidor standalone
cp "$BUILD_DIR/.next/standalone/server.js" "$PROD_DIR/server.js"

# 2. Manifests y chunks del servidor (sin cache, sin static)
rsync -a --exclude=cache --exclude=static \
  "$BUILD_DIR/.next/standalone/.next/" "$PROD_DIR/.next/"

# 3. Static assets del cliente
rm -rf "$PROD_DIR/.next/static"
cp -r "$BUILD_DIR/.next/static" "$PROD_DIR/.next/static"

# 4. Public
cp -r "$BUILD_DIR/public/." "$PROD_DIR/public/"

# 5. Assets leídos en runtime vía process.cwd() (pdfForms.ts: src/lib/pdf-templates)
#    El server standalone corre con cwd=/opt/msp, así que estos deben existir ahí.
mkdir -p "$PROD_DIR/src/lib/pdf-templates"
cp -r "$BUILD_DIR/src/lib/pdf-templates/." "$PROD_DIR/src/lib/pdf-templates/"
chmod 644 "$PROD_DIR/src/lib/pdf-templates/"*.pdf

# Reiniciar PM2 (full delete+start para recargar env vars)
$PM2 delete meeting-scheduler-pro 2>/dev/null || true
$PM2 start "$PROD_DIR/ecosystem.config.cjs"
echo "[deploy] PM2 reiniciado"

# Verificar
sleep 3
STATUS=$(curl -sk --max-time 8 http://localhost:3000/api/health 2>/dev/null || echo "no-response")
echo "[deploy] Health: $STATUS"

# Limpieza
cd /
rm -rf "$BUILD_DIR"
echo "[deploy] Listo"
