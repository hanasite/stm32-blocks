# M1：模板工程与 BSP 驱动 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `template/` 下建成一个可编译、可烧录、可跑冒烟的 STM32F103C8T6 固件工程：CMake+Ninja 构建（CubeCLT 工具链）、HAL 最小集、手写 BSP 四件套驱动（按键/LED/蜂鸣器/舵机），最终 `user_code.c` 冒烟程序实现"按住按键：LED 亮+蜂鸣器响+舵机 90°；松开：全复位"。

**Architecture:** 不用 CubeMX 生成——手写最小 HAL 工程；**外设初始化全部由 BSP 驱动完成**（引脚任意选）；`main.c` 固定，只调 `user_setup()` / `user_loop()`；生成器的目标文件 `Core/Src/user_code.c` 本阶段手写冒烟版，M2 后由积木生成器覆盖。

**Tech Stack:** STM32F103C8T6（蓝药丸）+ STM32CubeF1 HAL（裁剪 vendor 进仓库）+ STM32CubeCLT 1.18.0（arm-none-eabi-gcc 13.3 / GDB / CMake 3.28 / Ninja 1.11 / STM32_Programmer_CLI 2.19 / ST-LINK GDB server）+ VSCode + Cortex-Debug。

## Global Constraints

- 工具链根目录 `D:\STM32CubeCLT_1.18.0`（环境变量 `CUBECLT` 可覆盖）；**不假设其在 PATH 中**，一切脚本自己拼 PATH。
- 仓库根：`F:\kakuns开源项目\stm32-blocks`；本计划全部工作在 `template/` 与 `tools/` 下。
- 命令在 Git Bash（Windows）执行；`.bat` 为 cmd 专用。硬件相关命令（烧录/观察）需要真板 + ST-Link 在场，执行前提示用户接线。
- 代码风格：C99、4 空格缩进、K&R 大括号、文件名小写；**驱动/工程源文件纯 ASCII**（中文只在 md 文档与生成代码注释里）。
- 冒烟接线（M1 固定用这套）：按键 PA1↔GND（内部上拉）、有源蜂鸣器信号 PB1（低电平响）、舵机信号 PA0（TIM2_CH1）、板载 LED PC13（**低电平亮**）；ST-Link：SWDIO/SWCLK/GND/3V3。
- 提交信息格式：`feat:/fix:/docs:` + 中文简述，结尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 每个任务完成后 `git add -A && git commit`（频繁提交）。

---

### Task 1: vendor 裁剪版 STM32CubeF1 HAL 与启动文件

**Files:**
- Create: `template/Drivers/CMSIS/Core/Include/{cmsis_compiler.h, cmsis_gcc.h, cmsis_version.h, core_cm3.h, mpu_armv7.h}`
- Create: `template/Drivers/CMSIS/Device/ST/STM32F1xx/Include/{stm32f1xx.h, stm32f103xb.h, system_stm32f1xx.h}`
- Create: `template/Drivers/STM32F1xx_HAL_Driver/Inc/*.h`（清单见下）
- Create: `template/Drivers/STM32F1xx_HAL_Driver/Src/*.c`（清单见下）
- Create: `template/Drivers/LICENSE.md`（ST 的 BSD-3 许可证，复制自源码仓库）
- Create: `template/Core/Src/system_stm32f1xx.c`（从 CMSIS Templates 复制）
- Create: `template/Startup/startup_stm32f103xb.s`（从 CMSIS Templates/gcc 复制）
- Create: `template/STM32F103C8Tx_FLASH.ld`（手写，全文见下）

**Interfaces:**
- Consumes: 无
- Produces: 后续任务构建所需的全部 HAL/CMSIS 源码；`FLASH_LATENCY_2` 等宏（经 `stm32f1xx_hal_flash.h`）；链接脚本 `STM32F103C8Tx_FLASH.ld`。

- [x] **Step 1: 下载 STM32CubeF1 源码（只取 Drivers）**

```bash
mkdir -p /tmp/cubef1 && cd /tmp/cubef1
git clone --depth 1 --filter=blob:none --sparse https://gh-proxy.com/https://github.com/STMicroelectronics/STM32CubeF1.git
cd STM32CubeF1 && git sparse-checkout set Drivers
```

（若 gh-proxy 的 clone 失败，回退：`git clone --depth 1 --filter=blob:none --sparse https://gitee.com/mirrors/STM32CubeF1.git`，一样 `sparse-checkout set Drivers`。）

**执行记录（2026-10-03）**：gh-proxy 被限流（429）、Gitee 无此镜像，最终**直连 GitHub 克隆成功**。注意 CubeF1 主仓库里 `Drivers/STM32F1xx_HAL_Driver` 和 `Drivers/CMSIS/Device/ST/STM32F1xx` 是 **git 子模块**（sparse-checkout 后是空目录），需另克隆两个独立仓库再复制：

```bash
git clone --depth 1 https://github.com/STMicroelectronics/cmsis_device_f1 /tmp/cubef1/cmsis_device_f1
git clone --depth 1 https://github.com/STMicroelectronics/stm32f1xx_hal_driver /tmp/cubef1/stm32f1xx_hal_driver
```

设备文件在 `cmsis_device_f1/{Include, Source/Templates}`；HAL 在 `stm32f1xx_hal_driver/{Inc, Src}`。

