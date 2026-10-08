#include "bsp_common.h"

/* ---------------------------------------------------------------------------
 * 防伪标记（安理航科 · STM32 积木工坊）
 * 位于 .anli_mark 段，链接脚本 KEEP 保证 --gc-sections 下仍保留在固件镜像中。
 * 检索方式：
 *   strings firmware.bin | grep ANLI-HK          （ASCII 标签）
 *   grep -a 安理航科 firmware.bin                 （中文原名，UTF-8 字节匹配）
 * 任何由本套模板编译出的固件都会携带此标记，用于溯源与防伪。
 * ------------------------------------------------------------------------- */
__attribute__((used, section(".anli_mark")))
const char BSP_MARK_ANLI_HK[] = "ANLI-HK-AUST | 安理航科 STM32 积木工坊";

void Bsp_GpioClkEnable(GPIO_TypeDef *port)
{
    if (port == GPIOA) { __HAL_RCC_GPIOA_CLK_ENABLE(); }
    else if (port == GPIOB) { __HAL_RCC_GPIOB_CLK_ENABLE(); }
    else if (port == GPIOC) { __HAL_RCC_GPIOC_CLK_ENABLE(); }
    else if (port == GPIOD) { __HAL_RCC_GPIOD_CLK_ENABLE(); }
}
