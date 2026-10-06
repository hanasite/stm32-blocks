# 贡献指南

感谢愿意一起完善「STM32 积木工坊」！这个工具面向社团招新的零基础同学，所以一条总原则：

> **一切以"新人不迷路"为先**——功能宁少勿挤，生成代码宁清晰勿炫技，说明文字宁白话勿术语。

## 一、先讨论，再动手

- **想加新组件/外设**（传感器、模块、游戏……）：先提一个 [组件提案](issues/new?template=component-proposal.md)（或群里喊一声），确认设计、避免撞车，再开工。
- **发现 Bug**：先搜搜有没有已有 Issue，没有再提 [Bug 报告](issues/new?template=bug-report.md)。带上：积木截图、生成的 `user_code.c`、编译/烧录日志——这三样齐全，问题当天就能定位。

## 二、开发流程

1. 从 `main` 拉分支：`feat/组件名`（如 `feat/ultrasonic`）、`fix/问题关键词`
2. 按下面的清单开发，本地把质量门全部跑绿
3. 提交信息：`feat: ...` / `fix: ...` / `docs: ...` / `test: ...`（中文描述没问题）
4. 发 PR 到 `main`，按 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md) 勾选
5. 维护者 Review 后合入

## 三、加一个「组件」完整清单（重点）

以"加一个超声波测距组件"为例，按顺序改这些地方：

| # | 文件 | 做什么 |
|---|------|--------|
| 1 | `template/Core/Inc/bsp_xxx.h` + `template/Core/Src/bsp_xxx.c` | **BSP 驱动**：实例式 API（结构体 + `Xxx_Init` / 操作函数），照 `bsp_ir.c` 抄结构，注释只写"为什么" |
| 2 | `template/CMakeLists.txt` | `CORE_SOURCES` 里加一行 `Core/Src/bsp_xxx.c` |
| 3 | `template/Core/Inc/user_app.h` | `#include "bsp_xxx.h"` |
| 4 | `web/js/catalog.js` | **类型定义**：`label` / `declare` / `params`（引脚、选项）/ `states`（条件）/ `actions`（动作，含代码模板）/ `initCode` / `comment`；`pinOfObject`（或 `pinsOfObject`）加映射；`TYPES` 注册 |
| 5 | `web/js/codegen.js` | 只在这两种情况下才要改：初始化代码有特殊占位符（补 `initArgs`）、注释文本要填参数（补 `commentText`） |
| 6 | `web/js/validate.js` | （可选）新校验，比如占用多个引脚、必须绑定别的对象 |
| 7 | `web/js/render.js` | （可选）需要新的块内控件类型才动（一般下拉/数字框已够用） |
| 8 | `tests/catalog.test.js` + `tests/codegen.test.js` | **必加**：类型定义测试 + 生成的代码逐行断言 |
| 9 | `tests/validate.test.js` | （有校验就加） |
| 10 | `web/_selftest.html` | 加一小节：对话框创建该类型 → 拖进主循环 → 断言代码面板内容（照抄现有小节） |
| 11 | `web/js/examples.js` + `tests/examples.test.js` | （推荐）加一个能演示它的示例；示例总数断言同步改 |
| 12 | `node tools/embed-template.js` | **模板改了必须重跑**——否则网页里内嵌的还是旧驱动 |

## 四、质量门（PR 必须全绿）

```bash
node --test                          # 单元测试（全绿，数量只增不减）
node tools/run-example-builds.js     # 所有示例逐个真编译（N/N 通过）
# UI 无头自检（命令见 README「开发」一节），保持全绿
```

涉及固件改动的，PR 里写一句**真板实测**结果（哪个例子、板子上看到了什么现象）。

## 五、代码风格

- 前端：**零构建、零 npm 依赖**——原生 HTML/JS（ES5 语法）、UMD-lite 包裹；双击 `web/index.html`（file://）必须能完整使用
- BSP：跟随 `template/Core/Src/` 的现有风格（HAL、实例式、`#define` 集中可调参数）
- **`.bat` 文件必须纯 ASCII**（GBK 的 cmd 遇到中文注释会解析崩坏——这是血泪教训）
- 生成代码格式由 `tests/codegen.test.js` 的 golden 测试**逐字符锁定**；确需改格式时，golden 与设计文档 §5.3 样例要同步更新
- 不要引入第三方 JS 库（`web/vendor/` 里的除外，且需在 PR 里说明理由和许可证）

## 六、License

本项目以 [MIT](LICENSE) 发布；你提交的贡献默认同意以 MIT 协议分发。