- [x] **Step 2: 复制文件进 template/**

在仓库根执行（`$SRC=/tmp/cubef1/STM32CubeF1/Drivers`）：

```bash
SRC=/tmp/cubef1/STM32CubeF1/Drivers
T=F:/kakuns开源项目/stm32-blocks/template

mkdir -p $T/Drivers/CMSIS/Core/Include $T/Drivers/CMSIS/Device/ST/STM32F1xx/Include \
         $T/Drivers/STM32F1xx_HAL_Driver/Inc $T/Drivers/STM32F1xx_HAL_Driver/Src \
         $T/Core/Src $T/Startup

cp $SRC/CMSIS/Core/Include/{cmsis_compiler.h,cmsis_gcc.h,cmsis_version.h,core_cm3.h,mpu_armv7.h} \
   $T/Drivers/CMSIS/Core/Include/
cp $SRC/CMSIS/Device/ST/STM32F1xx/Include/{stm32f1xx.h,stm32f103xb.h,system_stm32f1xx.h} \
   $T/Drivers/CMSIS/Device/ST/STM32F1xx/Include/
cp $SRC/CMSIS/Device/ST/STM32F1xx/Source/Templates/system_stm32f1xx.c $T/Core/Src/
cp $SRC/CMSIS/Device/ST/STM32F1xx/Source/Templates/gcc/startup_stm32f103xb.s $T/Startup/
cp /tmp/cubef1/STM32CubeF1/LICENSE.md $T/Drivers/LICENSE.md

HALI=$T/Drivers/STM32F1xx_HAL_Driver/Inc
HALS=$T/Drivers/STM32F1xx_HAL_Driver/Src
cp $SRC/STM32F1xx_HAL_Driver/Inc/{stm32f1xx_hal.h,stm32f1xx_hal_def.h,stm32f1xx_hal_cortex.h,stm32f1xx_hal_dma.h,stm32f1xx_hal_dma_ex.h,stm32f1xx_hal_flash.h,stm32f1xx_hal_flash_ex.h,stm32f1xx_hal_gpio.h,stm32f1xx_hal_gpio_ex.h,stm32f1xx_hal_rcc.h,stm32f1xx_hal_rcc_ex.h,stm32f1xx_hal_tim.h,stm32f1xx_hal_tim_ex.h} $HALI/
cp $SRC/STM32F1xx_HAL_Driver/Src/{stm32f1xx_hal.c,stm32f1xx_hal_cortex.c,stm32f1xx_hal_dma.c,stm32f1xx_hal_flash.c,stm32f1xx_hal_flash_ex.c,stm32f1xx_hal_gpio.c,stm32f1xx_hal_rcc.c,stm32f1xx_hal_rcc_ex.c,stm32f1xx_hal_tim.c,stm32f1xx_hal_tim_ex.c} $HALS/
cp -r $SRC/STM32F1xx_HAL_Driver/Inc/Legacy $HALI/   # hal_def.h 依赖 Legacy/stm32_hal_legacy.h（裁剪时极易漏）
```

- [x] **Step 3: 写链接脚本 `template/STM32F103C8Tx_FLASH.ld`（全文）**

```ld
ENTRY(Reset_Handler)

_estack = 0x20005000;    /* 20K RAM 顶端 */
_Min_Heap_Size = 0x200;
_Min_Stack_Size = 0x400;

MEMORY
{
  RAM   (xrw) : ORIGIN = 0x20000000, LENGTH = 20K
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 64K
}

SECTIONS
{
  .isr_vector :
  {
    . = ALIGN(4);
    KEEP(*(.isr_vector))
    . = ALIGN(4);
  } >FLASH

  .text :
  {
    . = ALIGN(4);
    *(.text) *(.text*) *(.glue_7) *(.glue_7t) *(.eh_frame)
    KEEP (*(.init)) KEEP (*(.fini))
    . = ALIGN(4);
    _etext = .;
  } >FLASH

  .rodata :
  {
    . = ALIGN(4);
    *(.rodata) *(.rodata*)
    . = ALIGN(4);
  } >FLASH

  .ARM.extab : { *(.ARM.extab* .gnu.linkonce.armextab.*) } >FLASH
  .ARM : {
    __exidx_start = .;
    *(.ARM.exidx*)
    __exidx_end = .;
  } >FLASH

  .preinit_array :
  {
    PROVIDE_HIDDEN (__preinit_array_start = .);
    KEEP (*(.preinit_array*))
    PROVIDE_HIDDEN (__preinit_array_end = .);
  } >FLASH
  .init_array :
  {
    PROVIDE_HIDDEN (__init_array_start = .);
    KEEP (*(SORT(.init_array.*))) KEEP (*(.init_array*))
    PROVIDE_HIDDEN (__init_array_end = .);
  } >FLASH
  .fini_array :
  {
    PROVIDE_HIDDEN (__fini_array_start = .);
    KEEP (*(SORT(.fini_array.*))) KEEP (*(.fini_array*))
    PROVIDE_HIDDEN (__fini_array_end = .);
  } >FLASH

  _sidata = LOADADDR(.data);

  .data :
  {
    . = ALIGN(4);
    _sdata = .;
    *(.data) *(.data*)
    . = ALIGN(4);
    _edata = .;
  } >RAM AT> FLASH

  . = ALIGN(4);
  .bss :
  {
    _sbss = .;
    __bss_start__ = _sbss;
    *(.bss) *(.bss*) *(COMMON)
    . = ALIGN(4);
    _ebss = .;
    __bss_end__ = _ebss;
  } >RAM

  ._user_heap_stack :
  {
    . = ALIGN(8);
    PROVIDE ( end = . );
    PROVIDE ( _end = . );
    . = . + _Min_Heap_Size;
    . = . + _Min_Stack_Size;
    . = ALIGN(8);
  } >RAM

  /DISCARD/ : { libc.a(*) libm.a(*) }
}
```

- [x] **Step 4: 验证文件齐全**

```bash
cd "F:/kakuns开源项目/stm32-blocks"
ls template/Drivers/STM32F1xx_HAL_Driver/Src | wc -l    # 期望 10
ls template/Drivers/STM32F1xx_HAL_Driver/Inc | wc -l    # 期望 13
ls template/Drivers/CMSIS/Core/Include | wc -l          # 期望 5
test -f template/Startup/startup_stm32f103xb.s && echo startup-ok
test -f template/Core/Src/system_stm32f1xx.c && echo system-ok
test -f template/STM32F103C8Tx_FLASH.ld && echo ld-ok
```

- [x] **Step 5: Commit**

```bash
git add template && git commit -m "feat: vendor 裁剪版 STM32CubeF1 HAL、CMSIS 与启动文件

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: CMake 构建系统 + 最小 main（空 setup/loop）→ 编译 + 烧录打通

**Files:**
- Create: `template/cmake/arm-gcc-toolchain.cmake`
- Create: `template/CMakeLists.txt`
- Create: `template/Core/Inc/{main.h, user_app.h, stm32f1xx_hal_conf.h}`
- Create: `template/Core/Src/{main.c, stm32f1xx_hal_msp.c, user_app.c, user_code.c}`
- Create: `tools/env.sh`、`template/env.bat`

**Interfaces:**
- Consumes: Task 1 的 HAL/启动/ld。
- Produces: `firmware` 构建目标（产物 `build/firmware.elf/.bin/.hex`）；`user_setup()` / `user_loop()` 约定；`Delay_ms(uint32_t)`；`env.sh`/`env.bat` 供后续所有任务拼 PATH。

- [x] **Step 1: 写工具链文件 `template/cmake/arm-gcc-toolchain.cmake`（全文）**

