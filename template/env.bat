@echo off
rem 把 CubeCLT 工具链挂进 PATH（可用环境变量 CUBECLT 覆盖安装位置）
if not defined CUBECLT set CUBECLT=D:\STM32CubeCLT_1.18.0
set PATH=%CUBECLT%\CMake\bin;%CUBECLT%\Ninja;%CUBECLT%\GNU-tools-for-STM32\bin;%CUBECLT%\STM32CubeProgrammer\bin;%PATH%
