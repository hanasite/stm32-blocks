#ifndef __BSP_DINO_H
#define __BSP_DINO_H

#include "bsp_common.h"
#include "bsp_oled.h"

/* 小恐龙游戏引擎（组件）：主循环里每帧调 Dino_Frame()。
   - 跳跃：jump_pressed=1 且已落地、且距上次起跳 >= DINO_COOLDOWN_MS（冷却期）时起跳
   - 撞上仙人掌后停 DINO_CRASH_MS 自动复活（分数保留）
   - 每帧整屏重绘（先清屏），与"每次只显示一样"的显示约定一致 */

#define DINO_COOLDOWN_MS 300   /* 跳跃冷却期（毫秒） */

/* 钩子：跳跃输入参数传 DINO_JUMP_HOOK 时，改由 Dino_RequestJump() 在别处置位驱动
   （方便用外层 if / 任意逻辑控制跳跃） */
#define DINO_JUMP_HOOK 0

typedef struct
{
    int16_t  y;              /* 离地高度（像素） */
    int16_t  vy;             /* 竖直速度（像素/秒） */
    uint8_t  jumping;
    uint8_t  alive;
    uint8_t  jump_req;       /* 跳跃钩子：请求置位，帧内消费一次 */
    int16_t  cactus_x;
    uint16_t score;
    uint32_t last_jump_ms;
    uint32_t crash_ms;
    uint32_t rng;
    uint32_t last_tick_ms;
    uint8_t  leg_phase;
} Dino;

void Dino_Init(Dino *d);
void Dino_RequestJump(Dino *d);   /* 请求一次跳跃（下一帧生效，依旧受落地/冷却期约束） */
void Dino_Frame(Dino *d, Oled *oled, uint8_t jump_pressed);

#endif /* __BSP_DINO_H */