```cmake
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
```

- [x] **Step 2: 写 `template/CMakeLists.txt`（全文）**

```cmake
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
```

- [x] **Step 3: 写 `template/Core/Inc/stm32f1xx_hal_conf.h`（全文）**

```c
#ifndef __STM32F1xx_HAL_CONF_H
#define __STM32F1xx_HAL_CONF_H

#ifdef __cplusplus
extern "C" {
#endif

#define HAL_MODULE_ENABLED
#define HAL_CORTEX_MODULE_ENABLED
#define HAL_DMA_MODULE_ENABLED
#define HAL_FLASH_MODULE_ENABLED
#define HAL_GPIO_MODULE_ENABLED
#define HAL_RCC_MODULE_ENABLED
#define HAL_TIM_MODULE_ENABLED

#if !defined  (HSE_VALUE)
  #define HSE_VALUE               8000000U
#endif
#if !defined  (HSI_VALUE)
  #define HSI_VALUE               8000000U
#endif
#if !defined  (HSE_STARTUP_TIMEOUT)
  #define HSE_STARTUP_TIMEOUT     100U
#endif
#if !defined  (LSI_VALUE)
  #define LSI_VALUE               40000U
#endif
#if !defined  (LSE_VALUE)
  #define LSE_VALUE               32768U
#endif
#if !defined  (LSE_STARTUP_TIMEOUT)
  #define LSE_STARTUP_TIMEOUT     5000U
#endif

#define  VDD_VALUE                    3300U
#define  TICK_INT_PRIORITY            0x0FU
#define  USE_RTOS                     0U
#define  PREFETCH_ENABLE              1U

#ifdef HAL_RCC_MODULE_ENABLED
  #include "stm32f1xx_hal_rcc.h"
#endif
#ifdef HAL_GPIO_MODULE_ENABLED
  #include "stm32f1xx_hal_gpio.h"
#endif
#ifdef HAL_DMA_MODULE_ENABLED
  #include "stm32f1xx_hal_dma.h"
#endif
#ifdef HAL_CORTEX_MODULE_ENABLED
  #include "stm32f1xx_hal_cortex.h"
#endif
#ifdef HAL_FLASH_MODULE_ENABLED
  #include "stm32f1xx_hal_flash.h"
#endif
#ifdef HAL_TIM_MODULE_ENABLED
  #include "stm32f1xx_hal_tim.h"
#endif

#ifdef USE_FULL_ASSERT
  #define assert_param(expr) ((expr) ? (void)0U : assert_failed((uint8_t *)__FILE__, __LINE__))
  void assert_failed(uint8_t* file, uint32_t line);
#else
  #define assert_param(expr) ((void)0U)
#endif

#ifdef __cplusplus
}
#endif

#endif /* __STM32F1xx_HAL_CONF_H */
```

- [x] **Step 4: 写 `template/Core/Inc/main.h`（全文）**

```c
#ifndef __MAIN_H
#define __MAIN_H

#ifdef __cplusplus
extern "C" {
#endif

#include "stm32f1xx_hal.h"

void Error_Handler(void);
void SystemClock_Config(void);

#ifdef __cplusplus
}
#endif

#endif /* __MAIN_H */
```

- [x] **Step 5: 写 `template/Core/Src/main.c`（全文）**

```c
/* main.c — 固定框架，不随积木生成变化 */
#include "main.h"
#include "user_app.h"

int main(void)
{
    HAL_Init();
    SystemClock_Config();

    user_setup();

    while (1)
    {
        user_loop();
    }
}

void SystemClock_Config(void)
{
    RCC_OscInitTypeDef RCC_OscInitStruct = {0};
    RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

    RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSE;
    RCC_OscInitStruct.HSEState = RCC_HSE_ON;
    RCC_OscInitStruct.HSEPredivValue = RCC_HSE_PREDIV_DIV1;
    RCC_OscInitStruct.HSIState = RCC_HSI_ON;
    RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
    RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
    RCC_OscInitStruct.PLL.PLLMUL = RCC_PLL_MUL9;
    if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
    {
        Error_Handler();
    }

    RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK |
                                  RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
    RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
    RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV2;
    RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;

    if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_2) != HAL_OK)
    {
        Error_Handler();
    }
}

void Error_Handler(void)
{
    __disable_irq();
    while (1)
    {
    }
}
```

- [x] **Step 6: 写 `template/Core/Src/stm32f1xx_hal_msp.c`（全文）**

```c
/* HAL 的 MspInit 回调：本工程外设初始化全部由 BSP 驱动自理，这里保持空实现 */
#include "main.h"

void HAL_MspInit(void)
{
}

void HAL_TIM_Base_MspInit(TIM_HandleTypeDef *htim)
{
    (void)htim;
}

void HAL_TIM_PWM_MspInit(TIM_HandleTypeDef *htim)
{
    (void)htim;
}
```

- [x] **Step 7: 写 `template/Core/Inc/user_app.h` 与 `template/Core/Src/user_app.c`（全文）**

`user_app.h`：

```c
#ifndef __USER_APP_H
#define __USER_APP_H

#include "main.h"

void user_setup(void);
void user_loop(void);

void Delay_ms(uint32_t ms);

#endif /* __USER_APP_H */
```

`user_app.c`：

```c
#include "user_app.h"

void Delay_ms(uint32_t ms)
{
    HAL_Delay(ms);
}
```

- [x] **Step 8: 写空的 `template/Core/Src/user_code.c`（全文）**

```c
/* user_code.c — 由积木生成器覆盖（M1 阶段先手写冒烟版） */
#include "user_app.h"

void user_setup(void)
{
}

void user_loop(void)
{
}
```

- [x] **Step 9: 写 `tools/env.sh` 和 `template/env.bat`（全文）**

`tools/env.sh`（在 Git Bash 里 `source tools/env.sh` 后所有命令可用）：

```bash
export CUBECLT="${CUBECLT:-/d/STM32CubeCLT_1.18.0}"
export PATH="$CUBECLT/CMake/bin:$CUBECLT/Ninja:$CUBECLT/GNU-tools-for-STM32/bin:$CUBECLT/STM32CubeProgrammer/bin:$PATH"
```

`template/env.bat`：

