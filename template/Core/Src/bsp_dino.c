#include "bsp_dino.h"
#include "bsp_ssd1306.h"
#include <stdio.h>

#define GROUND_Y     56    /* 地面线 */
#define DINO_X       10    /* 恐龙左边缘 */
#define CACTUS_W     8
#define SPEED        52    /* 仙人掌左移速度 px/s */
#define JUMP_VY      115   /* 起跳速度 px/s（峰高 ≈20px，足够越过 15px 仙人掌） */
#define GRAVITY      320   /* 重力 px/s^2 */
#define CRASH_MS     900   /* 撞毁后停顿时长 */

static uint32_t lcg(Dino *d)
{
    d->rng = d->rng * 1664525u + 1013904223u;
    return d->rng >> 16;
}

static void fill_rect(int16_t x, int16_t y, int16_t w, int16_t h)
{
    for (int16_t i = 0; i < w; i++)
    {
        for (int16_t j = 0; j < h; j++)
        {
            int16_t px = (int16_t)(x + i), py = (int16_t)(y + j);
            if (px < 0 || px > 127 || py < 0 || py > 63) { continue; }
            SSD1306_Pixel((uint8_t)px, (uint8_t)py, 1);
        }
    }
}

static void draw_ground(void)
{
    for (uint8_t x = 0; x < 128; x = (uint8_t)(x + 4)) { SSD1306_Pixel(x, GROUND_Y, 1); }
}

static void draw_dino(Dino *d)
{
    int16_t dy = d->y;
    int16_t base = GROUND_Y;

    fill_rect(DINO_X + 1, base - 13 - dy, 10, 12);   /* 身体 */
    fill_rect(DINO_X + 6, base - 20 - dy, 9, 8);     /* 头 */
    SSD1306_Pixel((uint8_t)(DINO_X + 12), (uint8_t)(base - 18 - dy), 0);   /* 眼睛（挖空） */
    fill_rect(DINO_X - 5, base - 10 - dy, 6, 3);     /* 尾巴 */

    if (d->jumping)
    {
        fill_rect(DINO_X + 3, base - 3 - dy, 3, 3);  /* 腿收起 */
        fill_rect(DINO_X + 8, base - 3 - dy, 3, 3);
    }
    else
    {
        fill_rect(DINO_X + 3, base - (d->leg_phase ? 3 : 5), 3, d->leg_phase ? 3 : 5);
        fill_rect(DINO_X + 8, base - (d->leg_phase ? 5 : 3), 3, d->leg_phase ? 5 : 3);
    }

    if (!d->alive)   /* 撞毁：头顶画个 × */
    {
        int16_t cx = DINO_X + 10, cy = base - 26 - dy;
        for (int16_t i = 0; i < 4; i++)
        {
            SSD1306_Pixel((uint8_t)(cx - 2 + i), (uint8_t)(cy - 2 + i), 1);
            SSD1306_Pixel((uint8_t)(cx - 2 + i), (uint8_t)(cy + 2 - i), 1);
        }
    }
}

static void draw_cactus(Dino *d)
{
    int16_t x = d->cactus_x;
    fill_rect(x + 1, GROUND_Y - 15, 4, 15);    /* 主干 */
    fill_rect(x - 2, GROUND_Y - 10, 3, 6);     /* 左臂 */
    fill_rect(x - 1, GROUND_Y - 6, 3, 2);
    fill_rect(x + 5, GROUND_Y - 12, 3, 6);     /* 右臂 */
    fill_rect(x + 4, GROUND_Y - 8, 3, 2);
}

static void dino_revive(Dino *d, uint32_t now)
{
    d->alive = 1;
    d->y = 0;
    d->vy = 0;
    d->jumping = 0;
    d->cactus_x = (int16_t)(128 + 30 + (int16_t)(lcg(d) % 80));
    d->last_jump_ms = now;
    d->last_tick_ms = now;
}

void Dino_Init(Dino *d)
{
    d->y = 0;
    d->vy = 0;
    d->jumping = 0;
    d->alive = 1;
    d->cactus_x = 110;
    d->score = 0;
    d->last_jump_ms = 0;
    d->crash_ms = 0;
    d->rng = 0x1234ABCDu ^ HAL_GetTick();
    d->last_tick_ms = HAL_GetTick();
    d->leg_phase = 0;
}

void Dino_Frame(Dino *d, Oled *oled, uint8_t jump_pressed)
{
    if (!oled || !oled->ready) { return; }

    uint32_t now = HAL_GetTick();
    uint32_t dt = now - d->last_tick_ms;
    if (dt > 100) { dt = 100; }               /* 卡顿保护 */
    d->last_tick_ms = now;

    if (d->alive)
    {
        /* 跳跃：输入 + 已落地 + 冷却期 */
        if (jump_pressed && !d->jumping && (now - d->last_jump_ms) >= DINO_COOLDOWN_MS)
        {
            d->vy = JUMP_VY;
            d->jumping = 1;
            d->last_jump_ms = now;
        }

        if (d->jumping)
        {
            d->y += (int16_t)((d->vy * (int32_t)dt) / 1000);
            d->vy -= (int16_t)((GRAVITY * (int32_t)dt) / 1000);
            if (d->y <= 0) { d->y = 0; d->vy = 0; d->jumping = 0; }
        }

        d->cactus_x -= (int16_t)((SPEED * (int32_t)dt) / 1000);
        if (d->cactus_x < -CACTUS_W - 2)
        {
            d->cactus_x = (int16_t)(128 + 20 + (int16_t)(lcg(d) % 70));
            d->score++;
        }

        /* 碰撞：最低像素 (55 - y) 与仙人掌顶 (GROUND_Y-15=41) 相交则算撞；
           留 1 行擦边豁免 -> y >= 14 视为已越过 */
        if (d->cactus_x < DINO_X + 16 && d->cactus_x + CACTUS_W > DINO_X && d->y < 14)
        {
            d->alive = 0;
            d->crash_ms = now;
        }

        d->leg_phase = (uint8_t)((now / 90) & 1);
    }
    else if (now - d->crash_ms > CRASH_MS)
    {
        dino_revive(d, now);
    }

    /* 绘制 */
    char score[8];
    SSD1306_Clear();
    draw_ground();
    snprintf(score, sizeof(score), "%u", (unsigned)d->score);
    SSD1306_Text(0, score);
    draw_cactus(d);
    draw_dino(d);
    SSD1306_Refresh();
}
