#include "bsp_ssd1306.h"
#include <string.h>

/* ---------- software I2C on PB8/PB9 (order auto-detected) ---------- */
static GPIO_TypeDef *scl_port, *sda_port;
static uint16_t scl_pin, sda_pin;
static uint8_t oled_ok = 0;
static uint8_t oled_addr = 0x3C;

static void dly(void)
{
    for (volatile int i = 0; i < 24; i++) { }
}

static void scl_write(uint8_t v) { HAL_GPIO_WritePin(scl_port, scl_pin, v ? GPIO_PIN_SET : GPIO_PIN_RESET); }
static void sda_write(uint8_t v) { HAL_GPIO_WritePin(sda_port, sda_pin, v ? GPIO_PIN_SET : GPIO_PIN_RESET); }
static uint8_t sda_read(void) { return HAL_GPIO_ReadPin(sda_port, sda_pin) == GPIO_PIN_SET ? 1 : 0; }

static void i2c_start(void)
{
    sda_write(1); scl_write(1); dly();
    sda_write(0); dly();
    scl_write(0); dly();
}

static void i2c_stop(void)
{
    sda_write(0); dly();
    scl_write(1); dly();
    sda_write(1); dly();
}

static uint8_t i2c_wbyte(uint8_t b)
{
    for (uint8_t m = 0x80; m; m >>= 1)
    {
        sda_write(b & m ? 1 : 0); dly();
        scl_write(1); dly();
        scl_write(0); dly();
    }
    sda_write(1); dly();
    scl_write(1); dly();
    uint8_t ack = (sda_read() == 0);
    scl_write(0); dly();
    return ack;
}

static void pins_init(GPIO_TypeDef *sp, uint16_t spn, GPIO_TypeDef *dp, uint16_t dpn)
{
    scl_port = sp; scl_pin = spn;
    sda_port = dp; sda_pin = dpn;
    Bsp_GpioClkEnable(sp);
    Bsp_GpioClkEnable(dp);
    GPIO_InitTypeDef g = {0};
    g.Mode = GPIO_MODE_OUTPUT_OD;
    g.Pull = GPIO_NOPULL;
    g.Speed = GPIO_SPEED_FREQ_HIGH;
    g.Pin = spn; HAL_GPIO_Init(sp, &g);
    g.Pin = dpn; HAL_GPIO_Init(dp, &g);
    scl_write(1); sda_write(1); dly();
}

static uint8_t probe(uint8_t addr)
{
    i2c_start();
    uint8_t ack = i2c_wbyte((uint8_t)(addr << 1));
    i2c_stop();
    return ack;
}

static uint8_t try_pins(GPIO_TypeDef *sp, uint16_t spn, GPIO_TypeDef *dp, uint16_t dpn, uint8_t *addr)
{
    pins_init(sp, spn, dp, dpn);
    if (probe(0x3C)) { *addr = 0x3C; return 1; }
    if (probe(0x3D)) { *addr = 0x3D; return 1; }
    return 0;
}

static void ssd_cmd(uint8_t c)
{
    i2c_start();
    i2c_wbyte((uint8_t)(oled_addr << 1));
    i2c_wbyte(0x00);
    i2c_wbyte(c);
    i2c_stop();
}

static void ssd_data(const uint8_t *p, uint16_t n)
{
    i2c_start();
    i2c_wbyte((uint8_t)(oled_addr << 1));
    i2c_wbyte(0x40);
    for (uint16_t i = 0; i < n; i++) { i2c_wbyte(p[i]); }
    i2c_stop();
}

