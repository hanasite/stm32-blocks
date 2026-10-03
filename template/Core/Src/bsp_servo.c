#include "bsp_servo.h"

/* F103C8T6 可出 PWM 的 16 个通道 → 引脚映射（与界面下拉一一对应） */
typedef struct
{
    TIM_TypeDef *tim;
    uint32_t ch;
    GPIO_TypeDef *port;
    uint16_t pin;
} ServoPinMap;

static const ServoPinMap SERVO_PIN_MAP[] = {
    {TIM1, TIM_CHANNEL_1, GPIOA, GPIO_PIN_8},
    {TIM1, TIM_CHANNEL_2, GPIOA, GPIO_PIN_9},
    {TIM1, TIM_CHANNEL_3, GPIOA, GPIO_PIN_10},
    {TIM1, TIM_CHANNEL_4, GPIOA, GPIO_PIN_11},
    {TIM2, TIM_CHANNEL_1, GPIOA, GPIO_PIN_0},
    {TIM2, TIM_CHANNEL_2, GPIOA, GPIO_PIN_1},
    {TIM2, TIM_CHANNEL_3, GPIOA, GPIO_PIN_2},
    {TIM2, TIM_CHANNEL_4, GPIOA, GPIO_PIN_3},
    {TIM3, TIM_CHANNEL_1, GPIOA, GPIO_PIN_6},
    {TIM3, TIM_CHANNEL_2, GPIOA, GPIO_PIN_7},
    {TIM3, TIM_CHANNEL_3, GPIOB, GPIO_PIN_0},
    {TIM3, TIM_CHANNEL_4, GPIOB, GPIO_PIN_1},
    {TIM4, TIM_CHANNEL_1, GPIOB, GPIO_PIN_6},
    {TIM4, TIM_CHANNEL_2, GPIOB, GPIO_PIN_7},
    {TIM4, TIM_CHANNEL_3, GPIOB, GPIO_PIN_8},
    {TIM4, TIM_CHANNEL_4, GPIOB, GPIO_PIN_9},
};

/* 每个 TIM 一套句柄（同 TIM 多舵机只初始化一次） */
static TIM_HandleTypeDef htim[4];
static uint8_t tim_inited[4];

static int tim_index(TIM_TypeDef *tim)
{
    if (tim == TIM1) { return 0; }
    if (tim == TIM2) { return 1; }
    if (tim == TIM3) { return 2; }
    if (tim == TIM4) { return 3; }
    return -1;
}

static const ServoPinMap *find_map(TIM_TypeDef *tim, uint32_t ch)
{
    for (unsigned i = 0; i < sizeof(SERVO_PIN_MAP) / sizeof(SERVO_PIN_MAP[0]); i++)
    {
        if (SERVO_PIN_MAP[i].tim == tim && SERVO_PIN_MAP[i].ch == ch)
        {
            return &SERVO_PIN_MAP[i];
        }
    }
    return 0;
}

void Servo_Init(Servo *s, TIM_TypeDef *tim, uint32_t channel)
{
    const ServoPinMap *map = find_map(tim, channel);
    int idx = tim_index(tim);
    if (map == 0 || idx < 0)
    {
        Error_Handler();  /* 生成器只会传表内通道，走到这里说明代码错了 */
    }

    /* 1) 定时器第一次用时：72MHz → 1µs 计数、20ms 周期（50Hz） */
    if (!tim_inited[idx])
    {
        switch (idx)
        {
            case 0: __HAL_RCC_TIM1_CLK_ENABLE(); break;
            case 1: __HAL_RCC_TIM2_CLK_ENABLE(); break;
            case 2: __HAL_RCC_TIM3_CLK_ENABLE(); break;
            case 3: __HAL_RCC_TIM4_CLK_ENABLE(); break;
        }

        htim[idx].Instance = tim;
        htim[idx].Init.Prescaler = 71;
        htim[idx].Init.CounterMode = TIM_COUNTERMODE_UP;
        htim[idx].Init.Period = 19999;
        htim[idx].Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
        htim[idx].Init.AutoReloadPreload = TIM_AUTORELOAD_PRELOAD_ENABLE;
        if (HAL_TIM_Base_Init(&htim[idx]) != HAL_OK)
        {
            Error_Handler();
        }
        if (HAL_TIM_PWM_Init(&htim[idx]) != HAL_OK)
        {
            Error_Handler();
        }
        tim_inited[idx] = 1U;
    }

    s->tim = tim;
    s->ch = channel;
    s->htim = &htim[idx];

    /* 2) 通道配置：PWM1，中位 1500µs 起步避免抽搐 */
    TIM_OC_InitTypeDef oc = {0};
    oc.OCMode = TIM_OCMODE_PWM1;
    oc.Pulse = 1500;
    oc.OCPolarity = TIM_OCPOLARITY_HIGH;
    oc.OCFastMode = TIM_OCFAST_DISABLE;
    if (HAL_TIM_PWM_ConfigChannel(s->htim, &oc, channel) != HAL_OK)
    {
        Error_Handler();
    }
    if (HAL_TIM_PWM_Start(s->htim, channel) != HAL_OK)
    {
        Error_Handler();
    }

    /* 3) 引脚复用输出（本工程不用重映射，默认通道映射） */
    Bsp_GpioClkEnable(map->port);
    GPIO_InitTypeDef gpio = {0};
    gpio.Pin = map->pin;
    gpio.Mode = GPIO_MODE_AF_PP;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(map->port, &gpio);
}

void Servo_Write(Servo *s, uint8_t angle)
{
    if (angle > 180U)
    {
        angle = 180U;
    }
    uint32_t ccr = 500U + (uint32_t)angle * 2000U / 180U;  /* 0.5–2.5ms */
    __HAL_TIM_SET_COMPARE(s->htim, s->ch, ccr);
}
