# 调研报告：开源积木/图形化单片机编程项目

> 2026-10-03 由调研子代理产出（会话内核查，未逐项人工复核标注处）。

## 1. Mixly（米思齐）

- GitHub：`mixly/Mixly_Arduino`（315★，镜像）｜主库在 Gitee：`mixly2/mixly2.0_src`、`mixly3.0_src`｜另有 `mixly/mixly_lite`（"new version based on js"，2024-08）
- 许可证：**自定义条款**——修改后必须保留 "Mixly" 名称及作者信息（可改名 Mixly4XXX）。注意：package.json 写 MIT，与根目录 license 文件冲突，应按 license 文件理解
- 技术栈：Electron/Node.js + 内置 Blockly（common/blockly-core，closure 版）+ webpack；多目标 `boards/default_src/{arduino, arduino_avr, esp32, esp8266, micropython_*, python_*}`
- 积木→代码：每板卡目录内 blocks/*.js（ES 模块导出 `{init(){…Blockly API}}`）+ 同名 generators/*.js（实测 generators/text.js：`Blockly.Arduino.valueToCode()` 递归子块、`Blockly.Arduino.definitions_['include_xxx']=…` 注册全局片段、返回代码串或 [code,order]），webpack 打包成板卡包
- 导出/烧录：生成 .ino 经 arduino-cli / Arduino IDE 编译上传；是否提供 zip 工程导出未确认
- 活跃度：GitHub 镜像最后提交 2025-04-16；主开发在 Gitee（活跃度无法直连核验）
- 可借鉴：① **definitions_ 注册表机制**（同 key 去重 #include/全局变量，最后统一拼接）——与我们"生成 C 调 BSP 驱动"对应；② 一块板卡=独立目录（blocks+generators+template.xml）；③ 积木定义与生成器同名配对、按功能分文件

## 2. BlocklyDuino

- GitHub：`BlocklyDuino/BlocklyDuino`（644★，v1-gh-pages 老版 / v2 统一新版）｜Electron 版 `BlocklyDuino/BlocklyDuino2Electron`（GPL-3.0，2026-10-02 仍有提交）
- 许可证：README 内声明 Apache-2.0（GitHub API 识别为 NOASSERTION）
- 技术栈：**纯静态网页**（v1：blockly_compressed.js + **arduino_compressed.js** + msg，双击 index.html 即用；v2：vendored @blockly 压缩版 + toolbox JSON + js/init.js）
- 积木→代码：自维护 Arduino generator（blockly/generators/arduino/*.js），标准 Blockly 生成器架构逐块拼代码
- 导出/烧录：代码复制进 Arduino IDE，或可选本地小服务（arduino_web_server.py）一键上传；代码区 textarea + Blob/FileSaver 客户端导出
- 活跃度：v2 分支 2026-08 有提交；Electron 版 2026-10-02
- 可借鉴：① **真·零构建静态网页的完整先例**；② 客户端 Blob/FileSaver 导出 → 我们升级为 JSZip 打包工程；③ v2 血统源自 A-S-T-U-C-E/STudio4Education（ST 芯片图形化项目）

## 3. Microsoft MakeCode / pxt

- GitHub：`microsoft/pxt`（MIT，2310★，当天仍有提交）
- 技术栈：TypeScript 编辑器（Blockly fork + Monaco），块用 `//%` 注解式 TS API 定义
- 积木→固件：块→TS 子集→**浏览器内编译器 pxtc**→自定义 IR→双 emitter → 原生机器码，与预编译 runtime 链接 → .hex/UF2
- **对我们过度复杂**：自研编译链+云构建，与"生成 C 调手写 BSP"路线完全不同，不模仿
- 可借鉴：全静态前端+本地存储离线；块定义即元数据；下载固件的一键 UX

## 4. 其他代表

- **Ardublockly**（`carlosperate/ardublockly`，Apache-2.0，491★，功能冻结）：静态 webapp + Python 本地服务编译上传；代码展示 `<pre>` + google-code-prettify（零依赖高亮方案）。借鉴：静态站负责积木/生成/高亮，编译烧录解耦到本地——与我们"出 zip"完全同构
- **s2a_fm**（GPL-3.0，停更）：Scratch↔Arduino 实时下发指令，**不生成代码**——不符合"让新人看到 C"的目标，排除
- （排除：taweili/ardublock 为桌面 Java 插件；ArduinoBlocks.com 闭源 SaaS）

## 5. 重点结论

- 零构建纯静态网页积木先例可行：BlocklyDuino v1/v2、Ardublockly、S4E 都是静态页 +（可选）本地服务
- 官方 Blockly 核心生成器只有 JS/Python/PHP/Lua/Dart，**Arduino/C 生成器必须自写**——我们自研生成器是行业惯例
- **Top 3 可直接抄作业的点**：
  1. Mixly 的 definitions_ 片段注册表（我们 catalog 模板已等价实现：#include/全局一次、按对象生成调用）
  2. 零构建静态结构 + 客户端导出（<pre>+轻量高亮；FileSaver→JSZip 升级）
  3. 静态前端与编译/烧录解耦——浏览器只做积木→代码→高亮→打包

## 诚实标注（未确认）

- Mixly 2.0/3.0 细节基于 GitHub 镜像源码实测 + 1.x 公开资料；Gitee 主库未直连核验
- Mixly 许可证文件与 package.json 冲突的适用性未确认
- BlocklyDuino v1 许可证仅见 README 内嵌文本；v2 代码高亮实现未确认（v1 为纯 textarea）
- pxt 编译管线来自其论文与论坛资料，未逐行读源码
