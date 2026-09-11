@echo off
REM Apaga la Plataforma CETIS 67 (deja de responder hasta que se vuelva a iniciar).
call pm2 stop cetis67
pause
