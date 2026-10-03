/* main.c — 固定框架，不随积木生成变化 */
#include "main.h"
#include "user_app.h"

uint8_t g_clk_hse = 0;  /* 1 = HSE 72MHz 正常, 0 = HSI 回退 48MHz（诊断显示用） */

int main(void)
{
    HAL_Init();
    SystemClock_Config();

    user_setup();

    while (1)
    {
        user_loop();
    }
}

void SystemClock_Config(void)
{
    /* 首选 HSE 8MHz × 9 = 72MHz */
    RCC_OscInitTypeDef RCC_OscInitStruct = {0};
    RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

    RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSE;
    RCC_OscInitStruct.HSEState = RCC_HSE_ON;
    RCC_OscInitStruct.HSEPredivValue = RCC_HSE_PREDIV_DIV1;
    RCC_OscInitStruct.HSIState = RCC_HSI_ON;
    RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
    RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
    RCC_OscInitStruct.PLL.PLLMUL = RCC_PLL_MUL9;

    if (HAL_RCC_OscConfig(&RCC_OscInitStruct) == HAL_OK)
    {
        RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK |
                                      RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
        RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
        RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
        RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV2;
        RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;

        if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_2) == HAL_OK)
        {
            g_clk_hse = 1;
            return;
        }
    }

    /* 回退路径：HSE 晶振缺失/损坏时切内部 HSI 4MHz×12=48MHz，避免整板静默死机 */
    RCC_OscInitTypeDef osc_hsi = {0};
    RCC_ClkInitTypeDef clk_hsi = {0};

    osc_hsi.OscillatorType = RCC_OSCILLATORTYPE_HSI;
    osc_hsi.HSIState = RCC_HSI_ON;
    osc_hsi.PLL.PLLState = RCC_PLL_ON;
    osc_hsi.PLL.PLLSource = RCC_PLLSOURCE_HSI_DIV2;
    osc_hsi.PLL.PLLMUL = RCC_PLL_MUL12;
    if (HAL_RCC_OscConfig(&osc_hsi) != HAL_OK)
    {
        Error_Handler();
    }

    clk_hsi.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK |
                        RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    clk_hsi.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
    clk_hsi.AHBCLKDivider = RCC_SYSCLK_DIV1;
    clk_hsi.APB1CLKDivider = RCC_HCLK_DIV2;
    clk_hsi.APB2CLKDivider = RCC_HCLK_DIV1;

    if (HAL_RCC_ClockConfig(&clk_hsi, FLASH_LATENCY_1) != HAL_OK)
    {
        Error_Handler();
    }
}

void Error_Handler(void)
{
    __disable_irq();
    while (1)
    {
    }
}
