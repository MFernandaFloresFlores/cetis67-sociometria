@echo off
setlocal

echo ============================================
echo  Instalacion inicial - Plataforma CETIS 67
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js en esta PC.
  echo Instala Node 22 o superior desde https://nodejs.org y vuelve a correr este script.
  pause
  exit /b 1
)

echo [1/6] Instalando dependencias del servidor y del cliente...
call npm run install:all
if errorlevel 1 (
  echo [ERROR] Fallo la instalacion de dependencias. Revisa el mensaje de arriba.
  pause
  exit /b 1
)

echo.
echo [2/6] Generando configuracion (server\.env)...
call npm --prefix server run setup-env
if errorlevel 1 (
  echo [ERROR] Fallo la generacion de server\.env
  pause
  exit /b 1
)

echo.
echo [3/6] Compilando el frontend...
call npm run build
if errorlevel 1 (
  echo [ERROR] Fallo la compilacion del frontend.
  pause
  exit /b 1
)

echo.
echo [4/6] Verificando pm2 (mantiene el servidor corriendo aunque cierres la ventana)...
where pm2 >nul 2>&1
if errorlevel 1 (
  echo pm2 no estaba instalado en esta PC. Instalando...
  call npm install -g pm2
  if errorlevel 1 (
    echo [ERROR] No se pudo instalar pm2. Puedes seguir usando "npm start" manualmente en su lugar.
    pause
    exit /b 1
  )
  call npm install -g pm2-windows-startup
  call pm2-startup install
) else (
  echo pm2 ya estaba instalado.
)

echo.
echo [5/6] Cuenta de administrador
echo (Si ya existe un usuario "admin", esto le cambia el nombre/contrasena.)
echo NOTA: la contrasena se vera en pantalla mientras la escribes.
set /p ADMIN_NAME="Nombre a mostrar (ej. Direccion CETIS 67): "
set /p ADMIN_PASS="Contrasena para 'admin' (minimo 8 caracteres): "
call npm --prefix server run create-user -- admin "%ADMIN_NAME%" admin "%ADMIN_PASS%"
if errorlevel 1 (
  echo [ERROR] No se pudo crear la cuenta de administrador.
  pause
  exit /b 1
)

echo.
echo [6/6] Arrancando el servidor con pm2...
call pm2 describe cetis67 >nul 2>&1
if errorlevel 1 (
  call pm2 start node --name cetis67 --cwd "%~dp0server" -- --env-file-if-exists=.env src/index.js
) else (
  call pm2 restart cetis67
)
call pm2 save

echo.
echo ============================================
echo  Listo. Entra a http://localhost:3000
echo  Usuario: admin
echo ============================================
pause
