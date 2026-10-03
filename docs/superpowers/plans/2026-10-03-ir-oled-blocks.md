# 红外传感器 + OLED 显示积木 实施计划

> **For agentic workers:** 轻量计划（2026-10-03 深夜，招新增强）；单会话内联执行，逐项勾选。

**Goal:** 新增两种对象积木——**红外传感器**（区分低/高电平触发，条件用「检测到/未检测到」）与 **OLED 显示屏**（每次只显示一样东西、大字体：YES / NO / LOW / HIGH / 单个整数变量 / 跑马灯）。

**跑马灯规格（用户定）**：沿 128×64 最外圈、**5 像素宽**；**从正上方（顶部中央）像素开始顺时针跑**；**进度 0~100，100 = 跑满一整圈**；**函数内钳位防溢出**。

**Architecture:**
- BSP 分层：底层 `bsp_ssd1306.c` **更名 API 为 `SSD1306_*`**（模板里已无调用者，零风险），补 `SSD1306_Pixel` 画点 + `SSD1306_Glyph` 取字形 + **新增大写 'N' 字形**（原 31 字形缺 N，「NO」需要）；新文件 `bsp_oled.c/h` 面向积木的实例式 API（`Oled` 结构 + Init/ShowText/ShowInt/Marquee，大字体 = 5×7 字形整数倍放大自适应）；新文件 `bsp_ir.c/h`（GPIO 输入 + ActiveLevel，无消抖）
- 前端：catalog 加 `ir`/`oled`；codegen 支持新参数类型 **`intref`**（下拉选整数对象，节点存 `varId`）；model 引用清理扩展 `varId`；validate 增加 **OLED 固定占用 PB8/PB9** 冲突检测与「显示变量未选对象」检查
- 新示例「红外感应灯」，示例 3→4

## Global Constraints

- 生成代码格式延续 golden 风格；现有 golden 测试（§5.3）不得改动 —— 本次由用户点名的两处注释变更除外（电平选项接线提示、主循环注释），golden 与设计文档同步更新
- `template/` 改完必须重跑 `node tools/embed-template.js`
- 前端保持 UMD-lite / ES5 风格；BSP 保持 HAL/实例式风格

---

### Task 1: BSP（IR + OLED 显示层 + SSD1306 更名/画点/字形）

- [x] Step 1: SSD1306 更名 + `SSD1306_Pixel/Glyph` + 'N' 字形（{0x7F,0x04,0x08,0x10,0x7F}）
- [x] Step 2: bsp_ir（`Ir_Init/Ir_IsTriggered/Ir_IsIdle`，PULL_NONE 直读）
- [x] Step 3: bsp_oled（大字自适应 scale≤8；跑马灯 380 步环形、5px、钳位；`Oled_Init` 返回找到与否）
- [x] Step 4: CMake 源列表 / user_app.h / 使用说明接线表（红外 PA2 默认、OLED PB8/PB9 接反可识别）
- [x] Step 5: Commit + **C 冒烟一次通过**（临时脚本把新 API 全部调用一遍编译 PASS）
- [x] 计划外合并（用户中途要求）：按键/LED 电平选项并入接线提示（「上拉，另一端接 GND」等），对话框与生成代码注释同时生效；golden/设计文档同步

### Task 2: 前端数据层

- [x] Step 1: catalog：`ir`（引脚+触发逻辑，states 检测到/未检测到）；`oled`（无参数，6 动作，showvar 为 `intref`，marquee 0-100）；`pinsOfObject`（oled→PB8/PB9）；TYPES 7 种
- [x] Step 2: codegen：ir 的 initArgs/comment；intref 分支（varId→对象名，缺省 "0"）
- [x] Step 3: model：nodeReferences 检查 `varId`
- [x] Step 4: validate：pinsOfObject 冲突（OLED 提示后缀）+ MISSING_VAR 检查
- [x] Step 5: Commit

### Task 3: 前端 UI

- [x] Step 1: render 条件编辑器状态化（catalog.states 通用，含状态失效自愈）；intref 下拉（无整数对象给提示）；app.js 「如果」优先选有 states 的对象；toast 文案更新
- [x] Step 2: _selftest 10.7（红外/OLED 对话框创建、PB8 保留引脚冲突拦截、删除复原）+ menu 4→5
- [x] Step 3: Commit

### Task 4: 示例 + 回归脚本

- [x] Step 1: examples.js「红外感应灯」（红外→LED+OLED YES/NO）
- [x] Step 2: run-example-builds 动态计数
- [x] Step 3: Commit

### Task 5: 测试与验证

- [x] Step 1: 单测扩展 → `node --test` **35/35 全绿**（golden 含新注释逐字符锁死）
- [x] Step 2: `node tools/run-example-builds.js` → **4/4**（新示例 2.7s）
- [x] Step 3: 七类型全上工程编译 → **ALLTYPES PASS（7 类型）**
- [x] Step 4: embed 重内嵌（76 文件 / 0.41MB）；自检：离线 **46/46**（线程内实测 48/48 = 离线 46 + 桥接 2）
- [x] Step 5: 视觉验证（qwen-vision 读截图）：画布「如果 ir1 检测到」+「显示变量 count1」下拉 +「跑马灯 60」+ 代码面板 `Ir_IsTriggered`/`Oled_ShowText`/`Oled_ShowInt`/`Oled_Marquee` 全部呈现正确；对话框七类型齐全、触发逻辑文案完整

### Task 6: 收尾

- [x] Step 1: README/使用说明/设计文档更新；计划回填；推送

## 执行记录（2026-10-03 深夜）

一次成型：BSP C 冒烟先行（隔离验证新驱动），随后数据层 → UI → 示例 → 测试，全部一次通过。中途用户追加两条需求均已并入：① 按键/LED 电平选项接线提示；② 主循环注释（界面提示行 + 生成代码 `user_loop` 上方注释 + golden/设计文档同步）。遗留：**真板验收**（红外模块 + OLED 实际接线后点「编译并烧录」）交给用户现场彩排。
