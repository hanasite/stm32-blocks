#ifndef __BSP_DINO_H
#define __BSP_DINO_H

#include "bsp_common.h"
#include "bsp_oled.h"

/* 小恐龙游戏引擎（组件）：主循环里每帧调 Dino_Frame()。
   - 跳跃：jump_pressed=1 且已落地、且距上次起跳 >= DINO_COOLDOWN_MS（冷却期）时起跳
   - 撞上仙人掌后停 DINO_CRASH_MS 自动复活（分数保留）
   - 每帧整屏重绘（先清屏），与"每次只显示一样"的显示约定一致 */

#define DINO_COOLDOWN_MS 300   /* 跳跃冷却期（毫秒） */

typedef struct
{
    int16_t  y;              /* 离地高度（像素） */
    int16_t  vy;             /* 竖直速度（像素/秒） */
    uint8_t  jumping;
    uint8_t  alive;
    int16_t  cactus_x;
    uint16_t score;
    uint32_t last_jump_ms;
    uint32_t crash_ms;
    uint32_t rng;
    uint32_t last_tick_ms;
    uint8_t  leg_phase;
} Dino;

void Dino_Init(Dino *d);
void Dino_Frame(Dino *d, Oled *oled, uint8_t jump_pressed);

#endif /* __BSP_DINO_H */
