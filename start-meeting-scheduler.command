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
# Suppress Node.js v26 module.register() deprecation spam from Turbopack HMR
export NODE_OPTIONS="$NODE_OPTIONS --disable-warning=DEP0205"
# Start the Next.js development server
npm run dev &
SERVER_PID=$!

# Wait a few seconds for the server to start
echo "2. Esperando a que el servidor esté listo..."
sleep 5

# Check if server started successfully by probing the port
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Servidor iniciado correctamente en http://localhost:3000"
else
    echo "⚠️  Posible error al iniciar el servidor. Verifica la ventana de terminal."
fi

echo "3. Abriendo la aplicación en el navegador..."
open http://localhost:3000

echo "=========================================="
echo "✅ La aplicación se está ejecutando."
echo "📂 Directorio: $DIR"
echo "🌐 URL: http://localhost:3000"
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
    echo "👋 Aplicación detenida."
    exit
}

# Capture close signals to clean up background processes
trap cleanup EXIT SIGINT SIGTERM SIGHUP

# Wait infinitely to keep the window open
wait