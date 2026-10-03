# 小恐龙游戏组件 实施计划

> **For agentic workers:** 轻量计划（2026-10-03 深夜，招新增强）；单会话内联执行，逐项勾选。

**Goal:** 「小恐龙游戏」作为一种**组件对象**：主循环里每帧运行；拖入主循环的「运行一帧」积木内绑定 **显示到（OLED 对象）** 与 **跳跃输入（按键/红外对象，可留空）**；跳跃带 **300ms 冷却期**（防连跳刷屏）。

**Architecture:**
- 引擎自研精简版（不移植 GitHub 工程：许可不明 + API 不适配 128×64 软 I2C）：
  `bsp_dino.c/h`：`Dino` 状态机（时间积分物理：跳速 105px/s、重力 320px/s²、仙人掌速度 52px/s、碰撞盒、撞毁 900ms 自动复活、LCG 随机间距）；绘制用 `SSD1306_Pixel`（地面虚线/方块像素风恐龙带跑动腿/仙人掌/左上角分数/撞毁×）；每帧清屏+整屏刷新（与"每次只显示一样"一致）
- 前端：catalog 新类型 `dino`，**动作多参数机制**（`params: [...]`，`paramType: "objref"` + `refType`）——节点存 `node.refs = {oled: id, jump: id}`；跳跃输入在 codegen 里翻译成 `Ir_IsTriggered(&ir1)` / `Key_IsPressed(&key1)` / `0`；model 引用清理、validate 绑定检查、render 双下拉（"显示到 [oled1] 跳跃输入 [ir1]"）
- 第六个示例「小恐龙游戏」（ir + oled + dino，循环：运行一帧 + 延时 30ms）

## Global Constraints

- 既有单参数动作机制不动（`param`/`paramType` 旧路径保留），新机制并存
- 生成代码风格延续；`template/` 改完重跑 embed
- 真板手感（跳速/冷却）以现场实测为准，参数集中 `#define` 便于调

---

### Task 1: 引擎 `bsp_dino.c/h` + 模板接线

- [ ] Step 1: 实现引擎（Init/Frame；冷却期 `DINO_COOLDOWN_MS=300`；帧率保护 dt≤100ms）
- [ ] Step 2: CMake / user_app.h / 使用说明（组件说明行）
- [ ] Step 3: C 冒烟（临时脚本）+ **Node 逐像素仿真**出 ASCII 帧（地面/恐龙/仙人掌/分数坐标检查）
- [ ] Step 4: Commit

### Task 2: 前端数据层 + UI

- [ ] Step 1: catalog `dino`（动作 `params:[显示到 objref/oled, 跳跃输入 objref/input allowNone]`）+ TYPES
- [ ] Step 2: codegen 多参数分支（objref 翻译含输入表达式；缺省 `0`/`&` 回退）；model `node.refs` 引用清理
- [ ] Step 3: validate 绑定检查（MISSING_REF，缺 OLED/输入时给人话提示）
- [ ] Step 4: render 双下拉渲染（自动绑定第一个 OLED 与第一个输入；无对象时占位提示）
- [ ] Step 5: Commit

### Task 3: 示例 + 测试 + 自检

- [ ] Step 1: 示例「小恐龙游戏」；examples/菜单计数 6→7
- [ ] Step 2: 单测（catalog/codegen/validate/model/examples）
- [ ] Step 3: _selftest：对话框建 dino → 拖块切到 dino → 双绑自动生效 → 代码含 `Dino_Frame(&dino9, &oled9, Ir_IsTriggered(&ir9));` → 清理（5 连删）
- [ ] Step 4: 全套门（单测 全绿 / run-example-builds 6/6 / 自检 离线 52 / embed 重跑）

### Task 4: 收尾

- [ ] Step 1: README/文档/记忆更新；推送；真板手感留彩排调参
