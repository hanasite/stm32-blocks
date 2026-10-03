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
