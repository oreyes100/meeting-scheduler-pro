@echo off
setlocal
title Meeting Scheduler Pro

:: Cambiar al directorio del script
cd /d "%~dp0"

echo ==========================================
echo [🚀] Iniciando Meeting Scheduler Pro...
echo ==========================================

:: Verificar Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [X] Node.js no esta instalado.
    echo Por favor instala Node.js desde https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [OK] Node.js encontrado: %NODE_VER%

:: Verificar node_modules
if not exist "node_modules\" (
    echo [!] node_modules no encontrado.
    set /p install_npm="Quieres ejecutar 'npm install' ahora? (y/n): "
    if /i "%install_npm%"=="y" (
        echo [i] Instalando dependencias...
        call npm install
        if %errorlevel% neq 0 (
            echo [X] Fallo la instalacion de dependencias.
            pause
            exit /b 1
        )
    ) else (
        echo Operacion cancelada.
        pause
        exit /b 1
    )
)

echo 1. Iniciando servidor de desarrollo Next.js...

:: Limpiar procesos zombi en el puerto 3000
for /f "tokens=5" %%a in ('netstat -aon ^| find "LISTENING" ^| find ":3000"') do (
    echo [🧹] Limpiando procesos en el puerto 3000 ^(PID: %%a^)...
    taskkill /F /PID %%a >nul 2>nul
)

echo 2. El servidor se esta iniciando...

:: Disparar un proceso en segundo plano que espere 6 segundos y abra el navegador
start /B cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"

echo 3. Abriendo la aplicacion en el navegador...
echo ==========================================
echo [✅] La aplicacion se esta ejecutando.
echo [🌐] URL: http://localhost:3000
echo [⚠️] NO CIERRES ESTA VENTANA.
echo Para detener la aplicacion, presiona Ctrl+C o cierra esta ventana.
echo ==========================================

:: Lanzar servidor en esta misma ventana para que Ctrl+C lo detenga
call npm run dev
