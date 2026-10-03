# STM32 积木工坊（stm32-blocks）

社团招新用的 STM32 图形化编程小工具：**拖拽积木拼主循环 → 实时生成 C 代码 → 一键下载完整工程 → 编译烧录，板子动起来**。

面向零基础新人设计：外设对象像 Python 类一样实例化（`key1 = 按键(PA1, 上拉)`），主循环用简化积木（如果…则…、延时、对象动作）拖拽拼装，生成的 C 代码带中文注释、干净可读。

## 目标硬件与技术栈

- **STM32F103C8T6**（蓝药丸）+ ST-Link
- HAL 库 + CMake/Ninja 构建（STM32CubeCLT 工具链）+ VSCode
- 支持外设：按键（内置 20ms 消抖）/ LED / 蜂鸣器（有源）/ 舵机（50Hz PWM，16 通道按引脚映射下拉选择）
- 生成代码调用手写 BSP 驱动；`main.c` 固定不变，逻辑集中在 `user_code.c`

## 仓库结构

| 目录 | 内容 |
|---|---|
| `template/` | 固件工程模板（**已在真板跑通**）：裁剪版 HAL + BSP 驱动 + CMake/Ninja + 一键构建烧录脚本 |
| `web/` | 图形化编辑器（零构建静态网页，开发中）：数据模型 / 积木目录 / 代码生成 / 拖拽 UI |
| `tools/` | 构建辅助脚本 |
| `docs/` | 设计文档、实施计划、开源生态调研（superpowers 工作流产物） |

## 快速开始（模板部分）

1. 安装 [STM32CubeCLT](https://www.st.com/en/development-tools/stm32cubeclt.html)（默认装在 `D:\STM32CubeCLT_1.18.0`，可用环境变量 `CUBECLT` 指定其他位置）
2. 用 VSCode 打开 `template/` 文件夹
3. 双击 `template\编译烧录.bat`（或运行 VSCode 任务 Build and Flash）

接线与细节见 `template/使用说明.md`。

> 提示：本项目在 Windows + 中文路径环境下做了专门加固（工程文件夹名含中文也能正常构建），相关坑与规避方式记录在 `docs/superpowers/plans/` 的执行记录里。

## 开发状态

- [x] **M1** 固件模板 + BSP 四驱动 + 真板验收（2026-10）
- [ ] **M2** 图形化编辑器：模型 / 积木 / 拖拽 UI / 代码生成（进行中）
- [ ] **M3** 一键打包完整工程 zip + 示例编译回归

## 许可证

本项目代码采用 MIT 许可证（见 `LICENSE`）；`template/Drivers/` 下为 ST 官方 HAL/CMSIS 源码，遵循其自带 BSD-3 许可证（见 `template/Drivers/LICENSE.md`）。
