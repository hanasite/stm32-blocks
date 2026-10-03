/* user_code.c — 由积木生成器覆盖（M1 阶段先手写冒烟版） */
#include "user_app.h"

Key key1;
Led led1;

void user_setup(void)
{
    Key_Init(&key1, GPIOA, GPIO_PIN_1, PULL_UP);
    Led_Init(&led1, GPIOC, GPIO_PIN_13, ACTIVE_LOW);
}

void user_loop(void)
{
    if (Key_IsPressed(&key1))
    {
        Led_On(&led1);
    }
    else
    {
        Led_Off(&led1);
    }
}
