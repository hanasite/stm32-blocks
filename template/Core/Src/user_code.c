/* user_code.c — M1 诊断版 v3：OLED 仪表盘（诊断完成后由冒烟版/生成器覆盖） */
#include "user_app.h"
#include "bsp_ssd1306.h"

extern uint8_t g_clk_hse;

Key    key1;
Led    led1;
Buzzer buzzer1;
Servo  servo1;

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
    Key_Init(&key1, GPIOA, GPIO_PIN_1, PULL_UP);
    Led_Init(&led1, GPIOC, GPIO_PIN_13, ACTIVE_LOW);
    Buzzer_Init(&buzzer1, GPIOB, GPIO_PIN_1, ACTIVE_LOW);
    Servo_Init(&servo1, TIM2, TIM_CHANNEL_1);
    Oled_Init();
}

void user_loop(void)
{
    uint8_t pressed = Key_IsPressed(&key1);

    if (pressed) {
        Led_On(&led1);
        Buzzer_On(&buzzer1);
        Servo_Write(&servo1, 90);
    } else {
        Buzzer_Off(&buzzer1);
        Servo_Write(&servo1, 0);
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
    /* 第 3 行：按压状态 / OLED 探测结果 */
    Oled_Text(3, pressed ? "KEY PRESSED" : (Oled_Ok() ? "KEY IDLE" : "OLED FAIL"));
    Oled_Refresh();

    if (!pressed) {
        Led_Toggle(&led1);   /* 心跳：屏在刷 + 板载 LED 在闪 = 程序活着 */
    }
    Delay_ms(250);
}