```bat
@echo off
rem 把 CubeCLT 工具链挂进 PATH（可用环境变量 CUBECLT 覆盖安装位置）
if not defined CUBECLT set CUBECLT=D:\STM32CubeCLT_1.18.0
set PATH=%CUBECLT%\CMake\bin;%CUBECLT%\Ninja;%CUBECLT%\GNU-tools-for-STM32\bin;%CUBECLT%\STM32CubeProgrammer\bin;%PATH%
```

- [x] **Step 10: 配置 + 编译（期望：一次通过）**

```bash
cd "F:/kakuns开源项目/stm32-blocks/template"
source ../tools/env.sh
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug -DCMAKE_TOOLCHAIN_FILE=cmake/arm-gcc-toolchain.cmake
cmake --build build
```

Expected: `[10/10] Linking C executable firmware.elf`，末尾 `arm-none-eabi-size` 输出 text 约 4–8KB，`Memory region Used Size Region Size` 两行。若报缺 HAL 模块符号（例如 `HAL_FLASH_...` 未定义），把缺的模块加进 `stm32f1xx_hal_conf.h` 的 `#define` 与 `CMakeLists.txt` 的 `HAL_SOURCES` 后重编。

**执行记录（2026-10-03）**：编译前修了两处裁剪遗漏——① 缺 `Inc/Legacy/stm32_hal_legacy.h`（已加入 Step 2 复制清单）；② `hal_conf.h` 缺 `HSI_VALUE` 定义（已加入 Step 3 清单）。修后一次通过：`[16/16] Linking C executable firmware`，FLASH 3392B / 64K（5.18%）、RAM 1584B / 20K（7.73%）；链接期 newlib `_close/_lseek/_read/_write not implemented` 与 RWX 段警告为标准输出，可忽略。③ **中文路径下 ninja 的自动 regen 会崩（0xC0000409）**：已在 CMakeLists 加 `CMAKE_SUPPRESS_REGENERATION`，且产物名修正为 `firmware.elf`——**改过 cmake 文件后必须显式跑一次 configure 再 build**。

- [ ] **Step 11: 真板烧录（待用户接板；2026-10-03 编译已过，仅差烧录观察）**

```bash
STM32_Programmer_CLI -c port=SWD -w build/firmware.elf -v -rst
```

Expected: 输出含 `Device ID : 0x410`（F103 medium-density）、`Download verified successfully`。此时板子无可见现象（空 loop），属正常。

- [x] **Step 12: Commit**

```bash
git add template tools && git commit -m "feat: CMake+Ninja 构建系统与最小 HAL 工程，编译烧录打通

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: bsp_common + bsp_led（LED 闪烁冒烟）

**Files:**
- Create: `template/Core/Inc/bsp_common.h`、`template/Core/Src/bsp_common.c`
- Create: `template/Core/Inc/bsp_led.h`、`template/Core/Src/bsp_led.c`
- Modify: `template/CMakeLists.txt`（CORE_SOURCES 加 bsp_common.c、bsp_led.c）
- Modify: `template/Core/Inc/user_app.h`（include 两个新头）
- Modify: `template/Core/Src/user_code.c`（冒烟 v1：LED 1Hz 闪烁）

**Interfaces:**
- Consumes: Task 2 构建系统。
- Produces（后续所有任务与 M2 生成器依赖的精确签名）：

```c
/* bsp_common.h */
typedef enum { ACTIVE_LOW = 0, ACTIVE_HIGH = 1 } ActiveLevel;
typedef enum { PULL_UP = 0, PULL_DOWN = 1 } KeyPull;
void Bsp_GpioClkEnable(GPIO_TypeDef *port);
/* bsp_led.h */
typedef struct { GPIO_TypeDef *port; uint16_t pin; ActiveLevel active; } Led;
void Led_Init(Led *l, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active);
void Led_On(Led *l);
void Led_Off(Led *l);
void Led_Toggle(Led *l);
```

- [x] **Step 1: 写 `bsp_common.h` / `bsp_common.c`（全文）**

`bsp_common.h`：

```c
#ifndef __BSP_COMMON_H
#define __BSP_COMMON_H

#include "main.h"

typedef enum { ACTIVE_LOW = 0, ACTIVE_HIGH = 1 } ActiveLevel;
typedef enum { PULL_UP = 0, PULL_DOWN = 1 } KeyPull;

void Bsp_GpioClkEnable(GPIO_TypeDef *port);

#endif /* __BSP_COMMON_H */
```

`bsp_common.c`：

```c
#include "bsp_common.h"

void Bsp_GpioClkEnable(GPIO_TypeDef *port)
{
    if (port == GPIOA) { __HAL_RCC_GPIOA_CLK_ENABLE(); }
    else if (port == GPIOB) { __HAL_RCC_GPIOB_CLK_ENABLE(); }
    else if (port == GPIOC) { __HAL_RCC_GPIOC_CLK_ENABLE(); }
    else if (port == GPIOD) { __HAL_RCC_GPIOD_CLK_ENABLE(); }
}
```

- [x] **Step 2: 写 `bsp_led.h` / `bsp_led.c`（全文）**

`bsp_led.h`：

```c
#ifndef __BSP_LED_H
#define __BSP_LED_H

#include "bsp_common.h"

typedef struct
{
    GPIO_TypeDef *port;
    uint16_t pin;
    ActiveLevel active;
} Led;

void Led_Init(Led *l, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active);
void Led_On(Led *l);
void Led_Off(Led *l);
void Led_Toggle(Led *l);

#endif /* __BSP_LED_H */
```

`bsp_led.c`：

```c
#include "bsp_led.h"

void Led_Init(Led *l, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active)
{
    l->port = port;
    l->pin = pin;
    l->active = active;

    Bsp_GpioClkEnable(port);

    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = pin;
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    gpio.Pull = GPIO_NOPULL;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(port, &gpio);

    Led_Off(l);
}

