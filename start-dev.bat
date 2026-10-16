@echo off
setlocal
cd /d "%~dp0"
title ChronicCare AI - Startup
where node.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is missing. Install Node.js 24 LTS, then reopen this launcher.
  pause
  exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is missing from PATH. Repair your Node.js installation.
  pause
  exit /b 1
)
node.exe -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit(major>=24 ? 0 : major===22 ? minor>=13 ? 0 : 1 : 1)"
if errorlevel 1 (
  echo ERROR: Use Node.js 22.13+ on 22.x, or Node.js 24+ recommended.
  pause
  exit /b 1
)
node.exe "%~dp0scripts\start-dev.mjs"
if errorlevel 1 (
  echo.
  echo Startup did not complete. Read the message above and the server windows.
  pause
  exit /b 1
)
endlocal
