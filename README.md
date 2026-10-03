# STM32 积木工坊

社团招新用的 STM32 图形化编程小工具：拖拽积木拼主循环 → 实时生成 C 代码 → 编译烧录，板子动起来。

- 目标硬件：STM32F103C8T6（蓝药丸）+ HAL + CMake/Ninja 工程 + VSCode / ST-Link
- 工具形态：零构建静态网页（`web/index.html`），双击即用、离线可用
- 外设积木：按键 / 红外传感器 / LED / 蜂鸣器 / 舵机 / OLED 屏 / 整数变量 + 延时 / 如果-否则；引脚自由选，冲突自动拦截
- 组件积木：小恐龙游戏（跑在 OLED 上；块内绑定「显示到」某块屏 + 「跳跃输入」某按键/红外或「外部钩子」，跳跃带 300ms 冷却期；钩子模式配合「请求跳跃」积木可由外层 if 驱动）
- OLED 玩法（每次只显示一样、大字体）：YES / NO / LOW / HIGH / 显示单个变量 / 最外圈 5px 跑马灯（进度 0~100，中间大字显示进度数值）
- 内置示例：按键点灯、按键组合技、舵机来回摆、红外感应灯、跑马灯进度圈、小恐龙游戏
- 招新目标：2026 年 10 月中旬
- 设计文档：[docs/superpowers/specs/2026-10-03-stm32-block-editor-design.md](docs/superpowers/specs/2026-10-03-stm32-block-editor-design.md)

## 两种使用方式

### A. 现场直连模式（推荐：自带/现场笔记本，不用 VSCode）

本机装好 [STM32CubeCLT](https://www.st.com/en/development-tools/stm32cubeclt.html)（默认 `D:\STM32CubeCLT_1.18.0`，可用环境变量 `CUBECLT` 指向其它路径）与 Node.js，然后：

1. 双击 **`启动本地编译服务.bat`** —— 自动打开浏览器到 `http://127.0.0.1:8899/`，页头出现「本地工具链已连接」徽标
2. 拼积木 → 点 **「🔨 编译」**（约 3 秒出结果；代码有错会直接显示编译日志）
3. 插好 ST-Link → 点 **「⚡ 编译并烧录」** → 板子按积木逻辑动

产物工程在 `local-builds/<工程名>/`，也可拿它进 VSCode F5 单步调试。**不启动服务时这两个按钮自动隐藏**，网页功能与纯离线模式完全一致。

### B. 分发模式（别人的电脑）

1. 双击 `web/index.html` 拼积木 → 点「⬇ 下载完整工程」得到 `<工程名>.zip`
2. 解压 → VSCode 打开文件夹 → 按 F5 自动构建+烧录

需要对方自行安装 STM32CubeCLT 与 cortex-debug 扩展（模板自带 `.vscode/` 配置与一键脚本，无需其它设置）。

## 开发

- 单元测试：`node --test`（42 项，含 golden 测试逐字符锁定生成代码格式）
- UI 无头自检：Edge 无头打开 `web/_selftest.html`（离线 57 项全绿；本地服务在线时 59 项，含真实"点击编译"端到端）
- 示例编译回归：`node tools/run-example-builds.js`（6/6 通过）
- **模板（`template/`）任何改动后必须重跑 `node tools/embed-template.js`**，否则网页里内嵌的还是旧模板

MIT License