void Led_On(Led *l)
{
    HAL_GPIO_WritePin(l->port, l->pin,
                      (l->active == ACTIVE_HIGH) ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

void Led_Off(Led *l)
{
    HAL_GPIO_WritePin(l->port, l->pin,
                      (l->active == ACTIVE_HIGH) ? GPIO_PIN_RESET : GPIO_PIN_SET);
}

void Led_Toggle(Led *l)
{
    HAL_GPIO_TogglePin(l->port, l->pin);
}
```

- [x] **Step 3: 更新 `CMakeLists.txt`、`user_app.h`、`user_code.c`**

`CMakeLists.txt` 的 `CORE_SOURCES` 增加 `Core/Src/bsp_common.c` 与 `Core/Src/bsp_led.c`。
`user_app.h` 在 `#include "main.h"` 后增加：

```c
#include "bsp_common.h"
#include "bsp_led.h"
```

`user_code.c` 替换为冒烟 v1：

```c
/* user_code.c — 由积木生成器覆盖（M1 阶段先手写冒烟版） */
#include "user_app.h"

Led led1;

void user_setup(void)
{
    Led_Init(&led1, GPIOC, GPIO_PIN_13, ACTIVE_LOW);  /* 蓝药丸板载 LED，低电平亮 */
}

void user_loop(void)
{
    Led_Toggle(&led1);
    Delay_ms(500);
}
```

- [x] **Step 4: 编译**（2026-10-03 通过：`[6/6] Linking`，FLASH 4752B）

```bash
cd "F:/kakuns开源项目/stm32-blocks/template" && source ../tools/env.sh && cmake --build build
```

Expected: 链接成功，无 warning（bsp 文件在 -Wall 下也应零警告）。

- [ ] **Step 5: 烧录 + 真板验证**（待接板；编译已过，预期 LED 1Hz 闪烁）

```bash
STM32_Programmer_CLI -c port=SWD -w build/firmware.elf -v -rst
```

Expected: 板载 LED（PC13）约 1Hz 闪烁（亮 500ms 灭 500ms）。

- [x] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: bsp_common/bsp_led 驱动，板载 LED 闪烁冒烟通过

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: bsp_key（20ms 消抖，按键控灯）

**Files:**
- Create: `template/Core/Inc/bsp_key.h`、`template/Core/Src/bsp_key.c`
- Modify: `template/CMakeLists.txt`、`template/Core/Inc/user_app.h`、`template/Core/Src/user_code.c`

**Interfaces:**
- Consumes: `Bsp_GpioClkEnable`、`KeyPull`（Task 3）。
- Produces：

```c
typedef struct
{
    GPIO_TypeDef *port;
    uint16_t pin;
    KeyPull pull;
    uint8_t raw_last;         /* 最近一次原始读数（1=按下） */
    uint8_t stable;           /* 消抖后的稳定状态（1=按下） */
    uint32_t last_change_ms;  /* 原始电平最近一次变化的时刻 */
} Key;

void Key_Init(Key *k, GPIO_TypeDef *port, uint16_t pin, KeyPull pull);
uint8_t Key_IsPressed(Key *k);
uint8_t Key_IsReleased(Key *k);
```

- [x] **Step 1: 写 `bsp_key.h`（全文，结构体同上）**

```c
#ifndef __BSP_KEY_H
#define __BSP_KEY_H

#include "bsp_common.h"

typedef struct
{
    GPIO_TypeDef *port;
    uint16_t pin;
    KeyPull pull;
    uint8_t raw_last;
    uint8_t stable;
    uint32_t last_change_ms;
} Key;

void Key_Init(Key *k, GPIO_TypeDef *port, uint16_t pin, KeyPull pull);
uint8_t Key_IsPressed(Key *k);
uint8_t Key_IsReleased(Key *k);

#endif /* __BSP_KEY_H */
```

- [x] **Step 2: 写 `bsp_key.c`（全文）**

```c
#include "bsp_key.h"

static uint8_t key_read_pressed(Key *k)
{
    uint8_t level = HAL_GPIO_ReadPin(k->port, k->pin);
    if (k->pull == PULL_UP)
    {
        return (level == GPIO_PIN_RESET) ? 1U : 0U;  /* 上拉：按下读到低 */
    }
    return (level == GPIO_PIN_SET) ? 1U : 0U;        /* 下拉：按下读到高 */
}

static void key_update(Key *k)
{
    uint8_t raw = key_read_pressed(k);
    uint32_t now = HAL_GetTick();

    if (raw != k->raw_last)
    {
        k->raw_last = raw;
        k->last_change_ms = now;
    }
    else if (k->stable != raw && (now - k->last_change_ms) >= 20U)
    {
        k->stable = raw;  /* 稳定 20ms 才认为状态变化 */
    }
}

void Key_Init(Key *k, GPIO_TypeDef *port, uint16_t pin, KeyPull pull)
{
    k->port = port;
    k->pin = pin;
    k->pull = pull;

    Bsp_GpioClkEnable(port);

    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = pin;
    gpio.Mode = GPIO_MODE_INPUT;
    gpio.Pull = (pull == PULL_UP) ? GPIO_PULLUP : GPIO_PULLDOWN;
    HAL_GPIO_Init(port, &gpio);

    k->raw_last = 0U;
    k->stable = 0U;
    k->last_change_ms = HAL_GetTick();
}

uint8_t Key_IsPressed(Key *k)
{
    key_update(k);
    return k->stable;
}

uint8_t Key_IsReleased(Key *k)
{
    key_update(k);
    return (uint8_t)(k->stable ? 0U : 1U);
}
```

- [x] **Step 3: 更新 CMakeLists / user_app.h / user_code.c（冒烟：按住亮，松开灭）**

`CMakeLists.txt` 加 `Core/Src/bsp_key.c`；`user_app.h` 加 `#include "bsp_key.h"`；`user_code.c`：

```c
/* user_code.c — 由积木生成器覆盖（M1 阶段先手写冒烟版） */
#include "user_app.h"

Key key1;
Led led1;

void user_setup(void)
{
    Key_Init(&key1, GPIOA, GPIO_PIN_1, PULL_UP);
    Led_Init(&led1, GPIOC, GPIO_PIN_13, ACTIVE_LOW);
}

void user_loop(void)
{
    if (Key_IsPressed(&key1))
    {
        Led_On(&led1);
    }
    else
    {
        Led_Off(&led1);
    }
}
```

- [ ] **Step 4: 编译 + 烧录 + 真板验证**（编译已过：FLASH 5004B；烧录待接板）

```bash
cd "F:/kakuns开源项目/stm32-blocks/template" && source ../tools/env.sh && cmake --build build && STM32_Programmer_CLI -c port=SWD -w build/firmware.elf -v -rst
```

Expected：按住 PA1 按键 → LED 亮；松开 → 灭。快速连按不应闪烁抖动（消抖生效）。

- [x] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: bsp_key 按键驱动（20ms 消抖），按键控灯冒烟通过

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: bsp_buzzer（按键响蜂鸣器）

**Files:**
- Create: `template/Core/Inc/bsp_buzzer.h`、`template/Core/Src/bsp_buzzer.c`
- Modify: `template/CMakeLists.txt`、`template/Core/Inc/user_app.h`、`template/Core/Src/user_code.c`

**Interfaces:**
- Consumes: `ActiveLevel`、`Bsp_GpioClkEnable`。
- Produces：

```c
typedef struct { GPIO_TypeDef *port; uint16_t pin; ActiveLevel active; } Buzzer;
void Buzzer_Init(Buzzer *b, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active);
void Buzzer_On(Buzzer *b);
void Buzzer_Off(Buzzer *b);
void Buzzer_Toggle(Buzzer *b);
```

- [ ] **Step 1: 写 `bsp_buzzer.h` / `bsp_buzzer.c`（全文；结构体与签名照上，实现与 bsp_led 同型，函数改名）**

```c
/* bsp_buzzer.h */
#ifndef __BSP_BUZZER_H
#define __BSP_BUZZER_H

#include "bsp_common.h"

typedef struct
{
    GPIO_TypeDef *port;
    uint16_t pin;
    ActiveLevel active;
} Buzzer;

void Buzzer_Init(Buzzer *b, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active);
void Buzzer_On(Buzzer *b);
void Buzzer_Off(Buzzer *b);
void Buzzer_Toggle(Buzzer *b);

#endif /* __BSP_BUZZER_H */
```

```c
/* bsp_buzzer.c */
#include "bsp_buzzer.h"

void Buzzer_Init(Buzzer *b, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active)
{
    b->port = port;
    b->pin = pin;
    b->active = active;

    Bsp_GpioClkEnable(port);

    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = pin;
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    gpio.Pull = GPIO_NOPULL;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(port, &gpio);

    Buzzer_Off(b);
}

void Buzzer_On(Buzzer *b)
{
    HAL_GPIO_WritePin(b->port, b->pin,
                      (b->active == ACTIVE_HIGH) ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

void Buzzer_Off(Buzzer *b)
{
    HAL_GPIO_WritePin(b->port, b->pin,
                      (b->active == ACTIVE_HIGH) ? GPIO_PIN_RESET : GPIO_PIN_SET);
}

void Buzzer_Toggle(Buzzer *b)
{
    HAL_GPIO_TogglePin(b->port, b->pin);
}
```

- [ ] **Step 2: 更新 CMakeLists / user_app.h / user_code.c（冒烟：按键→蜂鸣器）**

`CMakeLists.txt` 加 `Core/Src/bsp_buzzer.c`；`user_app.h` 加 `#include "bsp_buzzer.h"`；`user_code.c` 在 Task 4 基础上加：

```c
Buzzer buzzer1;
/* user_setup 中加： */
Buzzer_Init(&buzzer1, GPIOB, GPIO_PIN_1, ACTIVE_LOW);
/* user_loop 的 if 分支加：Buzzer_On(&buzzer1); else 分支加：Buzzer_Off(&buzzer1); */
```

- [ ] **Step 3: 编译 + 烧录 + 真板验证**

同 Task 4 的一条龙命令。Expected：按住按键 → 蜂鸣器响（LED 同时亮），松开 → 停。
（若蜂鸣器模块是高电平触发款：把 `ACTIVE_LOW` 改 `ACTIVE_HIGH` 再验证，然后改回——生成器以后会按界面选项生成。）

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: bsp_buzzer 蜂鸣器驱动，按键响铃冒烟通过

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: bsp_servo（PWM，按键摆舵机）

**Files:**
- Create: `template/Core/Inc/bsp_servo.h`、`template/Core/Src/bsp_servo.c`
- Modify: `template/CMakeLists.txt`、`template/Core/Inc/user_app.h`、`template/Core/Src/user_code.c`

**Interfaces:**
- Consumes: `Bsp_GpioClkEnable`。
- Produces：

```c
typedef struct
{
    TIM_TypeDef *tim;
    uint32_t ch;
    TIM_HandleTypeDef *htim;   /* 同一 TIM 上的舵机共享（驱动内部管理） */
} Servo;

void Servo_Init(Servo *s, TIM_TypeDef *tim, uint32_t channel);
void Servo_Write(Servo *s, uint8_t angle);   /* 0-180，越界自动钳位 */
```

- [ ] **Step 1: 写 `bsp_servo.h`（全文）**

```c
#ifndef __BSP_SERVO_H
#define __BSP_SERVO_H

#include "bsp_common.h"

typedef struct
{
    TIM_TypeDef *tim;
    uint32_t ch;
    TIM_HandleTypeDef *htim;
} Servo;

void Servo_Init(Servo *s, TIM_TypeDef *tim, uint32_t channel);
void Servo_Write(Servo *s, uint8_t angle);

#endif /* __BSP_SERVO_H */
```

- [ ] **Step 2: 写 `bsp_servo.c`（全文）**

```c
#include "bsp_servo.h"

/* F103C8T6 可出 PWM 的 16 个通道 → 引脚映射（与界面下拉一一对应） */
typedef struct
{
    TIM_TypeDef *tim;
    uint32_t ch;
    GPIO_TypeDef *port;
    uint16_t pin;
} ServoPinMap;

static const ServoPinMap SERVO_PIN_MAP[] = {
    {TIM1, TIM_CHANNEL_1, GPIOA, GPIO_PIN_8},
    {TIM1, TIM_CHANNEL_2, GPIOA, GPIO_PIN_9},
    {TIM1, TIM_CHANNEL_3, GPIOA, GPIO_PIN_10},
    {TIM1, TIM_CHANNEL_4, GPIOA, GPIO_PIN_11},
    {TIM2, TIM_CHANNEL_1, GPIOA, GPIO_PIN_0},
    {TIM2, TIM_CHANNEL_2, GPIOA, GPIO_PIN_1},
    {TIM2, TIM_CHANNEL_3, GPIOA, GPIO_PIN_2},
    {TIM2, TIM_CHANNEL_4, GPIOA, GPIO_PIN_3},
    {TIM3, TIM_CHANNEL_1, GPIOA, GPIO_PIN_6},
    {TIM3, TIM_CHANNEL_2, GPIOA, GPIO_PIN_7},
    {TIM3, TIM_CHANNEL_3, GPIOB, GPIO_PIN_0},
    {TIM3, TIM_CHANNEL_4, GPIOB, GPIO_PIN_1},
    {TIM4, TIM_CHANNEL_1, GPIOB, GPIO_PIN_6},
    {TIM4, TIM_CHANNEL_2, GPIOB, GPIO_PIN_7},
    {TIM4, TIM_CHANNEL_3, GPIOB, GPIO_PIN_8},
    {TIM4, TIM_CHANNEL_4, GPIOB, GPIO_PIN_9},
};

/* 每个 TIM 一套句柄（同 TIM 多舵机只初始化一次） */
static TIM_HandleTypeDef htim[4];
static uint8_t tim_inited[4];

static int tim_index(TIM_TypeDef *tim)
{
    if (tim == TIM1) { return 0; }
    if (tim == TIM2) { return 1; }
    if (tim == TIM3) { return 2; }
    if (tim == TIM4) { return 3; }
    return -1;
}

static const ServoPinMap *find_map(TIM_TypeDef *tim, uint32_t ch)
{
    for (unsigned i = 0; i < sizeof(SERVO_PIN_MAP) / sizeof(SERVO_PIN_MAP[0]); i++)
    {
        if (SERVO_PIN_MAP[i].tim == tim && SERVO_PIN_MAP[i].ch == ch)
        {
            return &SERVO_PIN_MAP[i];
        }
    }
    return 0;
}

void Servo_Init(Servo *s, TIM_TypeDef *tim, uint32_t channel)
{
    const ServoPinMap *map = find_map(tim, channel);
    int idx = tim_index(tim);
    if (map == 0 || idx < 0)
    {
        Error_Handler();  /* 生成器只会传表内通道，走到这里说明代码错了 */
    }

    /* 1) 定时器第一次用时：72MHz → 1µs 计数、20ms 周期（50Hz） */
    if (!tim_inited[idx])
    {
        switch (idx)
        {
            case 0: __HAL_RCC_TIM1_CLK_ENABLE(); break;
            case 1: __HAL_RCC_TIM2_CLK_ENABLE(); break;
            case 2: __HAL_RCC_TIM3_CLK_ENABLE(); break;
            case 3: __HAL_RCC_TIM4_CLK_ENABLE(); break;
        }

        htim[idx].Instance = tim;
        htim[idx].Init.Prescaler = 71;
        htim[idx].Init.CounterMode = TIM_COUNTERMODE_UP;
        htim[idx].Init.Period = 19999;
        htim[idx].Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
        htim[idx].Init.AutoReloadPreload = TIM_AUTORELOAD_PRELOAD_ENABLE;
        if (HAL_TIM_Base_Init(&htim[idx]) != HAL_OK)
        {
            Error_Handler();
        }
        if (HAL_TIM_PWM_Init(&htim[idx]) != HAL_OK)
        {
            Error_Handler();
        }
        tim_inited[idx] = 1U;
    }

    s->tim = tim;
    s->ch = channel;
    s->htim = &htim[idx];

    /* 2) 通道配置：PWM1，中位 1500µs 起步避免抽搐 */
    TIM_OC_InitTypeDef oc = {0};
    oc.OCMode = TIM_OCMODE_PWM1;
    oc.Pulse = 1500;
    oc.OCPolarity = TIM_OCPOLARITY_HIGH;
    oc.OCFastMode = TIM_OCFAST_DISABLE;
    if (HAL_TIM_PWM_ConfigChannel(s->htim, &oc, channel) != HAL_OK)
    {
        Error_Handler();
    }
    if (HAL_TIM_PWM_Start(s->htim, channel) != HAL_OK)
    {
        Error_Handler();
    }

    /* 3) 引脚复用输出（本工程不用重映射，默认通道映射） */
    Bsp_GpioClkEnable(map->port);
    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = map->pin;
    gpio.Mode = GPIO_MODE_AF_PP;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(map->port, &gpio);
}

void Servo_Write(Servo *s, uint8_t angle)
{
    if (angle > 180U)
    {
        angle = 180U;
    }
    uint32_t ccr = 500U + (uint32_t)angle * 2000U / 180U;  /* 0.5–2.5ms */
    __HAL_TIM_SET_COMPARE(s->htim, s->ch, ccr);
}
```

- [ ] **Step 3: 更新 CMakeLists / user_app.h / user_code.c（冒烟：按键按下舵机回中 90°，松开 0°）**

`CMakeLists.txt` 加 `Core/Src/bsp_servo.c`；`user_app.h` 加 `#include "bsp_servo.h"`；`user_code.c` 加 `Servo servo1;`、`Servo_Init(&servo1, TIM2, TIM_CHANNEL_1);`（PA0），if 分支加 `Servo_Write(&servo1, 90);`，else 分支加 `Servo_Write(&servo1, 0);`。

- [ ] **Step 4: 编译 + 烧录 + 真板验证（舵机信号线接 PA0，5V 供电）**

一条龙命令同 Task 4。Expected：按住 → 舵机转 90°；松开 → 0°。若舵机抖动/不动：检查共地、供电 5V、信号 PA0。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: bsp_servo 舵机驱动（50Hz/0.5-2.5ms），按键摆舵机冒烟通过

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: VSCode 配置 + 一键脚本 + 说明文档 + 组合冒烟

**Files:**
- Create: `template/.vscode/{tasks.json, launch.json, settings.json, c_cpp_properties.json}`
- Create: `template/编译烧录.bat`
- Create: `template/使用说明.md`
- Modify: `template/Core/Src/user_code.c`（最终组合冒烟）

**Interfaces:**
- Consumes: 前面所有任务。
- Produces: 现场"打开 → F5 → 板子动"的完整闭环；`使用说明.md` 三步文档；后续 M2 打包器要原样打进 zip 的全部文件。

- [ ] **Step 1: 写 `.vscode/tasks.json`（全文）**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build",
      "type": "shell",
      "command": "cmd",
      "args": ["/c", "env.bat && cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Debug -DCMAKE_TOOLCHAIN_FILE=cmake/arm-gcc-toolchain.cmake && cmake --build build"],
      "options": { "cwd": "${workspaceFolder}" },
      "problemMatcher": ["$gcc"],
      "group": { "kind": "build", "isDefault": true }
    },
    {
      "label": "Build and Flash",
      "dependsOn": "Build",
      "type": "shell",
      "command": "cmd",
      "args": ["/c", "env.bat && STM32_Programmer_CLI -c port=SWD -w build\\firmware.elf -v -rst"],
      "options": { "cwd": "${workspaceFolder}" },
      "problemMatcher": []
    }
  ]
}
```

- [ ] **Step 2: 写 `.vscode/launch.json`（全文）**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug (ST-Link)",
      "type": "cortex-debug",
      "request": "launch",
      "servertype": "stlink-gdb-server",
      "cwd": "${workspaceFolder}",
      "executable": "${workspaceFolder}/build/firmware.elf",
      "stlinkGdbServerPath": "D:/STM32CubeCLT_1.18.0/STLink-gdb-server/bin/ST-LINK_gdbserver.exe",
      "stm32cubeprogrammer": "D:/STM32CubeCLT_1.18.0/STM32CubeProgrammer/bin",
      "interface": "swd",
      "device": "STM32F103C8",
      "runToEntryPoint": "main",
      "preLaunchTask": "Build and Flash"
    }
  ]
}
```

