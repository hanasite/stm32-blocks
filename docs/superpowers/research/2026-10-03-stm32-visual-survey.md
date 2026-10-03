# 调研报告：STM32 图形化/积木编程项目

> 2026-10-03 由调研子代理产出（会话内核查，未逐项人工复核标注处）。

## 一、GitHub 候选项目

| 项目 | 地址 | 许可 | 实现方式 | 生成代码类型 | 能否打包工程 | 活跃度 |
|---|---|---|---|---|---|---|
| **aily-blockly** ★3829 | github.com/ailyProject/aily-blockly | GPL-3.0 | Electron+Angular 桌面 IDE，Blockly（board.json 实测：core=`STMicroelectronics:stm32`，即 Arduino stm32duino 框架） | Arduino C++（非 HAL） | 自建工程目录本地编译（aily-builder≈arduino-cli），烧录用 stm32flash(串口)/probe-rs(SWD)；无 zip 导出 | 极活跃（2026-10-02 推送），alpha |
| **stmBlockly** ★0 | github.com/Codeless-Platform/stmBlockly | Apache-2.0 | 网页 Blockly + Python 本地 server；仓库内含完整 STM32CubeIDE Makefile 工程骨架（.cproject/Makefile/启动文件/链接脚本，F103C8+C6 双目标） | **裸机 C**：自研 MCAL 外设层（GPIO/EXTI/TIM/I2C/SPI/USART…）+ 组件驱动（Buzzer/Servo/OLED/LCD/步进/超声…）；未发现用 ST 官方 HAL | 本地编译烧录（依赖预装 CubeIDE+CubeProgrammer），无 zip | 2024-07 后停更 |
| **STudio4Education (S4E)** ★16 | github.com/A-S-T-U-C-E/STudio4Education | BSD-3-Clause | **纯静态网页** Blockly（打开 index.html 即用，GitHub Pages 托管，含 @blockly fork、generators/、i18n） | Arduino C++（代码搜索 digitalWrite×13、HAL_GPIO×0，走 STM32duino，Nucleo 板） | 否；复制代码到 Arduino IDE 上传；Electron 离线版集 arduino-cli | 主仓库 2025-12 更新；Electron 版 2023-05 停 |
| ardublockly ★491 | carlosperate/ardublockly | Apache-2.0 | 静态网页 + 本地 Python server（编译上传） | Arduino C++（仅 Arduino 系） | 否 | 活跃（2026-07） |
| eBlock ★45 | distintiva/eBlock | GPL-2.0 | 桌面 Scratch（mBlock 3.4.5 fork） | Scratch 积木直传（README 声称支持 STM32，板级细节未验证） | 否 | 2020 停更 |
| DevelopmentTools ★0 | github.com/Lone-LL/DevelopmentTools | 无 | 仅一份 docx 使用手册，仓库无源码 | — | — | 无实质内容 |

**最接近我们目标的：**

- **概念最接近 = stmBlockly**：开源生态里唯一已打通"拖积木 → 完整可编译 STM32 工程 → 烧录"的样本，工程骨架（CubeIDE Makefile + Src/main.c + 自研驱动分层）几乎是"积木+手写 BSP"形态的翻版。差距：驱动自研 MCAL 而非 ST HAL、仅 F103C8、依赖本地预装 CubeIDE（非浏览器 zip）、无 CMake、0 star、停更 2 年——**不可直接用，但值得读源码吸收工程组织与"积木→工程"衔接方式**。
- **完成度最高 = aily-blockly**：唯一持续维护、真能"积木→STM32→本地编译→烧录"的工具（F0/F1/F4/G0/G4/H7/L4/WB 全系）。差距：Arduino 框架（非 HAL）、Electron 桌面（非零构建网页）、GPL-3.0、积木库无 license——路线本质不同。
- **直接回答：没有任何项目做到"拖积木 → 生成 STM32 HAL 完整工程 → 编译烧录"。HAL 生成器在开源世界是空白。**