/* ---------- 5x7 font (31 glyphs, column-major, LSB = top row) ---------- */
/* order: space 0-9 A C D E G H I K L O P R S T W Y = : - . */
static const uint8_t FONT[31][5] = {
    {0x00, 0x00, 0x00, 0x00, 0x00}, /* space */
    {0x3E, 0x51, 0x49, 0x45, 0x3E}, /* 0 */
    {0x00, 0x42, 0x7F, 0x40, 0x00}, /* 1 */
    {0x42, 0x61, 0x51, 0x49, 0x46}, /* 2 */
    {0x21, 0x41, 0x45, 0x4B, 0x31}, /* 3 */
    {0x18, 0x14, 0x12, 0x7F, 0x10}, /* 4 */
    {0x27, 0x45, 0x45, 0x45, 0x39}, /* 5 */
    {0x3C, 0x4A, 0x49, 0x49, 0x30}, /* 6 */
    {0x01, 0x71, 0x09, 0x05, 0x03}, /* 7 */
    {0x36, 0x49, 0x49, 0x49, 0x36}, /* 8 */
    {0x06, 0x49, 0x49, 0x29, 0x1E}, /* 9 */
    {0x7E, 0x11, 0x11, 0x11, 0x7E}, /* A */
    {0x3E, 0x41, 0x41, 0x41, 0x22}, /* C */
    {0x7F, 0x41, 0x41, 0x22, 0x1C}, /* D */
    {0x7F, 0x49, 0x49, 0x49, 0x41}, /* E */
    {0x3E, 0x41, 0x49, 0x49, 0x7A}, /* G */
    {0x7F, 0x08, 0x08, 0x08, 0x7F}, /* H */
    {0x00, 0x41, 0x7F, 0x41, 0x00}, /* I */
    {0x7F, 0x08, 0x14, 0x22, 0x41}, /* K */
    {0x7F, 0x40, 0x40, 0x40, 0x40}, /* L */
    {0x3E, 0x41, 0x41, 0x41, 0x3E}, /* O */
    {0x7F, 0x09, 0x09, 0x09, 0x06}, /* P */
    {0x7F, 0x09, 0x19, 0x29, 0x46}, /* R */
    {0x46, 0x49, 0x49, 0x49, 0x31}, /* S */
    {0x01, 0x01, 0x7F, 0x01, 0x01}, /* T */
    {0x3F, 0x40, 0x38, 0x40, 0x3F}, /* W */
    {0x07, 0x08, 0x70, 0x08, 0x07}, /* Y */
    {0x14, 0x14, 0x14, 0x14, 0x14}, /* = */
    {0x00, 0x36, 0x36, 0x00, 0x00}, /* : */
    {0x08, 0x08, 0x08, 0x08, 0x08}, /* - */
    {0x00, 0x60, 0x60, 0x00, 0x00}, /* . */
};

static uint8_t glyph_index(char c)
{
    if (c >= '0' && c <= '9') { return (uint8_t)(1 + (c - '0')); }
    switch (c)
    {
        case 'A': return 11; case 'C': return 12; case 'D': return 13;
        case 'E': return 14; case 'G': return 15; case 'H': return 16;
        case 'I': return 17; case 'K': return 18; case 'L': return 19;
        case 'O': return 20; case 'P': return 21; case 'R': return 22;
        case 'S': return 23; case 'T': return 24; case 'W': return 25;
        case 'Y': return 26; case '=': return 27; case ':': return 28;
        case '-': return 29; case '.': return 30;
        default:  return 0;
    }
}

/* ---------- framebuffer ---------- */
static uint8_t buf[8][128];

uint8_t Oled_Ok(void) { return oled_ok; }

void Oled_Clear(void)
{
    memset(buf, 0, sizeof(buf));
}

void Oled_Text(uint8_t line, const char *s)
{
    if (line > 7) { return; }
    memset(buf[line], 0, 128);
    uint8_t x = 0;
    while (*s && x < 122)
    {
        const uint8_t *g = FONT[glyph_index(*s)];
        buf[line][x]     = g[0];
        buf[line][x + 1] = g[1];
        buf[line][x + 2] = g[2];
        buf[line][x + 3] = g[3];
        buf[line][x + 4] = g[4];
        x = (uint8_t)(x + 6);
        s++;
    }
}

void Oled_Refresh(void)
{
    if (!oled_ok) { return; }
    for (uint8_t page = 0; page < 8; page++)
    {
        ssd_cmd((uint8_t)(0xB0 | page));
        ssd_cmd(0x00);
        ssd_cmd(0x10);
        ssd_data(buf[page], 128);
    }
}

uint8_t Oled_Init(void)
{
    /* PB8/PB9 两种线序都探测一遍，地址 0x3C/0x3D 都认 */
    if (!try_pins(GPIOB, GPIO_PIN_8, GPIOB, GPIO_PIN_9, &oled_addr) &&
        !try_pins(GPIOB, GPIO_PIN_9, GPIOB, GPIO_PIN_8, &oled_addr))
    {
        oled_ok = 0;
        return 0;
    }

    /* standard 128x64 init sequence */
    static const uint8_t init_seq[] = {
        0xAE,             /* display off */
        0xD5, 0x80,       /* clock div */
        0xA8, 0x3F,       /* multiplex 64 */
        0xD3, 0x00,       /* display offset */
        0x40,             /* start line 0 */
        0x8D, 0x14,       /* charge pump on */
        0x20, 0x00,       /* page addressing */
        0xA1,             /* seg remap */
        0xC8,             /* com scan dec */
        0xDA, 0x12,       /* com pins */
        0x81, 0xCF,       /* contrast */
        0xD9, 0xF1,       /* pre-charge */
        0xDB, 0x40,       /* vcom detect */
        0xA4,             /* resume RAM content */
        0xA6,             /* normal (not inverted) */
        0x2E,             /* deactivate scroll */
        0xAF              /* display on */
    };
    for (uint32_t i = 0; i < sizeof(init_seq); i++) { ssd_cmd(init_seq[i]); }

    oled_ok = 1;
    Oled_Clear();
    Oled_Refresh();
    return 1;
}
