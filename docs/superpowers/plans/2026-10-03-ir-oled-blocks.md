# 红外传感器 + OLED 显示积木 实施计划

> **For agentic workers:** 轻量计划（2026-10-03 深夜，招新增强）；单会话内联执行，逐项勾选。

**Goal:** 新增两种对象积木——**红外传感器**（区分低/高电平触发，条件用「检测到/未检测到」）与 **OLED 显示屏**（每次只显示一样东西、大字体：YES / NO / LOW / HIGH / 单个整数变量 / 跑马灯）。

**跑马灯规格（用户定）**：沿 128×64 最外圈、**5 像素宽**；**从正上方（顶部中央）像素开始顺时针跑**；**进度 0~100，100 = 跑满一整圈**；**函数内钳位防溢出**。

**Architecture:**
- BSP 分层：底层 `bsp_ssd1306.c`（现成，M1 调试仪器）**更名 API 为 `SSD1306_*`**（模板里已无调用者，零风险），并补 `SSD1306_Pixel` 画点 + `SSD1306_Glyph` 取字形 + **新增字形大写 'N'**（现有 31 字形缺 N，「NO」需要）；新文件 `bsp_oled.c/h` 提供面向积木的实例式 API（`Oled` 结构 + Init/ShowText/ShowInt/Marquee，大字体=5×7 字形整数倍放大自适应）；新文件 `bsp_ir.c/h`（GPIO 输入 + ActiveLevel，无消抖）
- 前端：catalog 加 `ir`/`oled` 两类型；codegen 支持新 action 参数类型 **`intref`**（下拉选整数对象，节点存 `varId`）；model 的引用清理扩展 `varId`；validate 增加 **OLED 固定占用 PB8/PB9** 的冲突检测与「显示变量未选对象」检查
- 新示例「红外感应灯」（红外→LED+OLED YES/NO），示例总数 3→4

## Global Constraints

- 生成代码格式延续 golden 风格；现有 golden 测试（§5.3）不得改动
- `template/` 改完必须重跑 `node tools/embed-template.js`
- 全部改动走现有 UMD-lite 前端风格（ES5 语法），BSP 走 HAL/实例式风格

---

### Task 1: BSP（IR + OLED 显示层 + SSD1306 更名/画点/字形）

**Files:** Modify `template/Core/Src/bsp_ssd1306.c`、`template/Core/Inc/bsp_ssd1306.h`、`template/CMakeLists.txt`、`template/Core/Inc/user_app.h`、`template/使用说明.md`；Create `template/Core/{Src,Inc}/bsp_ir.{c,h}`、`bsp_oled.{c,h}`

- [ ] Step 1: SSD1306 更名 + `SSD1306_Pixel/Glyph` + 'N' 字形
- [ ] Step 2: bsp_ir（`Ir_Init/Ir_IsTriggered/Ir_IsIdle`）
- [ ] Step 3: bsp_oled（`Oled_Init/ShowText/ShowInt/Marquee`；大字自适应 scale≤8；跑马灯 380 步环形、5px、钳位）
- [ ] Step 4: CMake 源列表 / user_app.h / 使用说明接线表
- [ ] Step 5: Commit

### Task 2: 前端数据层（catalog / codegen / model / validate）

- [ ] Step 1: catalog：`ir`（pin+触发逻辑，states 检测到/未检测到）、`oled`（无参数，6 个动作，showvar 用 `paramType:"intref"`）、`pinsOfObject`（oled→PB8/PB9）
- [ ] Step 2: codegen：ir 的 initArgs/comment；action 的 intref 分支（varId→对象名，缺省 "0"）
- [ ] Step 3: model：nodeReferences 检查 `varId`
- [ ] Step 4: validate：pinsOfObject 冲突（OLED 冲突加提示后缀）+ intref 未选对象报错
- [ ] Step 5: Commit

### Task 3: 前端 UI（render / app / 自检）

- [ ] Step 1: render：条件编辑器状态化（catalog.states 通用化，含状态失效自愈）；动作块 intref 下拉（无整数时提示）；conditionObjects 加 ir；app.js makePaletteNode 的「如果」优先取有 states 的对象
- [ ] Step 2: _selftest：menu-options 4→5；新增 10.7（对话框建 ir+oled → 代码含 Ir_Init/Oled_Init → 删除复原）
- [ ] Step 3: Commit

### Task 4: 示例 + 回归脚本

- [ ] Step 1: examples.js 加「红外感应灯」（第四个）
- [ ] Step 2: run-example-builds.js 通过数改动态（4/4）
- [ ] Step 3: Commit

### Task 5: 测试与验证

- [ ] Step 1: 单测扩展（catalog/validate/codegen/model/examples）→ `node --test` 全绿
- [ ] Step 2: `node tools/run-example-builds.js` → 4/4
- [ ] Step 3: 七类型全上工程编译加码（临时脚本）
- [ ] Step 4: `node tools/embed-template.js` 重内嵌；自检离线上卷（42→46 项）
- [ ] Step 5: Commit

### Task 6: 收尾

- [ ] Step 1: README/使用说明更新；计划回填；记忆更新；推送