## 二、国内生态（对 STM32 支持）

- **米思齐 Mixly**（北师大）：官方无原生 STM32/HAL，仅通过手动装 STM32duino 硬件包间接支持 F103 Blue Pill，限 GPIO/串口/ADC；"Mixly 2.0 封装 STM32Cube HAL"仅见 CSDN 博客，**未证实**。可借鉴：平台包离线整包分发、积木/代码双视图。
- **Mind+**（DFRobot）：上传模式支持 Arduino/micro:bit/ESP32 等；**未发现 STM32 支持证据**（趋向不支持）。可借鉴：实时/上传双模式、扩展库商店交互。
- **好好搭搭**：在线平台；主板清单为 C51/STC/CH32/ASR+自家好搭系（好搭酷规格似 STM32F030 未证实）；未见 STM32。可借鉴：U 盘下载烧写（uf2 风格）。
- **天问Block**：官方支持 STC/CH32V/ASRPRO/TWEN32 等国产芯片，**未列 STM32**；**闭源**。可借鉴：生成代码可编辑视图、**导出 IDE 工程**（与我们目标同源）。
- **MakeCode**：STM32 目标仅限 Arcade 硬件家族（Meowbit=STM32F401 等）云端编译 .uf2；非通用 STM32 开发目标。

## 三、结论

1. **没有可直接拿来用的项目，自研必要性成立**：stmBlockly 只读源码参考，不 fork；aily-blockly 路线不同。
2. **没有现成的"Blockly→STM32 HAL 代码生成开源库"**——现有全部走 Arduino core 或私有运行时。我们手写 BSP+HAL 生成器不存在"重造轮子"，是核心增量。
3. **可参考组件**：ardublockly（Apache-2.0）"零构建静态页 + 本地编译通道"架构与我们最像；S4E（BSD-3-Clause）交互设计：引脚功能自动映射、新手/专家分级、i18n、多主题（另有 IECON22 论文 hal.science/hal-04219701）。
4. **国内佐证空白**：Mixly 仅间接、Mind+/好好搭搭/天问均无 STM32 原生图形化 → "网页积木生成 STM32 HAL 工程包"在教育市场无同类竞品。
5. **交互亮点**：代码双视图（边拼边看 C）、平台包离线分发、uf2 烧写、导出 IDE 工程——我们的 VSCode+CubeCLT+zip 是"导出工程"思路的进阶形态，方向有一致先例。

## 诚实标注（未确认）

① Mixly 2.0 是否真封装 Cube HAL（资料矛盾）；② Mind+ STM32 支持（倾向否）；③ eBlock 的 STM32 板级细节；④ 好搭酷是否 STM32F030；⑤ 天问Block 是否部分开源；⑥ stmBlockly MCAL 是否夹带 HAL（目录结构显示自研，未逐文件核对）。

Sources: [aily-blockly](https://github.com/ailyProject/aily-blockly) / [stmBlockly](https://github.com/Codeless-Platform/stmBlockly) / [STudio4Education](https://github.com/A-S-T-U-C-E/STudio4Education) / [ardublockly](https://github.com/carlosperate/ardublockly) / [pxt-arcade hardware docs](https://github.com/microsoft/pxt-arcade/blob/cloud_compile/docs/hardware.md) / [arcade devices](https://arcade.makecode.com/arcade-devices) / [Mixly 解析(CSDN)](https://blog.csdn.net/day7/article/details/155729088) / [Mixly 评测(CSDN)](https://blog.csdn.net/weixin_43405101/article/details/105668805) / [Mind+ 百科](https://baike.baidu.com/item/Mind%2b/23437149) / [DFRobot 社区](https://mc.dfrobot.com.cn/article-358670.html) / [好搭酷文档](https://docs.haohaodada.cn/zao-wu-chan-pin/haodacore) / [天问Block 说明书](http://www.haohaodada.com/ueditor/php/upload/file/20230830/1693381941394700.pdf) / [twen51 官网](http://twen51.com/new/art_show.php?id=230)
