#ifndef __BSP_SSD1306_H
#define __BSP_SSD1306_H

#include "bsp_common.h"

/* SSD1306 128x64 OLED low-level driver (software-I2C, debug instrument).
   Auto-detects SCL/SDA order on PB8/PB9 and address 0x3C/0x3D.
   App-level simplified API: bsp_oled.h (Oled_ShowText / ShowInt / Marquee). */

uint8_t SSD1306_Init(void);                     /* 1 = found & initialized */
uint8_t SSD1306_Ok(void);
uint8_t SSD1306_LineStates(void);               /* bit1=SDA bit0=SCL 实际电平 */
void SSD1306_Clear(void);
void SSD1306_Text(uint8_t line, const char *s); /* line 0-7, ASCII (upper) */
void SSD1306_Refresh(void);
void SSD1306_Pixel(uint8_t x, uint8_t y, uint8_t on);   /* 画点（越界安全） */
const uint8_t *SSD1306_Glyph(char c);           /* 5 字节列码字形；未知字符=空格 */

#endif /* __BSP_SSD1306_H */
