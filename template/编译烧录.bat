@echo off
cd /d %~dp0
call env.bat
if not exist build (
  cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug -DCMAKE_TOOLCHAIN_FILE=cmake/arm-gcc-toolchain.cmake || goto :fail
)
cmake --build build || goto :fail
STM32_Programmer_CLI -c port=SWD -w build\firmware.elf -v -rst || goto :fail
echo.
echo 编译烧录完成
pause
exit /b 0
:fail
echo.
echo 出错了，请看上面的信息
pause
exit /b 1
