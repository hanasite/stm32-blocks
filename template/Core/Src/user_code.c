/* user_code.c — 由积木生成器覆盖（M1 阶段先手写冒烟版） */
#include "user_app.h"

Led led1;

void user_setup(void)
{
    Led_Init(&led1, GPIOC, GPIO_PIN_13, ACTIVE_LOW);  /* 蓝药丸板载 LED，低电平亮 */
}

void user_loop(void)
{
    Led_Toggle(&led1);
    Delay_ms(500);
}
