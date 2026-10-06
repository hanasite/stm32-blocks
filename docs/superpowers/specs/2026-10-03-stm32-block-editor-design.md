# STM32 积木工坊 — 设计文档（社团招新图形化编程工具）

- 日期：2026-10-03
- 状态：开放事项已全部确认（2026-10-03），待最终复核后进入实施计划
- 项目路径：`F:\STM32\stm32-blocks`（2026-10-03 自 `F:\kakuns开源项目\stm32-blocks` 迁入，规避 cmake 非 ASCII 路径崩溃；原目录留作归档）
- 工具名：STM32 积木工坊（已定）
- 招新日期：十月中旬（按 2026-10-15 前后倒排里程碑）

## 1. 背景与目标

社团招新现场，让零基础新人体验完整的嵌入式开发闭环：**拖拽积木拼主循环 → 实时生成 C 代码 → 一键下载完整工程 → 编译烧录 → 板子动起来**。

成功标准：

- 新人 5–10 分钟内在工作人员笔记本上用鼠标拼出一个可运行的程序（按键 / 蜂鸣器 / 舵机）。
- 下载 zip → VSCode 打开 → 按 F5 → 板子按预期动作，全流程无需现场配置。
- 零基础新人能看懂右侧生成的代码（每个对象在代码里有中文注释对应）。

## 2. 范围

### v1 包含

- 外设对象：按键（GPIO 输入）、LED、蜂鸣器（有源，GPIO 输出）、舵机（PWM）、整数变量。
- 语句积木：对象动作 / 延时 / 如果-否则（可嵌套）。
- 条件：按键状态、变量与常数比较。
- 目标硬件：STM32F103C8T6（蓝药丸）+ HAL 库 + CMake/Ninja 工程 + VSCode + ST-Link（现场物资）。
- 一键下载完整工程 zip（模板 + 生成代码 + 驱动 + `.vscode` + 烧录脚本 + 中文说明）。
- 内置 3 个示例、localStorage 自动保存、工程 JSON 导入导出。

### v1 明确不做

- 电位器等模拟输入（ADC）、超声波等传感器、串口打印。
- 无源蜂鸣器音调（需要 PWM 频率输出）——物资已确认为有源蜂鸣器，不做。
- C++ class 风格代码生成（架构预留，默认生成 C，与社团教学一致）。
- 标准库（SPL）+ Keil 后端（架构预留：代码生成按 catalog 驱动，加后端主要工作在驱动层与模板工程）。
- 在线编译、手机/触摸端、多工程管理。

### 后续版本候选（用户 2026-10-03 预告，v1 不做）

- **0.96 寸 OLED（I2C，SSD1306）**：显示对象（显示文字 / 数字 / 变量值）。
- **MPU6050 六轴 IMU（I2C）**：传感器对象（加速度 / 角速度 → 状态与数值）。
- 架构已预留扩展路径：加外设 = 加一条 catalog 定义 + 写一个 BSP 驱动（届时补充 I2C 驱动层）。

## 3. 决策汇总（brainstorm 结论）

| 决策点 | 结论 |
|---|---|
| 工具形态 | 零构建静态网页（原生 HTML/CSS/JS，无 npm、无构建链），双击即用、离线可用 |
| 交互方式 | 自研拖拽积木内核（pointer events），不用 Blockly、不用现成拖拽库 |
| 代码生成 | 生成 `setup()/loop()` 风格 C 代码，调用手写 BSP 驱动库 |
| 外设初始化 | 由 BSP 驱动自行初始化（HAL 手写），引脚任意选，不依赖 CubeMX 再生成 |
| 工程打包 | 浏览器内 JSZip；模板工程以 base64 内嵌进工具 |
| 编译验证 | **当前笔记本本地编译**（CubeCLT 自带 arm-none-eabi-gcc + CMake + Ninja）；NAS/远程编译后续再考虑 |
| 烧录链路 | STM32CubeCLT + VSCode + Cortex-Debug：烧录走 STM32_Programmer_CLI、调试走 ST-LINK GDB server（纯 ST-Link 栈；DAP-Link 留待以后装 OpenOCD 再支持） |
| 使用场景 | 招新现场工作人员笔记本，鼠标拖拽，桌面布局，界面全中文 |

## 4. 系统架构

### 4.1 前端工具（`web/` 目录，现场分发这个文件夹）

数据流：用户操作 → **工程数据模型（唯一真相源）** → 渲染积木 / 生成代码 / 校验，三者都从模型读。

