@echo off
rem Prepend CubeCLT toolchain bins to PATH (override install dir via env var CUBECLT)
if not defined CUBECLT set CUBECLT=D:\STM32CubeCLT_1.18.0
set PATH=%CUBECLT%\CMake\bin;%CUBECLT%\Ninja;%CUBECLT%\GNU-tools-for-STM32\bin;%CUBECLT%\STM32CubeProgrammer\bin;%PATH%
