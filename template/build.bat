@echo off
rem Build firmware (CMake + Ninja).
rem ROOT CAUSE NOTE: cmake 3.28 (CubeCLT) crashes silently (0xC0000409)
rem when its process working directory is a non-ASCII path. So we run
rem cmake from C:\ with absolute project paths; ninja/gcc are fine
rem inside the (possibly non-ASCII) build directory.
cd /d %~dp0
call .\env.bat
cd /d C:\
cmake -S "%~dp0." -B "%~dp0build" -G Ninja -DCMAKE_BUILD_TYPE=Debug -DCMAKE_TOOLCHAIN_FILE="%~dp0cmake\arm-gcc-toolchain.cmake" || exit /b 1
cmake --build "%~dp0build" || exit /b 1
exit /b 0
