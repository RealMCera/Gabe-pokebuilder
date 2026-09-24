@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -3 gts-queue-client.py
) else (
  where python >nul 2>nul
  if %ERRORLEVEL%==0 (
    python gts-queue-client.py
  ) else (
    echo Python 3 is required for the v5 GTS bridge helper.
    echo Install Python 3, then run this file again.
    pause
    exit /b 1
  )
)
pause