（若 Cortex-Debug 版本不认 `stlinkGdbServerPath`/`stm32cubeprogrammer` 键名，按其报错提示改为对应键名；烧录已由 preLaunchTask 完成，即使调试器不参与下载也不影响。）

- [ ] **Step 3: 写 `.vscode/settings.json` 与 `.vscode/c_cpp_properties.json`（全文）**

`settings.json`：

```json
{
  "files.exclude": { "build": true },
  "terminal.integrated.env.windows": {
    "PATH": "D:\\STM32CubeCLT_1.18.0\\CMake\\bin;D:\\STM32CubeCLT_1.18.0\\Ninja;D:\\STM32CubeCLT_1.18.0\\GNU-tools-for-STM32\\bin;D:\\STM32CubeCLT_1.18.0\\STM32CubeProgrammer\\bin;${env:PATH}"
  }
}
```

`c_cpp_properties.json`：

```json
{
  "configurations": [
    {
      "name": "STM32",
      "includePath": [
        "${workspaceFolder}/Core/Inc",
        "${workspaceFolder}/Drivers/STM32F1xx_HAL_Driver/Inc",
        "${workspaceFolder}/Drivers/CMSIS/Device/ST/STM32F1xx/Include",
        "${workspaceFolder}/Drivers/CMSIS/Core/Include"
      ],
      "defines": ["STM32F103xB", "USE_HAL_DRIVER"],
      "compilerPath": "D:/STM32CubeCLT_1.18.0/GNU-tools-for-STM32/bin/arm-none-eabi-gcc.exe",
      "cStandard": "c99",
      "intelliSenseMode": "gcc-arm"
    }
  ],
  "version": 4
}
```

