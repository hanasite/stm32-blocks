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
