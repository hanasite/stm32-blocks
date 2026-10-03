#include "bsp_oled.h"
#include "bsp_ssd1306.h"
#include <stdio.h>
#include <string.h>

#define SCR_W 128
#define SCR_H 64
#define RING_W 5                                  /* 跑马灯宽度（像素） */
#define RING_STEPS (2 * (SCR_W + SCR_H) - 4)      /* 外圈总步数 = 380 */

/* ---------- 大字：5x7 字形整数倍放大，自适应最大倍数 ---------- */

static uint8_t big_scale(size_t len)
{
    uint8_t s = 8;
    if (len == 0) { return 1; }
    while (s > 1 && (len * 6 - 1) * s > (SCR_W - 8)) { s--; }
    return s;
}

static void draw_big_text_max(const char *s, uint8_t max_scale)
{
    size_t len = strlen(s);
    if (len > 20) { len = 20; }
    uint8_t scale = big_scale(len);
    if (scale > max_scale) { scale = max_scale; }
    int w = (int)(len * 6 - 1) * scale;
    int x0 = (SCR_W - w) / 2;
    int y0 = (SCR_H - 7 * scale) / 2;

    for (size_t ci = 0; ci < len; ci++)
    {
        const uint8_t *g = SSD1306_Glyph(s[ci]);
        for (uint8_t col = 0; col < 5; col++)
        {
            for (uint8_t row = 0; row < 7; row++)
            {
                if (g[col] & (uint8_t)(1u << row))
                {
                    int px = x0 + (int)(ci * 6 + col) * scale;
                    int py = y0 + row * scale;
                    for (uint8_t i = 0; i < scale; i++)
                    {
                        for (uint8_t j = 0; j < scale; j++)
                        {
                            SSD1306_Pixel((uint8_t)(px + i), (uint8_t)(py + j), 1);
                        }
                    }
                }
            }
        }
    }
}

static void draw_big_text(const char *s)
{
    draw_big_text_max(s, 8);
}

/* ---------- 跑马灯：外圈 380 步，从正上方（顶部中央）顺时针 ---------- */
/* 每步把一个外圈像素及其朝屏内 5px 的一段画亮。 */

static void draw_ring_step(int step)
{
    if (step < 64)              /* 顶行右半：x=64..127, y=0 */
    {
        uint8_t x = (uint8_t)(64 + step);
        for (uint8_t i = 0; i < RING_W; i++) { SSD1306_Pixel(x, i, 1); }
    }
    else if (step < 127)        /* 右列：x=127, y=1..63 */
    {
        uint8_t y = (uint8_t)(step - 64 + 1);
        for (uint8_t i = 0; i < RING_W; i++) { SSD1306_Pixel((uint8_t)(SCR_W - 1 - i), y, 1); }
    }
    else if (step < 254)        /* 底行（右→左）：y=63, x=126..0 */
    {
        uint8_t x = (uint8_t)(126 - (step - 127));
        for (uint8_t i = 0; i < RING_W; i++) { SSD1306_Pixel(x, (uint8_t)(SCR_H - 1 - i), 1); }
    }
    else if (step < 317)        /* 左列（下→上）：x=0, y=62..0 */
    {
        uint8_t y = (uint8_t)(62 - (step - 254));
        for (uint8_t i = 0; i < RING_W; i++) { SSD1306_Pixel(i, y, 1); }
    }
    else                        /* 顶行左半：y=0, x=1..63 */
    {
        uint8_t x = (uint8_t)(1 + (step - 317));
        for (uint8_t i = 0; i < RING_W; i++) { SSD1306_Pixel(x, i, 1); }
    }
}

uint8_t Oled_Init(Oled *o)
{
    o->ready = SSD1306_Init();
    return o->ready;
}

void Oled_ShowText(Oled *o, const char *text)
{
    if (!o->ready) { return; }
    SSD1306_Clear();
    draw_big_text(text);
    SSD1306_Refresh();
}

void Oled_ShowInt(Oled *o, int value)
{
    char tmp[16];
    snprintf(tmp, sizeof(tmp), "%d", value);
    Oled_ShowText(o, tmp);
}

void Oled_Marquee(Oled *o, int progress)
{
    if (!o->ready) { return; }
    if (progress < 0) { progress = 0; }        /* 防溢出钳位 */
    if (progress > 100) { progress = 100; }
    SSD1306_Clear();
    int lit = progress * RING_STEPS / 100;
    for (int k = 0; k < lit; k++) { draw_ring_step(k); }
    char tmp[8];
    snprintf(tmp, sizeof(tmp), "%d", progress);
    draw_big_text_max(tmp, 6);                 /* 中间大字体显示数值（上限 6 不压灯圈） */
    SSD1306_Refresh();
}