```
web/
├── index.html
├── css/style.css
├── js/
│   ├── model.js          # 工程数据模型 + 序列化
│   ├── catalog.js        # 外设与积木定义（数据驱动）
│   ├── objects.js        # 对象区 UI（类实例化弹窗）
│   ├── render.js         # 积木渲染
│   ├── dragdrop.js       # 拖拽内核（pointer events）
│   ├── validate.js       # 校验（纯函数）
│   ├── codegen.js        # 代码生成（纯函数）
│   ├── examples.js       # 内置示例
│   ├── packer.js         # zip 打包（JSZip）
│   └── template-data.js  # 模板工程 base64（由 tools/embed-template.js 生成）
└── vendor/jszip.min.js   # 本地自带，离线可用
```

- 所有 JS 用**轻量 UMD 包装**（IIFE 挂 `window`），不用 `type=module`——保证 `file://` 双击直开可用；同一份文件在 Node 里直接加载跑单测。
- 分发：文件夹拷 U 盘 / 挂 NAS 页面（http）均可，无网络依赖。

### 4.2 工程数据模型（JSON）

```json
{
  "version": 1,
  "projectName": "小明的作品",
  "objects": [
    {"id": "o1", "name": "key1",    "type": "key",    "params": {"pin": "PA1", "pull": "up"}},
    {"id": "o2", "name": "led1",    "type": "led",    "params": {"pin": "PC13", "active": "high"}},
    {"id": "o3", "name": "buzzer1", "type": "buzzer", "params": {"pin": "PB1", "active": "low"}},
    {"id": "o4", "name": "servo1",  "type": "servo",  "params": {"channel": "TIM1_CH1"}},
    {"id": "o5", "name": "count",   "type": "int",    "params": {"init": 0}}
  ],
  "loop": []
}
```

语句树节点：

```json
{"kind": "action", "objectId": "o3", "action": "on"}
{"kind": "action", "objectId": "o4", "action": "write", "value": 90}
{"kind": "action", "objectId": "o5", "action": "add", "value": 1}
{"kind": "delay",  "ms": 200}
{"kind": "if",
 "cond": {"kind": "state",   "objectId": "o1", "state": "pressed"},
 "then": [], "else": []}
{"kind": "if",
 "cond": {"kind": "compare", "objectId": "o5", "op": ">=", "value": 5},
 "then": [], "else": []}
```

- localStorage 每次改动自动保存；支持导出/导入 JSON 文件。

### 4.3 积木目录（`catalog.js`，数据驱动）

每种对象类型声明：显示名、参数表（供弹窗渲染）、可选动作/状态列表、对应代码模板。UI 下拉选项和代码生成都从 catalog 读。**以后加新外设 = 加一条 catalog 定义 + 写一个 BSP 驱动**，前端其余代码不动。

### 4.4 模板工程（`template/`，仓库内维护）

手写的 F103C8T6 最小工程（时钟 72MHz + HAL init，HAL 源码取自 STM32CubeF1；不用 CubeMX 生成，外设初始化全部由 BSP 接管）+ 配置：

```
template/
├── .vscode/                  # tasks.json 构建 / launch.json F5 烧录+调试 / c_cpp_properties.json
├── Core/
│   ├── Inc/                  # main.h、user_app.h、bsp_key.h、bsp_led.h、bsp_buzzer.h、bsp_servo.h
│   └── Src/                  # main.c（固定）、user_code.c（生成物）、bsp_*.c（手写驱动）
├── Drivers/                  # 裁剪过的 HAL：RCC/GPIO/TIM/CORTEX 最小集
├── Startup/                  # startup_stm32f103xb.s
├── STM32F103C8Tx_FLASH.ld
├── CMakeLists.txt            # CMake + Ninja 构建，target 固定为 firmware
├── 编译烧录.bat               # cmake 构建 + STM32_Programmer_CLI 烧录，双击即用
└── 使用说明.md                # 打开 → F5 → 板子动，三步图文
```

关键约定：

- 工具链基于已安装的 CubeCLT 1.18.0（`D:\STM32CubeCLT_1.18.0`）：自带 arm-none-eabi-gcc 13.3 / GDB / CMake 3.28 / Ninja 1.11 / STM32CubeProgrammer 2.19 / ST-LINK GDB server；**该版本不含 make 与 OpenOCD**，故构建用 CMake + Ninja（与 ST 官方 VS Code 扩展同栈），烧录用 STM32_Programmer_CLI。
- `main.c` 完全固定：时钟、HAL 初始化、`while(1){ user_loop(); }`，改动集中在 USER CODE 区，框架代码不随生成变化。
- 生成代码单独放 `Core/Src/user_code.c`，与框架代码完全分离。
- zip 打包时只把根目录名改成新人的工程名，CMake target 保持 `firmware`（避免中文/空格文件名问题）。

