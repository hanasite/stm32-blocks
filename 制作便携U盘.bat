@echo off
chcp 65001 >nul
cd /d %~dp0
set "NODE=node"
where node >nul 2>nul || set "NODE=%~dp0env\node\node.exe"
if not "%~1"=="" (
  set "TARGET=%~1"
) else (
  set /p TARGET=Target dir (e.g. H:\stm32blocks):
)
"%NODE%" "%~dp0tools\make-portable.js" "%TARGET%"
pause
