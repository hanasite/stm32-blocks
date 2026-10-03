#ifndef __BSP_SSD1306_H
#define __BSP_SSD1306_H

#include "bsp_common.h"

/* Software-I2C driver for SSD1306 128x64 OLED (debug instrument).
   Auto-detects SCL/SDA order on PB8/PB9 and address 0x3C/0x3D. */

uint8_t Oled_Init(void);                        /* 1 = found & initialized */
uint8_t Oled_Ok(void);
uint8_t Oled_LineStates(void);                  /* bit1=SDA bit0=SCL 实际电平 */
void Oled_Clear(void);
void Oled_Text(uint8_t line, const char *s);    /* line 0-7, ASCII (upper) */
void Oled_Refresh(void);

#endif /* __BSP_SSD1306_H */
