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
