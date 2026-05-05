@echo off
REM Inicia Angular (ng serve con proxy). Ejecutar desde la raíz del repositorio.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-frontend.ps1" %*
