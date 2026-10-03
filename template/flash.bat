@echo off
rem Build and flash via ST-Link. No pause here (called by VSCode tasks too).
cd /d %~dp0
call .\build.bat || exit /b 1
call .\env.bat
STM32_Programmer_CLI -c port=SWD -w "%~dp0build\firmware.elf" -v -rst || exit /b 1
exit /b 0
