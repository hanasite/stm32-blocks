#ifndef __USER_APP_H
#define __USER_APP_H

#include "main.h"
#include "bsp_common.h"
#include "bsp_led.h"
#include "bsp_key.h"

void user_setup(void);
void user_loop(void);

void Delay_ms(uint32_t ms);

#endif /* __USER_APP_H */
