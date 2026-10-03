#ifndef __BSP_COMMON_H
#define __BSP_COMMON_H

#include "main.h"

typedef enum { ACTIVE_LOW = 0, ACTIVE_HIGH = 1 } ActiveLevel;
typedef enum { PULL_UP = 0, PULL_DOWN = 1 } KeyPull;

void Bsp_GpioClkEnable(GPIO_TypeDef *port);

#endif /* __BSP_COMMON_H */
