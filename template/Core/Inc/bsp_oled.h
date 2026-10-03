#ifndef __BSP_OLED_H
#define __BSP_OLED_H

#include "bsp_common.h"

/* 简化显示层：每次调用只显示一样东西（先清屏，再居中大字体）。
   硬件固定为 SSD1306 128x64 软 I2C（PB8/PB9，自动识别线序/地址）。
   底层驱动见 bsp_ssd1306.h。 */

typedef struct
{
    uint8_t ready;   /* 1 = 初始化时找到屏幕 */
} Oled;

uint8_t Oled_Init(Oled *o);
void Oled_ShowText(Oled *o, const char *text);   /* 大字居中：YES / NO / LOW / HIGH 等 */
void Oled_ShowInt(Oled *o, int value);           /* 大字显示整数（可负） */
void Oled_Marquee(Oled *o, int progress);        /* 外圈跑马灯 0-100，100=跑满；越界自动钳位 */

#endif /* __BSP_OLED_H */
