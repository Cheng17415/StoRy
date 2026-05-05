@echo off
REM Inicia el backend Spring Boot. Ejecutar desde la raíz del repo o con doble clic (ajusta rutas si hace falta).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-backend.ps1" %*
