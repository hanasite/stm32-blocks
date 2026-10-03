# 小恐龙游戏组件 实施计划

> **For agentic workers:** 轻量计划（2026-10-03 深夜，招新增强）；单会话内联执行，逐项勾选。

**Goal:** 「小恐龙游戏」作为一种**组件对象**：主循环里每帧运行；拖入主循环的「运行一帧」积木内绑定 **显示到（OLED 对象）** 与 **跳跃输入（按键/红外对象，可留空）**；跳跃带 **300ms 冷却期**（防连跳刷屏）。

**Architecture:**
- 引擎自研精简版（不移植 GitHub 工程：许可不明 + API 不适配 128×64 软 I2C）：
  `bsp_dino.c/h`：`Dino` 状态机（时间积分物理、碰撞盒、撞毁 900ms 自动复活、LCG 随机间距）；绘制用 `SSD1306_Pixel`（地面虚线/方块像素风恐龙带跑动腿/仙人掌/左上角分数/撞毁×）；每帧清屏+整屏刷新
- 前端：catalog 新类型 `dino`，**动作多参数机制**（`params: [...]`，`paramType: "objref"` + `refType`）——节点存 `node.refs = {oled: id, jump: id}`；跳跃输入在 codegen 里翻译成 `Ir_IsTriggered(&ir1)` / `Key_IsPressed(&key1)` / `0`；model 引用清理、validate 绑定检查、render 双下拉
- 第六个示例「小恐龙游戏」（ir + oled + dino，循环：运行一帧 + 延时 30ms）

## Global Constraints

- 既有单参数动作机制不动（`param`/`paramType` 旧路径保留），新机制并存
- 生成代码风格延续；`template/` 改完重跑 embed
- 真板手感（跳速/冷却）以现场实测为准，参数集中 `#define` 便于调

---

### Task 1: 引擎 `bsp_dino.c/h` + 模板接线

- [x] Step 1: 引擎实现（冷却期 `DINO_COOLDOWN_MS=300`；帧率保护 dt≤100ms；撞毁 900ms 复活）
- [x] Step 2: CMake / user_app.h / 使用说明（组件说明）
- [x] Step 3: C 冒烟 PASS；**Node 逐像素仿真**三状态（奔跑/跳跃 y=17 与仙人掌零重叠/撞毁×）坐标全部核对
- [x] Step 4: Commit —— 两处参数修正：JUMP_VY 105→115（峰高≈20px，越过 15px 仙人掌留裕量）；碰撞阈值按几何精算改 `d->y < 14`（含 1 行擦边豁免）

### Task 2: 前端数据层 + UI

- [x] Step 1: catalog `dino` + TYPES（8 种）
- [x] Step 2: codegen 多参数分支 + model `node.refs` 引用清理
- [x] Step 3: validate MISSING_REF（缺 OLED/输入给人话提示；不接输入合法；悬空绑定报错）
- [x] Step 4: render 双下拉渲染
- [x] Step 5: Commit —— **踩到并修复时序 bug（同 T9 uid 那类）**：自动绑定若发生在渲染阶段，代码生成已先跑过（首帧代码里绑定是 0）→ 抽出 `Render.assignRefs(project)` 预处理，在 `refresh()` 开头与 assignUids 并列执行；自检当场抓住（`Dino_Frame(&dino9, 0, 0)` → 修复后 `Dino_Frame(&dino9, &oled9, Ir_IsTriggered(&ir9))`）

### Task 3: 示例 + 测试 + 自检

- [x] Step 1: 示例「小恐龙游戏」；菜单计数 6→7
- [x] Step 2: 单测 **42/42**（catalog/codegen/validate/model/examples 各 +1）
- [x] Step 3: _selftest 新增 dialog-dino-add + edit-dino-bind（双绑自动生效断言）
- [x] Step 4: 全套门：`run-example-builds` **6/6**（恐龙示例 2.7s）；自检 离线 **52/52**（在线 54/54）；embed 重内嵌 **78 文件 / 0.42MB**

### Task 4: 收尾

- [x] Step 1: README/设计文档 §5.2 更新；计划回填；推送

## 执行记录（2026-10-03 深夜）

链式完成：引擎（C 冒烟 + 逐像素仿真先行）→ 多参数绑定机制 → 示例 → 全部门通过。关键教训已记：**渲染期副作用必须提前到代码生成之前**（assignRefs 与 assignUids 并列）。遗留：**真板手感调参**（跳速/重力/冷却/仙人掌间距都是 bsp_dino.c 顶部的 `#define`，现场按小朋友手感微调），交给用户彩排。
