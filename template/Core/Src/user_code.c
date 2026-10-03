/* user_code.c — 由积木生成器覆盖（M1 阶段先手写冒烟版） */
#include "user_app.h"

Key    key1;
Led    led1;
Buzzer buzzer1;
Servo  servo1;

void user_setup(void)
{
    Key_Init(&key1, GPIOA, GPIO_PIN_1, PULL_UP);
    Led_Init(&led1, GPIOC, GPIO_PIN_13, ACTIVE_LOW);
    Buzzer_Init(&buzzer1, GPIOB, GPIO_PIN_1, ACTIVE_LOW);
    Servo_Init(&servo1, TIM2, TIM_CHANNEL_1);
}

void user_loop(void)
{
    if (Key_IsPressed(&key1))
    {
        Led_On(&led1);
        Buzzer_On(&buzzer1);
        Servo_Write(&servo1, 90);
    }
    else
    {
        Led_Off(&led1);
        Buzzer_Off(&buzzer1);
        Servo_Write(&servo1, 0);
    }
}