- [ ] **Step 4: 写 `template/编译烧录.bat`（全文）**

```bat
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
```

- [ ] **Step 5: 写 `template/使用说明.md`（全文）**

```markdown
# 使用说明（三步）

1. 用 VSCode 打开本文件夹（File → Open Folder）。
2. 把 ST-Link 和板子接好，板子通电。
3. 按 F5（自动编译 + 烧录 + 调试），或双击「编译烧录.bat」。

## 接线参考

| 外设 | 接法 |
|---|---|
| 按键 | 一端 → PA1，另一端 → GND |
| 蜂鸣器（有源） | 模块 VCC→3V3、GND→GND、信号→PB1 |
| 舵机 | 信号→PA0，VCC→5V，GND→GND（与板子共地） |
| 板载 LED | 无需接线（PC13，低电平亮） |

## 常见问题

- 烧录失败：检查 ST-Link 驱动、SWD 四根线、板子供电。
- 快捷键想换成别的：编译烧录.bat 双击即可。
```

- [ ] **Step 6: 最终组合冒烟 `user_code.c`（全文）**

```c
/* user_code.c — 由积木生成器覆盖（M1 阶段先手写冒烟版） */
#include "user_app.h"

Key    key1;
Led    led1;
Buzzer buzzer1;
Servo  servo1;

void user_setup(void)
{
    Key_Init(&key1, GPIOA, GPIO_PIN_1, PULL_UP);
    Led_Init(&led1, GPIOC, GPIO_PIN_13, ACTIVE_LOW);
    Buzzer_Init(&buzzer1, GPIOB, GPIO_PIN_1, ACTIVE_LOW);
    Servo_Init(&servo1, TIM2, TIM_CHANNEL_1);
}

void user_loop(void)
{
    if (Key_IsPressed(&key1)) {
        Led_On(&led1);
        Buzzer_On(&buzzer1);
        Servo_Write(&servo1, 90);
    } else {
        Led_Off(&led1);
        Buzzer_Off(&buzzer1);
        Servo_Write(&servo1, 0);
        Delay_ms(20);
    }
}
```

