@echo off
REM La Plataforma CETIS 67 corre de forma permanente con pm2 (sobrevive a que
REM cierres esta ventana, y se reinicia sola si la PC se reinicia).
REM Este script verifica los requisitos, arranca si hace falta, y confirma
REM que de verdad quedo respondiendo antes de decir que todo esta bien.
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js en esta PC.
  echo Instala Node 22 o superior desde https://nodejs.org y vuelve a intentar.
  pause
  exit /b 1
)

if not exist "server\.env" (
  echo [ERROR] No existe server\.env todavia.
  echo Esta PC no tiene la instalacion inicial hecha. Corre primero "instalar.bat"
  echo ^(doble clic^) y despues vuelve a correr este script.
  pause
  exit /b 1
)

where pm2 >nul 2>&1
if errorlevel 1 (
  echo pm2 no esta instalado en esta PC. Instalando...
  call npm install -g pm2
  if errorlevel 1 (
    echo [ERROR] No se pudo instalar pm2. Corre "instalar.bat" para una instalacion completa.
    pause
    exit /b 1
  )
)

echo Estado actual:
call pm2 describe cetis67 >nul 2>&1
if errorlevel 1 (
  echo No estaba corriendo. Arrancando...
  call pm2 start node --name cetis67 --cwd "%~dp0server" -- --env-file-if-exists=.env src/index.js
  if errorlevel 1 (
    echo [ERROR] pm2 no pudo arrancar el servidor. Revisa el mensaje de arriba.
    pause
    exit /b 1
  )
  call pm2 save
) else (
  call pm2 restart cetis67
)

echo.
echo Verificando que el servidor responda...
timeout /t 2 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:3000/api/health > "%TEMP%\cetis67_check.txt"
set /p HTTP_CODE=<"%TEMP%\cetis67_check.txt"
del "%TEMP%\cetis67_check.txt" >nul 2>&1

if "%HTTP_CODE%"=="200" (
  echo.
  echo ============================================
  echo  El servidor esta corriendo correctamente.
  echo  Acceso local:  http://localhost:3000
  echo  Acceso en red: revisa PUBLIC_URL en server\.env
  echo ============================================
) else (
  echo.
  echo [ERROR] El servidor no respondio como se esperaba ^(codigo: %HTTP_CODE%^).
  echo Revisa el detalle con:  pm2 logs cetis67
)

echo.
echo Para ver el estado en cualquier momento: pm2 status
echo Para ver el registro ^(logs^):             pm2 logs cetis67
pause
