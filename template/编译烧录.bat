@echo off
cd /d %~dp0
call env.bat
if not exist build (
  cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug -DCMAKE_TOOLCHAIN_FILE=cmake/arm-gcc-toolchain.cmake || goto :fail
)
cmake --build build || goto :fail
STM32_Programmer_CLI -c port=SWD -w build\firmware.elf -v -rst || goto :fail
echo.
echo Build and flash OK.
pause
exit /b 0
:fail
echo.
echo FAILED - see messages above.
pause
exit /b 1