### 4.5 BSP 驱动（手写 + 真板调试）

```c
/* bsp_key.h —— 含 20ms 软件消抖 */
void    Key_Init(Key *k, GPIO_TypeDef *port, uint16_t pin, KeyPull pull);
uint8_t Key_IsPressed(Key *k);
uint8_t Key_IsReleased(Key *k);

/* bsp_led.h */
void Led_Init(Led *l, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active);
void Led_On(Led *l);   void Led_Off(Led *l);   void Led_Toggle(Led *l);

/* bsp_buzzer.h */
void Buzzer_Init(Buzzer *b, GPIO_TypeDef *port, uint16_t pin, ActiveLevel active);
void Buzzer_On(Buzzer *b);   void Buzzer_Off(Buzzer *b);   void Buzzer_Toggle(Buzzer *b);

/* bsp_servo.h —— 50Hz，500–2500µs 脉宽，角度 0–180 */
void Servo_Init(Servo *s, TIM_TypeDef *tim, uint32_t channel);
void Servo_Write(Servo *s, uint8_t angle);

/* user_app.h */
void Delay_ms(uint32_t ms);   /* HAL_Delay 封装 */
```

- 按键消抖在驱动内部完成，积木层面没有"消抖"概念：按下就是按下。
- 舵机定时器参数：72MHz → PSC=71（1µs 计数）、ARR=19999（50Hz）；`CCR = 500 + angle*2000/180`。
- 同一定时器上多个舵机只初始化一次定时器（静态标志）。
- 蜂鸣器按**有源**设计（GPIO 通电即响）——已确认为有源物资（2026-10-03）。

## 5. 积木语言与代码生成

### 5.1 对象创建（Python class 风格实例化）

弹窗起名字 + 选类型 + 填参数，如 `key1 = 按键(PA1, 下拉)`：

| 对象 | 参数 | 可选动作 / 状态 |
|---|---|---|
| 按键 | 引脚、下拉/上拉 | 状态：被按下 / 被松开 |
| LED | 引脚、高电平亮/低电平亮 | 动作：亮 / 灭 / 翻转 |
| 蜂鸣器 | 引脚、高电平响/低电平响 | 动作：响 / 停 / 翻转 |
| 舵机 | 定时器通道（自动对应引脚） | 动作：转到 N 度（0–180） |
| 整数 | 初始值 | 动作：设为 N / 加 N / 减 N；条件比较 |

- 名字限 `^[A-Za-z_][A-Za-z0-9_]*$`（C 代码标识符），重名不允许；弹窗自动给默认名（key1、led1…）。
- **GPIO 引脚下拉可用集**（F103C8T6/LQFP48，已排除 SWD 调试口、晶振、BOOT 等危险引脚）：
  `PA0–PA12, PA15, PB0, PB1, PB5–PB15, PC13`
- **舵机定时器通道下拉**（只列真实可出 PWM 的 16 个，界面显示通道+引脚）：

  | 定时器 | CH1 | CH2 | CH3 | CH4 |
  |---|---|---|---|---|
  | TIM1 | PA8 | PA9 | PA10 | PA11 |
  | TIM2 | PA0 | PA1 | PA2 | PA3 |
  | TIM3 | PA6 | PA7 | PB0 | PB1 |
  | TIM4 | PB6 | PB7 | PB8 | PB9 |

  说明：用户原举例"舵机接 TIM1 假设 PC1"，PC1 在 F103C8T6 上无任何定时器通道，做不了 PWM；改为按通道选择即从源头避免此错误。

### 5.2 语句与条件

- 动作积木：`[对象▾][动作▾]`，动作带参数时出现数字输入并显示参数标签（舵机 `转到 [90] 度`；跑马灯为 固定数值/整数变量 二选一：`跑马灯 显示进度 [count1▾]`）；组件类动作支持**对象绑定**参数（小恐龙 `运行一帧 显示到 [oled1▾] 跳跃输入 [ir1▾]`）。
- 延时积木：`延时 [N] 毫秒`。
- 如果积木：C 形容器 `如果 [条件] 则 {…} 否则 {…}`，`否则` 段可整块不用；内部可嵌套任意语句（含如果）。
- 条件：`[按键对象▾][被按下/被松开]` 或 `[整数对象▾][≥ > = ≤ <][数字]`。

### 5.3 生成代码示例（对象 = 第 4.2 节数据模型）