- [ ] **Step 7: 全流程验证（M1 验收）**

1. VSCode 打开 `template/` → F5 → 观察：编译输出、烧录成功、程序停在 main。
2. 按住按键：LED 亮 + 蜂鸣器响 + 舵机 90°；松开：全复位。反复 10 次无异常。
3. 双击 `编译烧录.bat` → 同样效果（不开 VSCode 的路径）。
4. 在启动调试状态下点 VSCode 的暂停 → 能看到停在某行 C 代码（Cortex-Debug 正常）。

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: VSCode 配置/一键烧录脚本/使用说明 + 组合冒烟，M1 验收通过

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## M1 完成标准（验收清单）

- [ ] `template/` 完整：CubeCLT 一条命令可编译（0 error），`build/firmware.elf` 生成
- [ ] ST-Link 可烧录，`STM32_Programmer_CLI` 输出 `Download verified successfully`
- [ ] 组合冒烟在真板跑通（按键→LED+蜂鸣器+舵机）
- [ ] VSCode F5 与 `编译烧录.bat` 两条路径都可用
- [ ] BSP 四个驱动 API 与设计文档 §4.5 完全一致（M2 生成器将按此生成代码）

## M2 接口冻结（本计划交付给 M2 的契约）

```c
Key_Init(&key1, GPIOA, GPIO_PIN_1, PULL_UP);          /* KeyPull: PULL_UP/PULL_DOWN */
Led_Init(&led1, GPIOC, GPIO_PIN_13, ACTIVE_LOW);      /* ActiveLevel: ACTIVE_LOW/ACTIVE_HIGH */
Buzzer_Init(&buzzer1, GPIOB, GPIO_PIN_1, ACTIVE_LOW);
Servo_Init(&servo1, TIM2, TIM_CHANNEL_1);             /* 仅限 16 通道表 */
Key_IsPressed(&key1); Key_IsReleased(&key1);          /* 含 20ms 消抖 */
Led_On/Off/Toggle(&led1); Buzzer_On/Off/Toggle(&buzzer1);
Servo_Write(&servo1, 90);                             /* 0-180 自动钳位 */
Delay_ms(200);
```
