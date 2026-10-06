#ifndef __BSP_IR_H
#define __BSP_IR_H

#include "bsp_common.h"

/* 红外传感器（数字输出模块）。
   模块输出干净的高低电平，不做消抖；active 表示"检测到"时模块输出的电平。 */
typedef struct
{
    GPIO_TypeDef *port;
    uint16_t pin;
    ActiveLevel active;
} Ir;

void Ir_Init(Ir *ir, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active);
uint8_t Ir_IsTriggered(Ir *ir);   /* 1 = 检测到 */
uint8_t Ir_IsIdle(Ir *ir);        /* 1 = 未检测到 */

#endif /* __BSP_IR_H */