```c
/* user_code.c — 由积木自动生成，请勿手改 */
#include "user_app.h"

/* ===== 你创建的对象 ===== */
Key    key1;      /* key1 = 按键(PA1, 上拉，另一端接 GND) */
Led    led1;      /* led1 = LED(PC13, 高电平亮，另一端接 GND) */
Buzzer buzzer1;   /* buzzer1 = 蜂鸣器(PB1, 低电平响) */
Servo  servo1;    /* servo1 = 舵机(TIM1_CH1) */
int    count;     /* count = 整数(0) */

void user_setup(void)
{
    Key_Init(&key1, GPIOA, GPIO_PIN_1, PULL_UP);
    Led_Init(&led1, GPIOC, GPIO_PIN_13, ACTIVE_HIGH);
    Buzzer_Init(&buzzer1, GPIOB, GPIO_PIN_1, ACTIVE_LOW);
    Servo_Init(&servo1, TIM1, TIM_CHANNEL_1);
    count = 0;
}

/* 主循环：单片机会从头到尾一直执行这一段（不断重复） */
void user_loop(void)
{
    if (Key_IsPressed(&key1)) {
        Buzzer_On(&buzzer1);
        Led_Toggle(&led1);
        Servo_Write(&servo1, 90);
        count = count + 1;
    } else {
        Buzzer_Off(&buzzer1);
        Delay_ms(50);
    }
}
```

- 对象声明、初始化、`user_loop` 全部由模型递归生成；缩进 4 空格。
- 生成 C（不生成 C++）；驱动风格想换 `key1.isPressed()` 需另立后端，架构已预留。

### 5.4 内置示例（一键载入）

1. **按键点灯**：`如果 key1 被按下 则 led1 亮 否则 led1 灭`
2. **按键组合技**：按下 → 蜂鸣器响 + 灯翻转 + 舵机转到 90 度 + count 加 1 + 延时 200ms；否则蜂鸣器停
3. **舵机来回摆**：舵机 0 度 → 延时 500ms → 舵机 180 度 → 延时 500ms

## 6. 界面与交互

### 6.1 布局（桌面三栏）

```
┌───────────────┬──────────────────────────────┬──────────────────────┐
│  对象区         │  积木盒        拼装区（主循环）    │  生成的代码（实时）      │
│ ▪ key1         │  ┌──────┐    ╔════════════╗   │ Key    key1;         │
│   按键 PA1 下拉  │  │ 动 作 │    ║ 如果 按键1    ║   │ ...                  │
│ ▪ led1 …       │  │ 延 时 │    ║  被按下      ║   │ void user_loop()     │
│ ▪ buzzer1 …    │  │ 如 果 │    ║ │ 蜂鸣器1 响  ║   │ {                    │
│ ▪ servo1 …     │  └──────┘    ║ 否则 { 停 }   ║   │   if (Key_IsPressed… │
│ ▪ count        │   拖出 ↓      ╚════════════╝   │ }                    │
│ [＋ 新建对象]    │         🗑（拖拽时出现）        │ [⬇ 下载完整工程]       │
└───────────────┴──────────────────────────────┴──────────────────────┘
```

### 6.2 拖拽行为（自研内核）

- 从积木盒拖出三类源积木：动作 / 延时 / 如果。积木内下拉框就地选择对象与行为。
- 靠近连接点（堆叠下方、如果的 C 形肚子 / 否则段）高亮提示落点，松手吸附；有效绿色、无效红色。
- 删除：拖动时画布角落出现垃圾桶，拖入即删；重排 = 拖到新位置吸附。

### 6.3 防错校验

- 引脚冲突（两个对象的引脚相同，含舵机通道对应引脚 vs GPIO）→ 顶部红色错误条 + 下载按钮禁用，修复即恢复。
- 重名在弹窗阶段拦截；空主循环允许（生成空 loop）。
- 删除被积木引用的对象 → 二次确认，确认后连带清理相关积木。

### 6.4 代码面板

- 每次修改实时重新生成，语法高亮（轻量自研高亮，不引外部库），一键复制。
- 加分项（可后置）：悬停某块积木时右侧对应代码行高亮，强化"积木↔代码"对应关系。

### 6.5 视觉风格

- 全中文界面、现代扁平、大色块：对象=蓝、延时=橙、如果=紫。
- 顶部输入工程名（决定 zip 根目录名，如「小明的作品」）。

## 7. 打包与烧录链路

### 7.1 新人拿到的 zip

```
小明的作品/
├── .vscode/                  # tasks / launch / c_cpp_properties
├── Core/Inc/ + Core/Src/     # main.c 固定、user_code.c 生成、bsp_*.c 驱动
├── Drivers/                  # 裁剪 HAL（体积小）
├── Startup/ + .ld + CMakeLists.txt（CMake + Ninja，target=firmware）
├── 编译烧录.bat               # 双击 = cmake 构建 + STM32_Programmer_CLI 烧录
└── 使用说明.md                # 打开 → F5 → 板子动，三步图文
```

