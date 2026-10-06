@echo off
chcp 65001 >nul
cd /d %~dp0
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js LTS first: https://nodejs.org/
  pause
  exit /b 1
)
node "%~dp0tools\serve.js"
pause
