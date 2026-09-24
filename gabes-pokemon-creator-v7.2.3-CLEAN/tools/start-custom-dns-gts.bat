@echo off
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting Administrator access for the local DNS/GTS server...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0custom-dns-gts.ps1""'"
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0custom-dns-gts.ps1"
pause