### 7.2 工作人员笔记本一次性准备

- 安装 **STM32CubeCLT**（免费；自带 arm-none-eabi-gcc / CMake / Ninja / STM32CubeProgrammer / ST-LINK GDB server）——**✅ 已装好：`D:\STM32CubeCLT_1.18.0`（2026-10-03）**；+ VSCode + Cortex-Debug 扩展 + **ST-Link 驱动**（现场 ST-Link 现货充足）。
- 验证：装好后现场流程走一遍（见里程碑 M4）。

### 7.3 现场三步

新人拼积木 → 点「下载完整工程」→ VSCode 打开文件夹按 F5（或双击 `编译烧录.bat`），板子动。现场 2 块 F103C8T6 轮流烧录给新人玩（烧录时一次插一块）。

## 8. 测试与验收

1. **本地编译回归（当前笔记本）**：CubeCLT 的 arm-none-eabi-gcc + CMake + Ninja，对 3 个内置示例逐个生成 `user_code.c` 塞进模板工程编译，全过才算代码生成正确。工具脚本：`tools/run-example-builds.bat`（后续可把该脚本挂到 NAS 做远程 CI，v1 不需要）。
2. **纯函数单测**：`codegen`（积木树 → C 代码）与 `validate`（引脚冲突）无 DOM 依赖，Node 直接跑断言（`node --test`）。
3. **真板实测（最终验收）**：F103C8T6 + ST-Link 跑通 3 个示例 + 「按键控制舵机」自由发挥；按键消抖手感、舵机角度以真板为准调参。

## 9. 里程碑（风险优先）

| # | 内容 | 完成标准 | 目标日期（招新约 10-15） |
|---|---|---|---|
| M1 | 硬件链路先行：模板工程 + BSP + 手写 user_code.c | 本地编译通过（0 error），真板烧录跑通 | 10-07 |
| M2 | 前端编辑器：模型 + 对象区 + 拖拽内核 + 三类积木 | 界面能拼出三示例，代码实时生成正确 | 10-11 |
| M3 | 完善：校验、示例、保存/导入导出、打包 zip、语法高亮 | 下载的 zip 在本地编译通过 | 10-13 |
| M4 | 联调彩排：全示例真板跑 + 工作人员笔记本走现场流程 | 现场三步流程一次不卡壳 | 10-14（招新前彩排） |

## 10. 已确认事项（2026-10-03 用户确认）

- [x] 蜂鸣器为**有源**（GPIO 通电即响）——设计假设成立，无源 PWM 音调不做。
- [x] 工具名：**STM32 积木工坊**。
- [x] 招新日期：**十月中旬**，按 10-15 前后倒排里程碑。
- [x] 现场物资：F103C8T6 **2 块**（轮流烧录给新人玩）；**ST-Link 现货很多**（现场主用；DAP-Link 留待以后装 OpenOCD 再支持）。

## 11. 开源项目调研结论（2026-10-03）

完整报告见 `docs/superpowers/research/`（两份）。核心结论：

- **没有任何开源项目做到"拖积木 → 生成 STM32 HAL 完整工程 → 编译烧录"**——现有工具全部走 Arduino core（aily-blockly、S4E、BlocklyDuino 系）或私有运行时。我们的路线是空白区，自研必要且成立。
- 最接近的两个都不可用：**stmBlockly**（唯一"积木→完整 F103 工程→烧录"样本，但自研 MCAL 非 HAL、依赖本地 CubeIDE、停更 2 年、0 star——**只读源码参考，不 fork**；M1/M2 实施时可翻阅其工程组织）；**aily-blockly**（3.8k star 活跃，但 GPL-3.0、Electron 桌面、Arduino 框架，路线不同）。
- 零构建静态网页积木有多个成功先例（BlocklyDuino v1/v2、Ardublockly、STudio4Education），我们的"静态页 + JSZip 打包完整工程"是它们"客户端导出"思路的进阶形态。
- 吸收要点：Mixly 的代码片段注册表机制（catalog 模板已等价实现）；S4E 的引脚自动映射交互（与舵机"通道→引脚"下拉防错同思路，方向被第三方验证）；天问Block 的"导出 IDE 工程"印证了生成完整工程 zip 的教育价值。
- 国内生态（Mixly/Mind+/好好搭搭/天问Block）均无 STM32 原生图形化支持——招新展示时"我们自己做了一个"有差异化讲点。
