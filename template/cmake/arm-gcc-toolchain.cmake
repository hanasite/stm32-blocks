# 只用 CubeCLT 自带的 arm-none-eabi 工具链（环境变量 CUBECLT 可覆盖安装位置）
set(CUBECLT_ROOT "$ENV{CUBECLT}")
if(NOT CUBECLT_ROOT)
  set(CUBECLT_ROOT "D:/STM32CubeCLT_1.18.0")
endif()
set(TOOLCHAIN_BIN "${CUBECLT_ROOT}/GNU-tools-for-STM32/bin")

set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_SYSTEM_PROCESSOR arm)
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)

find_program(CMAKE_C_COMPILER   NAMES arm-none-eabi-gcc     PATHS "${TOOLCHAIN_BIN}" NO_DEFAULT_PATH)
find_program(CMAKE_ASM_COMPILER NAMES arm-none-eabi-gcc     PATHS "${TOOLCHAIN_BIN}" NO_DEFAULT_PATH)
find_program(CMAKE_OBJCOPY      NAMES arm-none-eabi-objcopy PATHS "${TOOLCHAIN_BIN}" NO_DEFAULT_PATH)
find_program(CMAKE_SIZE         NAMES arm-none-eabi-size    PATHS "${TOOLCHAIN_BIN}" NO_DEFAULT_PATH)

if(NOT CMAKE_C_COMPILER)
  message(FATAL_ERROR "找不到 arm-none-eabi-gcc：请安装 STM32CubeCLT，或用环境变量 CUBECLT 指定安装目录")
endif()
