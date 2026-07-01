#!/bin/bash
cd "$(dirname "$0")"
echo "=== Push a producción ==="
git push origin main
echo ""
echo "✓ Listo. Vercel desplegando..."
read -p "Presiona Enter para cerrar..."
