/* user_code.c — M1 诊断版 v5：OLED 仪表盘 + LED 报错码 + RAM 信标（验证代码是否真的在跑） */
#include "user_app.h"
#include "bsp_ssd1306.h"

extern uint8_t g_clk_hse;

Key    key1;
Led    led1;
Buzzer buzzer1;
Servo  servo1;

/* RAM 信标：放在 .bss 之外（启动不清零、复位不清除），
   远程经 ST-Link 读取即可判定代码有没有执行过/在不在跑 */
#define BEACON_MAGIC_ADDR  0x20004C00u   /* user_setup 到达标记 */
#define BEACON_COUNT_ADDR  0x20004C04u   /* user_loop 计数 */
static volatile uint32_t *beacon_magic = (volatile uint32_t *)BEACON_MAGIC_ADDR;
static volatile uint32_t *beacon_count = (volatile uint32_t *)BEACON_COUNT_ADDR;

static void put_u32(char *out, uint32_t v, uint8_t digits)
{
    uint8_t i;
    for (i = 0; i < digits; i++)
    {
        out[digits - 1 - i] = (char)('0' + v % 10U);
        v /= 10U;
    }
    out[digits] = 0;
}

static char line[24];

void user_setup(void)
{
    *beacon_magic = 0xB0071234u;
    Key_Init(&key1, GPIOA, GPIO_PIN_1, PULL_UP);
    Led_Init(&led1, GPIOC, GPIO_PIN_13, ACTIVE_LOW);
    Buzzer_Init(&buzzer1, GPIOB, GPIO_PIN_1, ACTIVE_LOW);
    Servo_Init(&servo1, TIM2, TIM_CHANNEL_1);
    Oled_Init();
}

void user_loop(void)
{
    (*beacon_count)++;
    uint8_t pressed = Key_IsPressed(&key1);

    if (pressed) {
        Buzzer_On(&buzzer1);
        Servo_Write(&servo1, 90);
    } else {
        Buzzer_Off(&buzzer1);
        Servo_Write(&servo1, 0);
    }

    if (!Oled_Ok()) {
        /* 屏没认出来：每 2 秒重试一次（接触不良可自愈）；
           同时用 LED 闪"报错码"：
             闪 2 下 = I2C 两线都被上拉拉高（模块通电、接线存在）→ 是协议/型号问题
             闪 3 下 = 两线没有被拉高（模块没供电 / 没上拉 / 线没通）→ 是电气问题 */
        static uint32_t last_try = 0;
        uint32_t now = HAL_GetTick();
        if (now - last_try > 2000U) {
            last_try = now;
            Oled_Init();
        }
        if (!Oled_Ok()) {
            uint8_t n = (Oled_LineStates() == 3U) ? 2U : 3U;
            for (uint8_t i = 0; i < n; i++) {
                Led_On(&led1);
                Delay_ms(120);
                Led_Off(&led1);
                Delay_ms(200);
            }
            Delay_ms(1000);
            return;
        }
    }

    if (pressed) {
        Led_On(&led1);
    } else {
        Led_Toggle(&led1);   /* 心跳：屏在刷 + 板载 LED 在闪 = 程序活着 */
    }

    Oled_Clear();
    Oled_Text(0, g_clk_hse ? "CLK HSE 72M" : "CLK HSI 48M");
    /* 第 1 行：RAW=引脚原始电平, ST=消抖后状态（按下应为 1） */
    line[0] = 'R'; line[1] = 'A'; line[2] = 'W'; line[3] = '=';
    line[4] = (char)('0' + (key1.raw_last ? 1 : 0));
    line[5] = ' '; line[6] = 'S'; line[7] = 'T'; line[8] = '=';
    line[9] = (char)('0' + (key1.stable ? 1 : 0));
    line[10] = 0;
    Oled_Text(1, line);
    /* 第 2 行：运行秒计数（证明主循环在跑） */
    line[0] = 'T'; line[1] = '=';
    put_u32(&line[2], HAL_GetTick() / 1000U, 6);
    Oled_Text(2, line);
    /* 第 3 行：按压状态 */
    Oled_Text(3, pressed ? "KEY PRESSED" : "KEY IDLE");
    Oled_Refresh();

    Delay_ms(250);
}
