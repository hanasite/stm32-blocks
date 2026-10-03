#include "bsp_buzzer.h"

void Buzzer_Init(Buzzer *b, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active)
{
    b->port = port;
    b->pin = pin;
    b->active = active;

    Bsp_GpioClkEnable(port);

    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = pin;
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    gpio.Pull = GPIO_NOPULL;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(port, &gpio);

    Buzzer_Off(b);
}

void Buzzer_On(Buzzer *b)
{
    HAL_GPIO_WritePin(b->port, b->pin,
                      (b->active == ACTIVE_HIGH) ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

void Buzzer_Off(Buzzer *b)
{
    HAL_GPIO_WritePin(b->port, b->pin,
                      (b->active == ACTIVE_HIGH) ? GPIO_PIN_RESET : GPIO_PIN_SET);
}

void Buzzer_Toggle(Buzzer *b)
{
    HAL_GPIO_TogglePin(b->port, b->pin);
}
