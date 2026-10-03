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
