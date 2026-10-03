/* stm32f1xx_it.c — 中断服务函数（CubeMX 惯例文件）
 * 注意：STM32Cube HAL 不自带 SysTick_Handler（由 CubeMX 生成在本文件里），
 * 缺了它弱符号默认处理程序（死循环）会兜底 —— 芯片开机约 1ms 后
 * 第一次 SysTick 就永久死循环（症状：整板无声无息，LED 不闪）。
 */
#include "main.h"

/* SysTick：1ms 心跳，HAL_Delay / HAL_GetTick 依赖它 */
void SysTick_Handler(void)
{
    HAL_IncTick();
}
