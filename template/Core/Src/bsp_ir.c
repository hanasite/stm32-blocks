#include "bsp_ir.h"

void Ir_Init(Ir *ir, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active)
{
    ir->port = port;
    ir->pin = pin;
    ir->active = active;

    Bsp_GpioClkEnable(port);

    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = pin;
    gpio.Mode = GPIO_MODE_INPUT;
    gpio.Pull = GPIO_NOPULL;   /* 模块输出推挽驱动，无需内部上下拉 */
    HAL_GPIO_Init(port, &gpio);
}

static uint8_t raw_level(Ir *ir)
{
    return (HAL_GPIO_ReadPin(ir->port, ir->pin) == GPIO_PIN_SET) ? 1 : 0;
}

uint8_t Ir_IsTriggered(Ir *ir)
{
    return (raw_level(ir) == (ir->active == ACTIVE_HIGH ? 1 : 0)) ? 1 : 0;
}

uint8_t Ir_IsIdle(Ir *ir)
{
    return Ir_IsTriggered(ir) ? 0 : 1;
}
