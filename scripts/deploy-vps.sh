#!/usr/bin/env bash
# /opt/deploy-msp.sh — deploy automático desde GitHub Actions
# Instalar: cp scripts/deploy-vps.sh /opt/deploy-msp.sh && chmod +x /opt/deploy-msp.sh
set -euo pipefail

REPO="https://github.com/oreyes100/meeting-scheduler-pro.git"
BRANCH="vps-selfhosted"
BUILD_DIR="/tmp/msp-build-$$"
PROD_DIR="/opt/msp"
PM2_NAME="$(pm2 list --no-color 2>/dev/null | grep -oP '[a-z][a-z0-9_-]+(?=\s+\│|\s+online|\s+stopped)' | grep -v 'name\|id\|status\|restart' | head -1)"

echo "[deploy] $(date) — branch $BRANCH"

# Build en directorio temporal
git clone "$REPO" "$BUILD_DIR" --branch "$BRANCH" --depth 1
cd "$BUILD_DIR"
npm ci --prefer-offline
npm run build

# Swap de standalone
rm -rf "$PROD_DIR/.next/standalone"
cp -r "$BUILD_DIR/.next/standalone" "$PROD_DIR/.next/standalone"
rm -rf "$PROD_DIR/.next/standalone/.next/static"
cp -r "$BUILD_DIR/.next/static" "$PROD_DIR/.next/standalone/.next/static"

# Reiniciar
if [ -n "$PM2_NAME" ]; then
  pm2 restart "$PM2_NAME" --update-env
  echo "[deploy] Proceso PM2 '$PM2_NAME' reiniciado"
else
  echo "[deploy] WARN: no se encontró proceso PM2; reiniciar manualmente"
fi

# Limpieza
cd /
rm -rf "$BUILD_DIR"
echo "[deploy] Listo"
