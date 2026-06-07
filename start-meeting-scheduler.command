#!/bin/bash

# start-meeting-scheduler.command - Launch script for Meeting Scheduler Pro

# Get the exact path where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the project directory
cd "$DIR"

echo "=========================================="
echo "🚀 Iniciando Meeting Scheduler Pro..."
echo "=========================================="

# Check for Node.js installation
if ! command -v node &> /dev/null
then
    echo "❌ Node.js no está instalado."
    echo "Por favor instala Node.js desde https://nodejs.org/"
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"

# Check if node_modules exists, if not prompt to run npm install
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules no encontrado."
    echo "Por favor ejecuta 'npm install' primero en este directorio."
    read -p "¿Quieres ejecutar 'npm install' ahora? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        echo "📥 Instalando dependencias..."
        npm install
        if [ $? -ne 0 ]; then
            echo "❌ Falló la instalación de dependencias."
            read -p "Presiona Enter para cerrar..."
            exit 1
        fi
    else
        echo "Operación cancelada."
        read -p "Presiona Enter para cerrar..."
        exit 1
    fi
fi

echo "1. Iniciando servidor de desarrollo Next.js..."

# Kill any zombie Next.js processes from previous sessions that may be holding port 3000
EXISTING_PIDS=$(pgrep -f "next-server|next dev" 2>/dev/null)
if [ ! -z "$EXISTING_PIDS" ]; then
    echo "🧹 Limpiando procesos zombi de Next.js: $EXISTING_PIDS"
    kill $EXISTING_PIDS 2>/dev/null
    sleep 1
fi

# Suppress Node.js v26 module.register() deprecation spam from Turbopack HMR
export NODE_OPTIONS="$NODE_OPTIONS --disable-warning=DEP0205"

# Start the Next.js development server with output piped to a temp file so we can read the chosen port
LOG_FILE=$(mktemp -t nextdev)
npm run dev > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Wait for the server to bind a port (scan the log for the Local: URL)
echo "2. Esperando a que el servidor esté listo..."
PORT=""
for i in {1..30}; do
    if [ -f "$LOG_FILE" ]; then
        PORT=$(grep -oE "localhost:[0-9]+" "$LOG_FILE" | head -1 | cut -d: -f2)
        if [ ! -z "$PORT" ]; then
            break
        fi
    fi
    sleep 1
done

if [ -z "$PORT" ]; then
    echo "⚠️  No se pudo detectar el puerto. Mostrando log:"
    cat "$LOG_FILE"
    PORT=3000
fi

# Verify the server is actually listening on the chosen port
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Servidor iniciado correctamente en http://localhost:$PORT"
else
    echo "⚠️  Posible error al iniciar el servidor. Verifica la ventana de terminal."
fi

echo "3. Abriendo la aplicación en el navegador..."
open "http://localhost:$PORT"

echo "=========================================="
echo "✅ La aplicación se está ejecutando."
echo "📂 Directorio: $DIR"
echo "🌐 URL: http://localhost:$PORT"
echo "⚠️  NO CIERRES ESTA VENTANA."
echo "Para detener la aplicación, presiona Ctrl+C o cierra esta ventana."
echo "=========================================="

# This function runs when closing the window or pressing Ctrl+C
cleanup() {
    echo ""
    echo "⏹️  Cerrando servidor..."
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
    fi
    # Also clean up any orphan next-server/next dev children of this script
    pkill -P $$ -f "next-server|next dev" 2>/dev/null
    if [ -f "$LOG_FILE" ]; then
        rm -f "$LOG_FILE"
    fi
    echo "👋 Aplicación detenida."
    exit
}

# Capture close signals to clean up background processes
trap cleanup EXIT SIGINT SIGTERM SIGHUP

# Wait infinitely to keep the window open
wait