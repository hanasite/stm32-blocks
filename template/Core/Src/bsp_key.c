#include "bsp_key.h"

static uint8_t key_read_pressed(Key *k)
{
    uint8_t level = HAL_GPIO_ReadPin(k->port, k->pin);
    if (k->pull == PULL_UP)
    {
        return (level == GPIO_PIN_RESET) ? 1U : 0U;  /* 上拉：按下读到低 */
    }
    return (level == GPIO_PIN_SET) ? 1U : 0U;        /* 下拉：按下读到高 */
}

static void key_update(Key *k)
{
    uint8_t raw = key_read_pressed(k);
    uint32_t now = HAL_GetTick();

    if (raw != k->raw_last)
    {
        k->raw_last = raw;
        k->last_change_ms = now;
    }
    else if (k->stable != raw && (now - k->last_change_ms) >= 20U)
    {
        k->stable = raw;  /* 稳定 20ms 才认为状态变化 */
    }
}

void Key_Init(Key *k, GPIO_TypeDef *port, uint16_t pin, KeyPull pull)
{
    k->port = port;
    k->pin = pin;
    k->pull = pull;

    Bsp_GpioClkEnable(port);

    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = pin;
    gpio.Mode = GPIO_MODE_INPUT;
    gpio.Pull = (pull == PULL_UP) ? GPIO_PULLUP : GPIO_PULLDOWN;
    HAL_GPIO_Init(port, &gpio);

    k->raw_last = 0U;
    k->stable = 0U;
    k->last_change_ms = HAL_GetTick();
}

uint8_t Key_IsPressed(Key *k)
{
    key_update(k);
    return k->stable;
}

uint8_t Key_IsReleased(Key *k)
{
    key_update(k);
    return (uint8_t)(k->stable ? 0U : 1U);
}
