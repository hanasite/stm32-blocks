@echo off
rem Build and flash via ST-Link. No pause here (called by VSCode tasks too).
rem NOTE: STM32CubeProgrammer CLI leaves the core HALTED after download+reset;
rem without the explicit "-run" below the board sits stopped and appears dead.
cd /d %~dp0
call .\build.bat || exit /b 1
cd /d %~dp0
call .\env.bat
STM32_Programmer_CLI -c port=SWD -w "%~dp0build\firmware.elf" -v -rst || exit /b 1
STM32_Programmer_CLI -c port=SWD -run || exit /b 1
exit /b 0
