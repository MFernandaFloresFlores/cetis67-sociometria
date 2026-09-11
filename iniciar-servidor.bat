@echo off
REM La Plataforma CETIS 67 corre de forma permanente con pm2 (sobrevive a que
REM cierres esta ventana, y se reinicia sola si la PC se reinicia).
REM Este script solo verifica que este encendida; si no, la arranca.
cd /d "%~dp0"
echo Estado actual:
call pm2 describe cetis67 >nul 2>&1
if errorlevel 1 (
  echo No estaba corriendo. Arrancando...
  call pm2 start node --name cetis67 --cwd "%~dp0server" -- --env-file-if-exists=.env src/index.js
  call pm2 save
) else (
  call pm2 restart cetis67
)
echo.
echo Acceso local:  http://localhost:3000
echo Acceso en red: revisa PUBLIC_URL en server\.env
echo.
echo Para ver el estado en cualquier momento: pm2 status
echo Para ver el registro (logs):             pm2 logs cetis67
pause
