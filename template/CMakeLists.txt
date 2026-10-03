cmake_minimum_required(VERSION 3.22)
project(firmware C ASM)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)

set(MCU_FLAGS -mcpu=cortex-m3 -mthumb)

set(CORE_SOURCES
  Core/Src/main.c
  Core/Src/stm32f1xx_hal_msp.c
  Core/Src/system_stm32f1xx.c
  Core/Src/user_app.c
  Core/Src/user_code.c
)

set(HAL_SOURCES
  Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal.c
  Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_cortex.c
  Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_dma.c
  Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_flash.c
  Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_flash_ex.c
  Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_gpio.c
  Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_rcc.c
  Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_rcc_ex.c
  Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_tim.c
  Drivers/STM32F1xx_HAL_Driver/Src/stm32f1xx_hal_tim_ex.c
)

set(STARTUP Startup/startup_stm32f103xb.s)

add_compile_options(${MCU_FLAGS} -Wall -ffunction-sections -fdata-sections)
add_compile_definitions(STM32F103xB USE_HAL_DRIVER)

include_directories(
  Core/Inc
  Drivers/STM32F1xx_HAL_Driver/Inc
  Drivers/CMSIS/Device/ST/STM32F1xx/Include
  Drivers/CMSIS/Core/Include
)

add_executable(firmware ${CORE_SOURCES} ${HAL_SOURCES} ${STARTUP})

# 启动文件需要 C 预处理器（与 CubeMX Makefile 同做法）
target_compile_options(firmware PRIVATE $<$<COMPILE_LANGUAGE:ASM>:-x assembler-with-cpp>)

target_link_options(firmware PRIVATE
  ${MCU_FLAGS}
  -T "${CMAKE_SOURCE_DIR}/STM32F103C8Tx_FLASH.ld"
  -Wl,--gc-sections
  --specs=nano.specs --specs=nosys.specs
  -Wl,-Map=${CMAKE_BINARY_DIR}/firmware.map
  -Wl,--print-memory-usage
)

# 第三方源码压低警告
foreach(src ${HAL_SOURCES} Core/Src/system_stm32f1xx.c)
  set_source_files_properties(${src} PROPERTIES COMPILE_OPTIONS "-w")
endforeach()

add_custom_command(TARGET firmware POST_BUILD
  COMMAND ${CMAKE_OBJCOPY} -O binary $<TARGET_FILE:firmware> ${CMAKE_BINARY_DIR}/firmware.bin
  COMMAND ${CMAKE_OBJCOPY} -O ihex   $<TARGET_FILE:firmware> ${CMAKE_BINARY_DIR}/firmware.hex
  COMMAND ${CMAKE_SIZE} $<TARGET_FILE:firmware>
)
