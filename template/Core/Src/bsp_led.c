#include "bsp_led.h"

void Led_Init(Led *l, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active)
{
    l->port = port;
    l->pin = pin;
    l->active = active;

    Bsp_GpioClkEnable(port);

    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = pin;
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    gpio.Pull = GPIO_NOPULL;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(port, &gpio);

    Led_Off(l);
}

void Led_On(Led *l)
{
    HAL_GPIO_WritePin(l->port, l->pin,
                      (l->active == ACTIVE_HIGH) ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

void Led_Off(Led *l)
{
    HAL_GPIO_WritePin(l->port, l->pin,
                      (l->active == ACTIVE_HIGH) ? GPIO_PIN_RESET : GPIO_PIN_SET);
}

void Led_Toggle(Led *l)
{
    HAL_GPIO_TogglePin(l->port, l->pin);
}
