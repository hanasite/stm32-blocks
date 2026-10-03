@echo off
cd /d %~dp0
call .\flash.bat
if errorlevel 1 (
  echo.
  echo FAILED - see messages above.
) else (
  echo.
  echo Build and flash OK.
)
pause
