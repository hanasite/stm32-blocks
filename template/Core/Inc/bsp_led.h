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
