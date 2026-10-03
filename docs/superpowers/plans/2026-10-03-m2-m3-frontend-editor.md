# M2+M3：前端编辑器（STM32 积木工坊）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `web/` 下建成零构建静态网页工具：对象区（类实例化建外设/变量）+ 自研拖拽积木（动作/延时/如果-否则）+ 实时生成 `user_code.c` + 防错校验 + 一键下载完整工程 zip（内嵌 M1 模板），并让 3 个内置示例在本地编译回归全过。

**Architecture:** 工程数据模型（JSON）是唯一真相源；`model/catalog/validate/codegen/examples/packer` 为纯逻辑模块（UMD 包装，Node 可直接 require 测），DOM 只在 `render/dragdrop/objects/app`。拖拽内核自研（pointer events）。zip 打包 = JSZip 读内嵌 base64 模板 → 替换 `Core/Src/user_code.c` → 根目录改名。**依赖 M1 计划已交付的 `template/`**（本计划 Task 10 起用到）。

**Tech Stack:** 原生 HTML/CSS/JS（无构建、file:// 可用）、`node --test`（Node ≥18）做纯函数测试、JSZip 3.10（手动 vendor）、CMake 编译回归（CubeCLT）。

## Global Constraints

- 仓库根：`F:\kakuns开源项目\stm32-blocks`；本计划工作在 `web/`、`tests/`、`tools/`。
- **零依赖零构建**：`index.html` 只用经典 `<script>`（**不用** `type=module`，保证 file:// 双击可用）；不跑 npm install，JSZip 手动 vendor 进 `web/vendor/`。
- 所有 JS 文件统一 UMD 包装（浏览器挂 `window.Xxx` / Node 走 `module.exports`），模板：

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"));   // 有依赖的模块这样写；无依赖的 factory()
  } else {
    root.Codegen = factory(root.Catalog);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog) {
  "use strict";
  // ... 实现 ...
  return { generate: generate };
});
```

- 界面与文案为中文；`web/` 内文件用 UTF-8（含中文界面字符串，HTML 加 `<meta charset="utf-8">`）；其他源文件保持 ASCII。
- 纯逻辑模块（model/catalog/validate/codegen/examples/packer）**不碰 DOM**；`node --test tests/` 必须全绿。
- **冻结契约**：数据模型与设计文档 §4.2 一致、生成代码与 §5.3 样例逐字符一致（含对齐空格与末尾换行）；BSP 调用签名以 M1 计划末尾"接口冻结"为准。
- 提交格式：`feat:/test:/fix:` + 中文简述 + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

---

### Task 1: 工程骨架 + model.js（数据模型）+ Node 测试

**Files:**
- Create: `web/js/model.js`
- Create: `tests/model.test.js`
- Create: `web/index.html`（占位骨架，后面任务填充）

**Interfaces:**
- Consumes: 无
- Produces（后续所有任务依赖，精确签名）：

```js
Model.newProject(name)                 // -> {version:1, projectName, objects:[], loop:[]}
Model.addObject(project, type, params) // -> object {id:"o1", name:"key1", type, params}；名字自动编号
Model.findObject(project, id)          // -> object | undefined
Model.deleteObject(project, id)        // -> 连带清理 loop 树中引用；返回清理的节点数
Model.countReferences(project, id)     // -> 数字（UI 删除确认用）
Model.walk(nodes, fn)                  // -> 深度优先遍历语句树
Model.findParentList(project, node)    // -> 引用 node 的那个数组（moveNode 用）
Model.moveNode(project, node, targetList, targetIndex) // -> true / false（不允许移进自身子树）
Model.nodeAction(objectId, action, value)     // -> {kind:"action", objectId, action, value?}
Model.nodeDelay(ms)                            // -> {kind:"delay", ms}
Model.nodeIf(cond, thenNodes, elseNodes)       // -> {kind:"if", cond, then:[], else:[]}
Model.condState(objectId, state)               // -> {kind:"state", objectId, state}
Model.condCompare(objectId, op, value)         // -> {kind:"compare", objectId, op, value}  op ∈ ">="|">"|"="|"<="|"<"
Model.serialize(project) / Model.deserialize(str)  // JSON 往返；deserialize 校验 version===1
```

- [x] **Step 1: 环境检查**（node v24.14.1）

```bash
node --version   # 期望 v18 或更高；更低就先装 Node LTS
```

- [x] **Step 2: 写失败测试 `tests/model.test.js`（全文）**

```js
const test = require("node:test");
const assert = require("node:assert");
const Model = require("../web/js/model.js");

test("新建工程结构正确", () => {
  const p = Model.newProject("小明的作品");
  assert.equal(p.version, 1);
  assert.equal(p.projectName, "小明的作品");
  assert.deepEqual(p.objects, []);
  assert.deepEqual(p.loop, []);
});

test("默认名字按类型递增编号", () => {
  const p = Model.newProject("t");
  assert.equal(Model.addObject(p, "key", { pin: "PA1", pull: "up" }).name, "key1");
  assert.equal(Model.addObject(p, "key", { pin: "PA2", pull: "up" }).name, "key2");
  assert.equal(Model.addObject(p, "led", { pin: "PC13", active: "high" }).name, "led1");
  assert.equal(Model.addObject(p, "int", { init: 0 }).name, "count1");
});

test("删除对象会连带清理语句树（含嵌套）", () => {
  const p = Model.newProject("t");
  const key = Model.addObject(p, "key", { pin: "PA1", pull: "up" });
  const led = Model.addObject(p, "led", { pin: "PC13", active: "high" });
  const inner = Model.nodeAction(led.id, "on");
  p.loop.push(Model.nodeDelay(100));
  p.loop.push(Model.nodeIf(Model.condState(key.id, "pressed"), [inner], []));
  const removed = Model.deleteObject(p, key.id);
  assert.equal(removed, 1);                       // 那个 if 整体被移除（条件引用 key）
  assert.equal(p.loop.length, 1);
  assert.equal(p.loop[0].kind, "delay");
});

test("删除对象不动无关的 if（只清 then/else 里面的引用）", () => {
  const p = Model.newProject("t");
  const key = Model.addObject(p, "key", { pin: "PA1", pull: "up" });
  const led = Model.addObject(p, "led", { pin: "PC13", active: "high" });
  p.loop.push(Model.nodeIf(Model.condState(key.id, "pressed"),
    [Model.nodeAction(led.id, "on"), Model.nodeAction(led.id, "toggle")], []));
  Model.deleteObject(p, led.id);
  assert.equal(p.loop.length, 1);
  assert.equal(p.loop[0].then.length, 0);
});

test("moveNode：同列表搬移 / 嵌套里搬出 / 禁止移进自身子树", () => {
  const p = Model.newProject("t");
  const ifNode = Model.nodeIf({ kind: "state", objectId: "o1", state: "pressed" },
                              [Model.nodeDelay(1)], []);
  const d1 = Model.nodeDelay(10);
  const d2 = Model.nodeDelay(20);
  const d3 = Model.nodeDelay(30);
  p.loop.push(ifNode, d1, d2, d3);
  // d3 挪到最前
  assert.equal(Model.moveNode(p, d3, p.loop, 0), true);
  assert.equal(p.loop[0], d3);
  // if 肚里的 delay 挪出来
  assert.equal(Model.moveNode(p, ifNode.then[0], p.loop, 0), true);
  assert.equal(p.loop[0].kind, "delay");
  assert.equal(ifNode.then.length, 0);
  // if 不许塞进自己肚子
  assert.equal(Model.moveNode(p, ifNode, ifNode.then, 0), false);
});

test("序列化往返", () => {
  const p = Model.newProject("t");
  Model.addObject(p, "servo", { channel: "TIM1_CH1" });
  p.loop.push(Model.nodeAction(p.objects[0].id, "write", 90));
  const back = Model.deserialize(Model.serialize(p));
  assert.deepEqual(back, p);
  assert.throws(() => Model.deserialize('{"version":99}'));
});
```

- [x] **Step 3: 跑测试看失败**（注意：Node 24 下用 `node --test` 不带路径自动发现测试文件；`node --test tests/` 会被当成模块报错）

Run: `node --test tests/`
Expected: FAIL（`Cannot find module '../web/js/model.js'`）

- [x] **Step 4: 实现 `web/js/model.js`（全文）**

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.Model = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var NAME_BASE = { key: "key", led: "led", buzzer: "buzzer", servo: "servo", int: "count" };

  function newProject(name) {
    return { version: 1, projectName: name || "我的工程", objects: [], loop: [] };
  }

  function defaultName(project, type) {
    var base = NAME_BASE[type] || type;
    var n = 0;
    project.objects.forEach(function (o) { if (o.type === type) { n++; } });
    return base + (n + 1);
  }

  function addObject(project, type, params) {
    var id = "o" + (project.objects.length + 1);
    var obj = { id: id, name: defaultName(project, type), type: type, params: params || {} };
    project.objects.push(obj);
    return obj;
  }

  function findObject(project, id) {
    for (var i = 0; i < project.objects.length; i++) {
      if (project.objects[i].id === id) { return project.objects[i]; }
    }
    return undefined;
  }

  function nodeReferences(node, objectId) {
    if (node.kind === "action") { return node.objectId === objectId; }
    if (node.kind === "if") {
      return (node.cond.kind === "state" || node.cond.kind === "compare")
        ? node.cond.objectId === objectId : false;
    }
    return false;
  }

  function cleanList(list, objectId) {
    var removed = 0;
    for (var i = list.length - 1; i >= 0; i--) {
      var node = list[i];
      if (nodeReferences(node, objectId)) { list.splice(i, 1); removed++; continue; }
      if (node.kind === "if") {
        removed += cleanList(node.then, objectId);
        removed += cleanList(node.else, objectId);
      }
    }
    return removed;
  }

  function deleteObject(project, id) {
    var removed = cleanList(project.loop, id);
    for (var i = 0; i < project.objects.length; i++) {
      if (project.objects[i].id === id) { project.objects.splice(i, 1); break; }
    }
    return removed;
  }

  function countReferences(project, id) {
    var n = 0;
    walk(project.loop, function (node) { if (nodeReferences(node, id)) { n++; } });
    return n;
  }

  function walk(nodes, fn) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      fn(node);
      if (node.kind === "if") { walk(node.then, fn); walk(node.else, fn); }
    }
  }

  function findParentList(project, node) {
    var found = null;
    (function scan(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] === node) { found = list; return; }
        if (list[i].kind === "if") { scan(list[i].then); if (found) { return; } scan(list[i].else); if (found) { return; } }
      }
    })(project.loop);
    return found;
  }

  function isListInside(node, list) {
    if (node.kind !== "if") { return false; }
    if (node.then === list || node.else === list) { return true; }
    for (var i = 0; i < node.then.length; i++) { if (isListInside(node.then[i], list)) { return true; } }
    for (var j = 0; j < node.else.length; j++) { if (isListInside(node.else[j], list)) { return true; } }
    return false;
  }

  function moveNode(project, node, targetList, targetIndex) {
    if (node.kind === "if" && isListInside(node, targetList)) { return false; }
    var from = findParentList(project, node);
    if (!from) { return false; }
    var idx = from.indexOf(node);
    from.splice(idx, 1);
    if (from === targetList && idx < targetIndex) { targetIndex--; }
    targetList.splice(targetIndex, 0, node);
    return true;
  }

  function nodeAction(objectId, action, value) {
    var n = { kind: "action", objectId: objectId, action: action };
    if (value !== undefined) { n.value = value; }
    return n;
  }
  function nodeDelay(ms) { return { kind: "delay", ms: ms }; }
  function nodeIf(cond, thenNodes, elseNodes) {
    return { kind: "if", cond: cond, then: thenNodes || [], else: elseNodes || [] };
  }
  function condState(objectId, state) { return { kind: "state", objectId: objectId, state: state }; }
  function condCompare(objectId, op, value) { return { kind: "compare", objectId: objectId, op: op, value: value }; }

  function serialize(project) { return JSON.stringify(project); }
  function deserialize(str) {
    var p = JSON.parse(str);
    if (p.version !== 1) { throw new Error("不支持的工程版本: " + p.version); }
    return p;
  }

  return {
    newProject: newProject, addObject: addObject, defaultName: defaultName,
    findObject: findObject, deleteObject: deleteObject, countReferences: countReferences,
    walk: walk, findParentList: findParentList, moveNode: moveNode,
    nodeAction: nodeAction, nodeDelay: nodeDelay, nodeIf: nodeIf,
    condState: condState, condCompare: condCompare,
    serialize: serialize, deserialize: deserialize
  };
});
```

- [x] **Step 5: 跑测试到全绿**（2026-10-03：`node --test` PASS ×6）

Run: `node --test tests/`
Expected: PASS ×6

- [x] **Step 6: 写占位 `web/index.html`**（后面任务填充，先保证骨架在）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>STM32 积木工坊</title>
</head>
<body>
  <p>构建中…</p>
</body>
</html>
```

- [x] **Step 7: Commit**

```bash
git add web tests && git commit -m "feat: 前端骨架与工程数据模型 model.js（含 Node 测试）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: catalog.js（积木/外设目录，数据驱动）

**Files:**
- Create: `web/js/catalog.js`
- Test: `tests/catalog.test.js`

**Interfaces:**
- Consumes: 无
- Produces：

```js
Catalog.GPIO_PINS      // 28 个可用引脚字符串，如 "PA1"
Catalog.SERVO_CHANNELS // 16 项：{id:"TIM1_CH1", label:"TIM1_CH1（PA8）", tim:"TIM1", chCode:"TIM_CHANNEL_1", pin:"PA8"}
Catalog.TYPES          // ["key","led","buzzer","servo","int"]
Catalog.get(type)      // -> {label, params, states, actions, declare, initCode, comment, ...}
Catalog.pinLabel(pin) / Catalog.channelLabel(id)
Catalog.gpioPortOf(pin)      // "PA1" -> "GPIOA"
Catalog.gpioPinMacroOf(pin)  // "PA1" -> "GPIO_PIN_1"
Catalog.pinOfObject(obj)     // 对象（key/led/buzzer 用 params.pin；servo 用通道映射）-> 引脚字符串 | null
```

- [x] **Step 1: 写失败测试 `tests/catalog.test.js`（全文）**

```js
const test = require("node:test");
const assert = require("node:assert");
const Catalog = require("../web/js/catalog.js");

test("GPIO 引脚表：28 个，且不含危险引脚", () => {
  assert.equal(Catalog.GPIO_PINS.length, 28);
  ["PA13", "PA14", "PB2", "PB3", "PB4", "PC14", "PC15"].forEach((p) => {
    assert.ok(!Catalog.GPIO_PINS.includes(p), p + " 不应在表里");
  });
  ["PA0", "PA12", "PA15", "PB0", "PB1", "PB5", "PB15", "PC13"].forEach((p) => {
    assert.ok(Catalog.GPIO_PINS.includes(p), p + " 应在表里");
  });
});

test("舵机通道表：16 个，映射与硬件文档一致", () => {
  assert.equal(Catalog.SERVO_CHANNELS.length, 16);
  const c = Catalog.SERVO_CHANNELS.find((c) => c.id === "TIM1_CH1");
  assert.equal(c.pin, "PA8");
  assert.equal(c.tim, "TIM1");
  assert.equal(c.chCode, "TIM_CHANNEL_1");
  const t4 = Catalog.SERVO_CHANNELS.find((c) => c.id === "TIM4_CH4");
  assert.equal(t4.pin, "PB9");
});

test("引脚/通道换算函数", () => {
  assert.equal(Catalog.gpioPortOf("PA1"), "GPIOA");
  assert.equal(Catalog.gpioPinMacroOf("PC13"), "GPIO_PIN_13");
  assert.equal(Catalog.gpioPortOf("PB15"), "GPIOB");
  assert.equal(Catalog.pinOfObject({ type: "led", params: { pin: "PB1" } }), "PB1");
  assert.equal(Catalog.pinOfObject({ type: "servo", params: { channel: "TIM3_CH4" } }), "PB1");
  assert.equal(Catalog.pinOfObject({ type: "int", params: {} }), null);
});

test("每种类型都有 declare/initCode/comment，动作带中文标签", () => {
  Catalog.TYPES.forEach((t) => {
    const c = Catalog.get(t);
    assert.ok(c.label && c.declare && c.initCode && c.comment, t);
  });
  assert.ok(Catalog.get("led").actions.some((a) => a.id === "on" && a.label === "亮"));
  assert.ok(Catalog.get("servo").actions.some((a) => a.id === "write" && a.param === "angle"));
  assert.ok(Catalog.get("key").states.some((s) => s.id === "pressed"));
});
```

- [x] **Step 2: 跑测试看失败**（与实现同批写入后一次跑绿，未单独红跑，记录备案）

- [x] **Step 3: 实现 `web/js/catalog.js`（全文）**

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.Catalog = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var GPIO_PINS = ["PA0","PA1","PA2","PA3","PA4","PA5","PA6","PA7","PA8","PA9","PA10","PA11","PA12","PA15",
                   "PB0","PB1","PB5","PB6","PB7","PB8","PB9","PB10","PB11","PB12","PB13","PB14","PB15",
                   "PC13"];

  var SERVO_CHANNELS = [
    { id: "TIM1_CH1", tim: "TIM1", chCode: "TIM_CHANNEL_1", pin: "PA8" },
    { id: "TIM1_CH2", tim: "TIM1", chCode: "TIM_CHANNEL_2", pin: "PA9" },
    { id: "TIM1_CH3", tim: "TIM1", chCode: "TIM_CHANNEL_3", pin: "PA10" },
    { id: "TIM1_CH4", tim: "TIM1", chCode: "TIM_CHANNEL_4", pin: "PA11" },
    { id: "TIM2_CH1", tim: "TIM2", chCode: "TIM_CHANNEL_1", pin: "PA0" },
    { id: "TIM2_CH2", tim: "TIM2", chCode: "TIM_CHANNEL_2", pin: "PA1" },
    { id: "TIM2_CH3", tim: "TIM2", chCode: "TIM_CHANNEL_3", pin: "PA2" },
    { id: "TIM2_CH4", tim: "TIM2", chCode: "TIM_CHANNEL_4", pin: "PA3" },
    { id: "TIM3_CH1", tim: "TIM3", chCode: "TIM_CHANNEL_1", pin: "PA6" },
    { id: "TIM3_CH2", tim: "TIM3", chCode: "TIM_CHANNEL_2", pin: "PA7" },
    { id: "TIM3_CH3", tim: "TIM3", chCode: "TIM_CHANNEL_3", pin: "PB0" },
    { id: "TIM3_CH4", tim: "TIM3", chCode: "TIM_CHANNEL_4", pin: "PB1" },
    { id: "TIM4_CH1", tim: "TIM4", chCode: "TIM_CHANNEL_1", pin: "PB6" },
    { id: "TIM4_CH2", tim: "TIM4", chCode: "TIM_CHANNEL_2", pin: "PB7" },
    { id: "TIM4_CH3", tim: "TIM4", chCode: "TIM_CHANNEL_3", pin: "PB8" },
    { id: "TIM4_CH4", tim: "TIM4", chCode: "TIM_CHANNEL_4", pin: "PB9" }
  ];
  SERVO_CHANNELS.forEach(function (c) { c.label = c.id + "（" + c.pin + "）"; });

  var PIN_OPTIONS = GPIO_PINS.map(function (p) { return { v: p, label: p }; });
  var CHANNEL_OPTIONS = SERVO_CHANNELS.map(function (c) { return { v: c.id, label: c.label }; });

  var CATALOG = {
    key: {
      label: "按键", declare: "Key",
      params: [
        { key: "pin", label: "引脚", type: "pin", options: PIN_OPTIONS },
        { key: "pull", label: "电阻", type: "select", options: [
            { v: "up", label: "上拉", code: "PULL_UP" }, { v: "down", label: "下拉", code: "PULL_DOWN" }] }
      ],
      states: [
        { id: "pressed", label: "被按下", code: "Key_IsPressed(&{n})" },
        { id: "released", label: "被松开", code: "Key_IsReleased(&{n})" }
      ],
      actions: [],
      initCode: "Key_Init(&{n}, {port}, {pin}, {pull})",
      comment: "按键({pin}, {pullLabel})"
    },
    led: {
      label: "LED", declare: "Led",
      params: [
        { key: "pin", label: "引脚", type: "pin", options: PIN_OPTIONS },
        { key: "active", label: "亮度逻辑", type: "select", options: [
            { v: "high", label: "高电平亮", code: "ACTIVE_HIGH" }, { v: "low", label: "低电平亮", code: "ACTIVE_LOW" }] }
      ],
      states: [],
      actions: [
        { id: "on", label: "亮", code: "Led_On(&{n});" },
        { id: "off", label: "灭", code: "Led_Off(&{n});" },
        { id: "toggle", label: "翻转", code: "Led_Toggle(&{n});" }
      ],
      initCode: "Led_Init(&{n}, {port}, {pin}, {active})",
      comment: "LED({pin}, {activeLabel})"
    },
    buzzer: {
      label: "蜂鸣器", declare: "Buzzer",
      params: [
        { key: "pin", label: "引脚", type: "pin", options: PIN_OPTIONS },
        { key: "active", label: "触发逻辑", type: "select", options: [
            { v: "high", label: "高电平响", code: "ACTIVE_HIGH" }, { v: "low", label: "低电平响", code: "ACTIVE_LOW" }] }
      ],
      states: [],
      actions: [
        { id: "on", label: "响", code: "Buzzer_On(&{n});" },
        { id: "off", label: "停", code: "Buzzer_Off(&{n});" },
        { id: "toggle", label: "翻转", code: "Buzzer_Toggle(&{n});" }
      ],
      initCode: "Buzzer_Init(&{n}, {port}, {pin}, {active})",
      comment: "蜂鸣器({pin}, {activeLabel})"
    },
    servo: {
      label: "舵机", declare: "Servo",
      params: [{ key: "channel", label: "定时器通道", type: "channel", options: CHANNEL_OPTIONS }],
      states: [],
      actions: [{ id: "write", label: "转到", param: "angle", paramLabel: "度",
                  paramType: "number", defaultParam: 90, min: 0, max: 180,
                  code: "Servo_Write(&{n}, {angle});" }],
      initCode: "Servo_Init(&{n}, {tim}, {chCode})",
      comment: "舵机({channel})"
    },
    int: {
      label: "整数", declare: "int",
      params: [{ key: "init", label: "初始值", type: "number", default: 0 }],
      states: [],
      actions: [
        { id: "set", label: "设为", param: "value", defaultParam: 0, code: "{n} = {value};" },
        { id: "add", label: "加", param: "value", defaultParam: 1, code: "{n} = {n} + {value};" },
        { id: "sub", label: "减", param: "value", defaultParam: 1, code: "{n} = {n} - {value};" }
      ],
      conditions: [
        { id: "ge", label: "≥", op: ">=" }, { id: "gt", label: ">", op: ">" },
        { id: "eq", label: "=", op: "=" }, { id: "le", label: "≤", op: "<=" },
        { id: "lt", label: "<", op: "<" }
      ],
      initCode: "{n} = {init};",
      comment: "整数({init})"
    }
  };

  function get(type) { return CATALOG[type]; }

  function labelOf(options, v) {
    for (var i = 0; i < options.length; i++) { if (options[i].v === v) { return options[i].label; } }
    return v;
  }
  function codeOf(options, v) {
    for (var i = 0; i < options.length; i++) { if (options[i].v === v) { return options[i].code || options[i].v; } }
    return v;
  }

  function pinLabel(pin) { return pin; }
  function channelLabel(id) { return id; }

  function gpioPortOf(pin) { return "GPIO" + pin.charAt(1); }
  function gpioPinMacroOf(pin) { return "GPIO_PIN_" + pin.slice(2); }

  function pinOfObject(obj) {
    if (obj.type === "servo") {
      for (var i = 0; i < SERVO_CHANNELS.length; i++) {
        if (SERVO_CHANNELS[i].id === obj.params.channel) { return SERVO_CHANNELS[i].pin; }
      }
      return null;
    }
    if (obj.type === "key" || obj.type === "led" || obj.type === "buzzer") { return obj.params.pin; }
    return null;
  }

  return {
    GPIO_PINS: GPIO_PINS, SERVO_CHANNELS: SERVO_CHANNELS,
    TYPES: ["key", "led", "buzzer", "servo", "int"],
    get: get, labelOf: labelOf, codeOf: codeOf,
    pinLabel: pinLabel, channelLabel: channelLabel,
    gpioPortOf: gpioPortOf, gpioPinMacroOf: gpioPinMacroOf, pinOfObject: pinOfObject
  };
});
```

- [x] **Step 4: 跑测试到全绿**（2026-10-03：全量 `node --test` PASS ×10）

- [x] **Step 5: Commit**

```bash
git add web/js/catalog.js tests/catalog.test.js && git commit -m "feat: 积木目录 catalog.js（引脚表/舵机通道表/五种对象定义）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: validate.js（校验）

**Files:**
- Create: `web/js/validate.js`
- Test: `tests/validate.test.js`

**Interfaces:**
- Consumes: `Catalog`。
- Produces：

```js
Validate.check(project) // -> { errors: [ {code:"PIN_CONFLICT"|"BAD_NAME"|"DUP_NAME", message:"中文说明", objectIds:[...]} ] }
```

- [ ] **Step 1: 写失败测试 `tests/validate.test.js`（全文）**

```js
const test = require("node:test");
const assert = require("node:assert");
const Catalog = require("../web/js/catalog.js");
const Model = require("../web/js/model.js");
const Validate = require("../web/js/validate.js");

test("无冲突时零错误", () => {
  const p = Model.newProject("t");
  Model.addObject(p, "key", { pin: "PA1", pull: "up" });
  Model.addObject(p, "led", { pin: "PC13", active: "high" });
  assert.deepEqual(Validate.check(p).errors, []);
});

test("两个 GPIO 对象同引脚报错", () => {
  const p = Model.newProject("t");
  Model.addObject(p, "led", { pin: "PB1", active: "high" });
  const b = Model.addObject(p, "buzzer", { pin: "PB1", active: "low" });
  const e = Validate.check(p).errors;
  assert.equal(e.length, 1);
  assert.equal(e[0].code, "PIN_CONFLICT");
  assert.ok(e[0].objectIds.length === 2);
});

test("舵机通道引脚与 GPIO 对象撞车也算冲突（PB1 = TIM3_CH4）", () => {
  const p = Model.newProject("t");
  Model.addObject(p, "buzzer", { pin: "PB1", active: "low" });
  Model.addObject(p, "servo", { channel: "TIM3_CH4" });
  const e = Validate.check(p).errors;
  assert.equal(e.length, 1);
  assert.equal(e[0].code, "PIN_CONFLICT");
});

test("名字非法与重名报错", () => {
  const p = Model.newProject("t");
  const a = Model.addObject(p, "led", { pin: "PC13", active: "high" });
  const b = Model.addObject(p, "led", { pin: "PA0", active: "high" });
  a.name = "1bad";  b.name = "1bad";
  const codes = Validate.check(p).errors.map((x) => x.code);
  assert.ok(codes.includes("BAD_NAME"));
  assert.ok(codes.includes("DUP_NAME"));
});
```

- [ ] **Step 2: 跑测试看失败** → `node --test tests/validate.test.js`，Expected: FAIL

- [ ] **Step 3: 实现 `web/js/validate.js`（全文）**

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"));
  } else {
    root.Validate = factory(root.Catalog);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog) {
  "use strict";

  var NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

  function check(project) {
    var errors = [];

    // 1) 名字
    var seen = {};
    project.objects.forEach(function (o) {
      if (!NAME_RE.test(o.name)) {
        errors.push({ code: "BAD_NAME", message: "对象名 \"" + o.name + "\" 只能用字母/数字/下划线，字母开头", objectIds: [o.id] });
      } else if (seen[o.name]) {
        errors.push({ code: "DUP_NAME", message: "对象名重复：" + o.name, objectIds: [seen[o.name], o.id] });
      } else {
        seen[o.name] = o.id;
      }
    });

    // 2) 引脚冲突（含舵机通道映射到的引脚）
    var byPin = {};
    project.objects.forEach(function (o) {
      var pin = Catalog.pinOfObject(o);
      if (!pin) { return; }
      if (byPin[pin]) { byPin[pin].push(o.id); } else { byPin[pin] = [o.id]; }
    });
    Object.keys(byPin).forEach(function (pin) {
      if (byPin[pin].length > 1) {
        var names = byPin[pin].map(function (id) {
          var o = project.objects.filter(function (x) { return x.id === id; })[0];
          return o ? o.name : id;
        });
        errors.push({ code: "PIN_CONFLICT", message: "引脚冲突：" + pin + " 被 " + names.join("、") + " 同时占用",
                      objectIds: byPin[pin] });
      }
    });

    return { errors: errors };
  }

  return { check: check };
});
```

- [ ] **Step 4: 跑测试到全绿** → `node --test tests/validate.test.js`，Expected: PASS ×4

- [ ] **Step 5: Commit**

```bash
git add web/js/validate.js tests/validate.test.js && git commit -m "feat: 校验模块 validate.js（引脚冲突/名字规则）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: codegen.js（代码生成，golden 测试锁死格式）

**Files:**
- Create: `web/js/codegen.js`
- Test: `tests/codegen.test.js`

**Interfaces:**
- Consumes: `Catalog`、工程模型（§4.2 JSON）。
- Produces：

```js
Codegen.generate(project) // -> string（完整 user_code.c 内容，UTF-8，末尾带换行）
```

- [ ] **Step 1: 写失败测试 `tests/codegen.test.js`（全文，golden 样例与设计文档 §5.3 逐字符一致）**

```js
const test = require("node:test");
const assert = require("node:assert");
const Model = require("../web/js/model.js");
const Codegen = require("../web/js/codegen.js");

function sampleProject() {
  const p = Model.newProject("小明的作品");
  const key = Object.assign(Model.addObject(p, "key", { pin: "PA1", pull: "up" }), { id: "o1", name: "key1" });
  const led = Object.assign(Model.addObject(p, "led", { pin: "PC13", active: "high" }), { id: "o2", name: "led1" });
  const buz = Object.assign(Model.addObject(p, "buzzer", { pin: "PB1", active: "low" }), { id: "o3", name: "buzzer1" });
  const srv = Object.assign(Model.addObject(p, "servo", { channel: "TIM1_CH1" }), { id: "o4", name: "servo1" });
  const cnt = Object.assign(Model.addObject(p, "int", { init: 0 }), { id: "o5", name: "count" });
  p.loop.push(Model.nodeIf(Model.condState(key.id, "pressed"), [
    Model.nodeAction(buz.id, "on"),
    Model.nodeAction(led.id, "toggle"),
    Model.nodeAction(srv.id, "write", 90),
    Model.nodeAction(cnt.id, "add", 1)
  ], [
    Model.nodeAction(buz.id, "off"),
    Model.nodeDelay(50)
  ]));
  return p;
}

const EXPECTED = [
"/* user_code.c — 由积木自动生成，请勿手改 */",
"#include \"user_app.h\"",
"",
"/* ===== 你创建的对象 ===== */",
"Key    key1;      /* key1 = 按键(PA1, 上拉) */",
"Led    led1;      /* led1 = LED(PC13, 高电平亮) */",
"Buzzer buzzer1;   /* buzzer1 = 蜂鸣器(PB1, 低电平响) */",
"Servo  servo1;    /* servo1 = 舵机(TIM1_CH1) */",
"int    count;     /* count = 整数(0) */",
"",
"void user_setup(void)",
"{",
"    Key_Init(&key1, GPIOA, GPIO_PIN_1, PULL_UP);",
"    Led_Init(&led1, GPIOC, GPIO_PIN_13, ACTIVE_HIGH);",
"    Buzzer_Init(&buzzer1, GPIOB, GPIO_PIN_1, ACTIVE_LOW);",
"    Servo_Init(&servo1, TIM1, TIM_CHANNEL_1);",
"    count = 0;",
"}",
"",
"void user_loop(void)",
"{",
"    if (Key_IsPressed(&key1)) {",
"        Buzzer_On(&buzzer1);",
"        Led_Toggle(&led1);",
"        Servo_Write(&servo1, 90);",
"        count = count + 1;",
"    } else {",
"        Buzzer_Off(&buzzer1);",
"        Delay_ms(50);",
"    }",
"}",
""
].join("\n");

test("golden：与设计文档 §5.3 样例逐字符一致", () => {
  assert.equal(Codegen.generate(sampleProject()), EXPECTED);
});

test("空 else 段直接省略", () => {
  const p = Model.newProject("t");
  const k = Model.addObject(p, "key", { pin: "PA1", pull: "up" });
  const l = Model.addObject(p, "led", { pin: "PC13", active: "high" });
  p.loop.push(Model.nodeIf(Model.condState(k.id, "pressed"), [Model.nodeAction(l.id, "on")], []));
  const code = Codegen.generate(p);
  assert.ok(!code.includes("else"));
  assert.ok(code.includes("if (Key_IsPressed(&key1)) {"));
});

test("嵌套 if 与变量比较条件", () => {
  const p = Model.newProject("t");
  const c = Model.addObject(p, "int", { init: 0 });
  const k = Model.addObject(p, "key", { pin: "PA1", pull: "up" });
  p.loop.push(Model.nodeIf(Model.condCompare(c.id, ">=", 5), [
    Model.nodeAction(c.id, "sub", 5),
    Model.nodeIf(Model.condState(k.id, "released"), [Model.nodeDelay(10)], [])
  ], []));
  const code = Codegen.generate(p);
  assert.ok(code.includes("if (count1 >= 5) {"));
  assert.ok(code.includes("        if (Key_IsReleased(&key1)) {"));   // 嵌套缩进 8 空格
  assert.ok(code.includes("count1 = count1 - 5;"));
});

test("空主循环生成空 user_loop", () => {
  const p = Model.newProject("t");
  const code = Codegen.generate(p);
  assert.ok(code.includes("void user_loop(void)\n{\n}\n"));
});
```

- [ ] **Step 2: 跑测试看失败** → `node --test tests/codegen.test.js`，Expected: FAIL

- [ ] **Step 3: 实现 `web/js/codegen.js`（全文）**

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"), require("./model.js"));
  } else {
    root.Codegen = factory(root.Catalog, root.Model);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog, Model) {
  "use strict";

  var INDENT = "    ";

  function fill(tpl, map) {
    return tpl.replace(/\{(\w+)\}/g, function (_, k) { return map[k] !== undefined ? map[k] : "{" + k + "}"; });
  }

  function paramOption(obj, paramKey, optKey) {
    var def = Catalog.get(obj.type).params.filter(function (p) { return p.key === paramKey; })[0];
    return def ? Catalog.codeOf(def.options || [], obj.params[paramKey]) : obj.params[paramKey];
  }
  function paramLabel(obj, paramKey) {
    var def = Catalog.get(obj.type).params.filter(function (p) { return p.key === paramKey; })[0];
    return def ? Catalog.labelOf(def.options || [], obj.params[paramKey]) : obj.params[paramKey];
  }

  function initArgs(obj) {
    if (obj.type === "servo") {
      var ch = Catalog.SERVO_CHANNELS.filter(function (c) { return c.id === obj.params.channel; })[0];
      return { tim: ch ? ch.tim : obj.params.channel, chCode: ch ? ch.chCode : "" };
    }
    var map = {};
    if (obj.type === "key" || obj.type === "led" || obj.type === "buzzer") {
      map.port = Catalog.gpioPortOf(obj.params.pin);
      map.pin = Catalog.gpioPinMacroOf(obj.params.pin);
    }
    if (obj.type === "key") { map.pull = paramOption(obj, "pull"); }
    if (obj.type === "led" || obj.type === "buzzer") { map.active = paramOption(obj, "active"); }
    if (obj.type === "int") { map.init = String(obj.params.init); }
    return map;
  }

  function commentText(obj) {
    var map = { n: obj.name };
    if (obj.type === "servo") { map.channel = obj.params.channel; }
    if (obj.type === "key" || obj.type === "led" || obj.type === "buzzer") { map.pin = obj.params.pin; }
    if (obj.type === "key") { map.pullLabel = paramLabel(obj, "pull"); }
    if (obj.type === "led" || obj.type === "buzzer") { map.activeLabel = paramLabel(obj, "active"); }
    if (obj.type === "int") { map.init = String(obj.params.init); }
    return obj.name + " = " + fill(Catalog.get(obj.type).comment, map);
  }

  function emitCondition(cond, project) {
    var obj = Model.findObject(project, cond.objectId);
    if (cond.kind === "state") {
      var st = Catalog.get(obj.type).states.filter(function (s) { return s.id === cond.state; })[0];
      return fill(st.code, { n: obj.name });
    }
    var op = cond.op === "=" ? "==" : cond.op;
    return obj.name + " " + op + " " + cond.value;
  }

  function emitNodes(nodes, depth, project, out) {
    var pad = INDENT.repeat(depth);
    nodes.forEach(function (node) {
      var obj;
      if (node.kind === "delay") {
        out.push(pad + "Delay_ms(" + node.ms + ");");
      } else if (node.kind === "action") {
        obj = Model.findObject(project, node.objectId);
        var act = Catalog.get(obj.type).actions.filter(function (a) { return a.id === node.action; })[0];
        var map = { n: obj.name };
        if (act.param) { map[act.param] = node.value !== undefined ? node.value : act.defaultParam; }
        out.push(pad + fill(act.code, map));
      } else if (node.kind === "if") {
        out.push(pad + "if (" + emitCondition(node.cond, project) + ") {");
        emitNodes(node.then, depth + 1, project, out);
        if (node.else.length > 0) {
          out.push(pad + "} else {");
          emitNodes(node.else, depth + 1, project, out);
        }
        out.push(pad + "}");
      }
    });
  }

  function generate(project) {
    var out = [];
    out.push("/* user_code.c — 由积木自动生成，请勿手改 */");
    out.push("#include \"user_app.h\"");
    out.push("");
    out.push("/* ===== 你创建的对象 ===== */");
    project.objects.forEach(function (obj) {
      var decl = Catalog.get(obj.type).declare;
      out.push(decl.padEnd(7) + (obj.name + ";").padEnd(11) + "/* " + commentText(obj) + " */");
    });
    out.push("");
    out.push("void user_setup(void)");
    out.push("{");
    project.objects.forEach(function (obj) {
      var map = initArgs(obj);
      map.n = obj.name;
      out.push(INDENT + fill(Catalog.get(obj.type).initCode, map) + ";");
    });
    out.push("}");
    out.push("");
    out.push("void user_loop(void)");
    out.push("{");
    emitNodes(project.loop, 1, project, out);
    out.push("}");
    return out.join("\n") + "\n";
  }

  return { generate: generate };
});
```

- [ ] **Step 4: 跑测试到全绿** → `node --test tests/codegen.test.js`，Expected: PASS ×4（golden 必须先绿，格式一字都不能差）

- [ ] **Step 5: 跑全量测试回归** → `node --test tests/`，Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add web/js/codegen.js tests/codegen.test.js && git commit -m "feat: 代码生成 codegen.js，golden 测试锁定 §5.3 格式

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: examples.js（三个内置示例）

**Files:**
- Create: `web/js/examples.js`
- Test: `tests/examples.test.js`

**Interfaces:**
- Consumes: `Model`、`Validate`、`Codegen`。
- Produces：

```js
Examples.list()      // -> [{id:"blink", label:"按键点灯"}, {id:"combo", label:"按键组合技"}, {id:"sweep", label:"舵机来回摆"}]
Examples.load(id)    // -> 全新 project 对象（深拷贝）
```

- [ ] **Step 1: 写失败测试 `tests/examples.test.js`（全文）**

```js
const test = require("node:test");
const assert = require("node:assert");
const Examples = require("../web/js/examples.js");
const Validate = require("../web/js/validate.js");
const Codegen = require("../web/js/codegen.js");

test("三个示例都存在且校验通过", () => {
  assert.equal(Examples.list().length, 3);
  Examples.list().forEach((e) => {
    const p = Examples.load(e.id);
    assert.equal(Validate.check(p).errors.length, 0, e.id + " 应无校验错误");
    assert.ok(Codegen.generate(p).includes("void user_loop(void)"));
  });
});

test("combo 示例包含组合动作", () => {
  const code = Codegen.generate(Examples.load("combo"));
  assert.ok(code.includes("Buzzer_On"));
  assert.ok(code.includes("Led_Toggle"));
  assert.ok(code.includes("Servo_Write"));
  assert.ok(code.includes("count1 = count1 + 1;"));
});

test("load 返回深拷贝（改不坏模板）", () => {
  const a = Examples.load("blink");
  a.loop.length = 0;
  assert.ok(Examples.load("blink").loop.length > 0);
});
```

- [ ] **Step 2: 跑测试看失败** → `node --test tests/examples.test.js`，Expected: FAIL

- [ ] **Step 3: 实现 `web/js/examples.js`（全文）**

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./model.js"));
  } else {
    root.Examples = factory(root.Model);
  }
})(typeof self !== "undefined" ? self : this, function (Model) {
  "use strict";

  function blink() {
    var p = Model.newProject("按键点灯");
    var key = Object.assign(Model.addObject(p, "key", { pin: "PA1", pull: "up" }), { id: "o1", name: "key1" });
    var led = Object.assign(Model.addObject(p, "led", { pin: "PC13", active: "low" }), { id: "o2", name: "led1" });
    p.loop.push(Model.nodeIf(Model.condState(key.id, "pressed"),
      [Model.nodeAction(led.id, "on")],
      [Model.nodeAction(led.id, "off")]));
    return p;
  }

  function combo() {
    var p = Model.newProject("按键组合技");
    var key = Object.assign(Model.addObject(p, "key", { pin: "PA1", pull: "up" }), { id: "o1", name: "key1" });
    var led = Object.assign(Model.addObject(p, "led", { pin: "PC13", active: "low" }), { id: "o2", name: "led1" });
    var buz = Object.assign(Model.addObject(p, "buzzer", { pin: "PB1", active: "low" }), { id: "o3", name: "buzzer1" });
    var srv = Object.assign(Model.addObject(p, "servo", { channel: "TIM2_CH1" }), { id: "o4", name: "servo1" });
    var cnt = Object.assign(Model.addObject(p, "int", { init: 0 }), { id: "o5", name: "count1" });
    p.loop.push(Model.nodeIf(Model.condState(key.id, "pressed"), [
      Model.nodeAction(buz.id, "on"),
      Model.nodeAction(led.id, "toggle"),
      Model.nodeAction(srv.id, "write", 90),
      Model.nodeAction(cnt.id, "add", 1),
      Model.nodeDelay(200)
    ], [
      Model.nodeAction(buz.id, "off"),
      Model.nodeAction(srv.id, "write", 0)
    ]));
    return p;
  }

  function sweep() {
    var p = Model.newProject("舵机来回摆");
    var srv = Object.assign(Model.addObject(p, "servo", { channel: "TIM2_CH1" }), { id: "o1", name: "servo1" });
    p.loop.push(
      Model.nodeAction(srv.id, "write", 0),
      Model.nodeDelay(500),
      Model.nodeAction(srv.id, "write", 180),
      Model.nodeDelay(500));
    return p;
  }

  var ALL = [
    { id: "blink", label: "按键点灯", build: blink },
    { id: "combo", label: "按键组合技", build: combo },
    { id: "sweep", label: "舵机来回摆", build: sweep }
  ];

  function list() { return ALL.map(function (e) { return { id: e.id, label: e.label }; }); }
  function load(id) {
    var e = ALL.filter(function (x) { return x.id === id; })[0];
    if (!e) { throw new Error("示例不存在: " + id); }
    return Model.deserialize(Model.serialize(e.build()));
  }

  return { list: list, load: load };
});
```

- [ ] **Step 4: 跑测试到全绿** → `node --test tests/examples.test.js`，Expected: PASS ×3

- [ ] **Step 5: Commit**

```bash
git add web/js/examples.js tests/examples.test.js && git commit -m "feat: 三个内置示例 examples.js

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 界面骨架（三栏布局 + 对象区 + 代码面板 + 校验横幅）

**Files:**
- Create: `web/index.html`（替换占位）、`web/css/style.css`、`web/js/render.js`、`web/js/objects.js`、`web/js/app.js`

**Interfaces:**
- Consumes: Catalog/Model/Validate/Codegen/Examples。
- Produces：

```js
Render.renderObjects(container, project, handlers)      // 对象卡片列表
Render.renderBlockList(container, nodes, project, opts) // 语句树渲染（opts.interactive 后由拖拽内核接管）
Render.renderCode(code)                                 // 代码面板（带高亮）
App.init()                                              // 装配一切（index.html 末尾调用）
App.refresh()                                           // 变更后统一刷新：validate→横幅、codegen→代码面板、localStorage 保存
```

- [ ] **Step 1: 写 `web/index.html`（全文）**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>STM32 积木工坊</title>
<link rel="stylesheet" href="css/style.css">
</head>
<body>
<header>
  <h1>STM32 积木工坊</h1>
  <input id="project-name" type="text" value="我的工程" title="工程名（下载的文件夹名）">
  <div id="error-banner" class="hidden"></div>
  <button id="btn-download" disabled>⬇ 下载完整工程</button>
</header>
<main>
  <section id="panel-objects">
    <h2>对象区</h2>
    <div id="object-list"></div>
    <button id="btn-add-object">＋ 新建对象</button>
  </section>
  <section id="panel-canvas">
    <h2>主循环</h2>
    <div id="palette">
      <div class="pal-block pal-action" data-palette="action">动作</div>
      <div class="pal-block pal-delay"  data-palette="delay">延时</div>
      <div class="pal-block pal-if"     data-palette="if">如果</div>
    </div>
    <div id="canvas">
      <div id="loop-slot" data-drop-list="loop"></div>
      <div id="trash" class="hidden">🗑</div>
    </div>
  </section>
  <section id="panel-code">
    <h2>生成的代码</h2>
    <pre id="code-view"></pre>
    <button id="btn-copy">复制代码</button>
  </section>
</main>

<!-- 新建/编辑对象弹窗 -->
<dialog id="object-dialog">
  <form method="dialog">
    <h3 id="dlg-title">新建对象</h3>
    <label>名字 <input id="dlg-name" type="text"></label>
    <div id="dlg-types"></div>
    <div id="dlg-params"></div>
    <p id="dlg-hint" class="hidden"></p>
    <menu><button value="cancel">取消</button><button id="dlg-ok" value="ok">确定</button></menu>
  </form>
</dialog>

<script src="vendor/jszip.min.js"></script>
<script src="js/catalog.js"></script>
<script src="js/model.js"></script>
<script src="js/validate.js"></script>
<script src="js/codegen.js"></script>
<script src="js/examples.js"></script>
<script src="js/render.js"></script>
<script src="js/objects.js"></script>
<script src="js/app.js"></script>
</body>
</html>
```

（`js/dragdrop.js`、`js/packer.js`、`js/template-data.js` 在后续任务写完后再往这里加 `<script>`。）

- [ ] **Step 2: 写 `web/css/style.css`（全文）**

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; background: #f4f6fa; }
header { display: flex; align-items: center; gap: 16px; padding: 10px 18px; background: #fff; border-bottom: 2px solid #e3e8f0; }
header h1 { font-size: 20px; margin: 0; color: #2b3a55; }
#project-name { font-size: 14px; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; }
#error-banner { flex: 1; color: #b42318; background: #fef3f2; border: 1px solid #fda29b; border-radius: 6px; padding: 6px 10px; font-size: 13px; }
.hidden { display: none !important; }
#btn-download { margin-left: auto; background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font-size: 15px; cursor: pointer; }
#btn-download:disabled { background: #9db4d8; cursor: not-allowed; }

main { display: grid; grid-template-columns: 240px 1fr 380px; gap: 12px; padding: 12px; height: calc(100vh - 64px); }
section { background: #fff; border-radius: 10px; padding: 12px; overflow: auto; }
section h2 { font-size: 14px; color: #64748b; margin: 0 0 10px; }

#object-list .obj-card { border: 1px solid #dbe3ef; border-left: 4px solid #2563eb; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; cursor: pointer; }
#object-list .obj-card code { color: #0f172a; font-size: 13px; }
#object-list .obj-card .obj-del { float: right; color: #b42318; cursor: pointer; border: 0; background: none; }
#btn-add-object { width: 100%; padding: 8px; border: 1px dashed #94a3b8; border-radius: 8px; background: #f8fafc; cursor: pointer; }

#palette { display: flex; gap: 8px; margin-bottom: 12px; }
.pal-block { padding: 8px 14px; border-radius: 8px; color: #fff; cursor: grab; user-select: none; font-size: 14px; }
.pal-action { background: #2563eb; } .pal-delay { background: #ea7a1a; } .pal-if { background: #7c3aed; }

#canvas { position: relative; min-height: 320px; border: 2px dashed #d3dbe8; border-radius: 10px; padding: 12px; }
#trash { position: fixed; right: 420px; bottom: 30px; font-size: 34px; background: #fee4e2; border: 2px dashed #f97066; border-radius: 12px; padding: 10px 16px; }

#panel-code pre { margin: 0 0 10px; font-size: 12.5px; line-height: 1.5; overflow: auto; }
.tok-kw { color: #7c3aed; } .tok-comment { color: #6b7280; } .tok-num { color: #b45309; } .tok-str { color: #15803d; }

dialog { border: 0; border-radius: 12px; padding: 18px; min-width: 340px; }
#dlg-types { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
#dlg-types button { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
#dlg-types button.sel { background: #2563eb; color: #fff; border-color: #2563eb; }
#dlg-params label { display: block; margin: 8px 0; }
#dlg-params select, #dlg-params input { width: 100%; padding: 5px; }
#dlg-hint { color: #b42318; }
```

- [ ] **Step 3: 写 `web/js/render.js`（全文；本任务先实现 objects/blocks/code 渲染，拖拽 opt 先摆好接口）**

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"), require("./model.js"));
  } else {
    root.Render = factory(root.Catalog, root.Model);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog, Model) {
  "use strict";

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }

  function renderObjects(container, project, handlers) {
    container.innerHTML = "";
    project.objects.forEach(function (obj) {
      var card = el("div", "obj-card");
      var del = el("button", "obj-del", "✕");
      del.title = "删除对象";
      del.onclick = function (ev) { ev.stopPropagation(); handlers.onDelete(obj.id); };
      var code = el("code", null, obj.name + " = " + Catalog.get(obj.type).label);
      var desc = el("div", null, describeParams(obj));
      desc.style.fontSize = "12px"; desc.style.color = "#64748b";
      card.appendChild(del); card.appendChild(code); card.appendChild(desc);
      card.onclick = function () { handlers.onEdit(obj.id); };
      container.appendChild(card);
    });
  }

  function describeParams(obj) {
    return Object.keys(obj.params).map(function (k) { return k + "=" + obj.params[k]; }).join(" ");
  }

  function renderBlockList(container, nodes, project, opts) {
    container.innerHTML = "";
    nodes.forEach(function (node) {
      container.appendChild(renderNode(node, project, opts || {}));
    });
  }

  function renderNode(node, project) {
    if (node.kind === "delay") {
      var d = el("div", "blk blk-delay", "延时 " + node.ms + " 毫秒");
      return d;
    }
    if (node.kind === "action") {
      var obj = Model.findObject(project, node.objectId) || { name: "?" };
      var act = "?";
      try {
        act = Catalog.get(obj.type).actions.filter(function (a) { return a.id === node.action; })[0].label;
      } catch (e) { /* 忽略渲染错误 */ }
      var extra = node.value !== undefined ? " " + node.value : "";
      return el("div", "blk blk-action", obj.name + " " + act + extra);
    }
    if (node.kind === "if") {
      var wrap = el("div", "blk blk-if");
      var obj2 = Model.findObject(project, node.cond.objectId) || { name: "?" };
      var condText = node.cond.kind === "state"
        ? obj2.name + " " + (node.cond.state === "pressed" ? "被按下" : "被松开")
        : obj2.name + " " + node.cond.op + " " + node.cond.value;
      wrap.appendChild(el("div", "if-head", "如果 " + condText + " 则"));
      var thenBox = el("div", "if-body");
      renderBlockList(thenBox, node.then, project);
      wrap.appendChild(thenBox);
      if (node.else.length > 0) {
        wrap.appendChild(el("div", "if-else-head", "否则"));
        var elseBox = el("div", "if-body");
        renderBlockList(elseBox, node.else, project);
        wrap.appendChild(elseBox);
      }
      return wrap;
    }
    return el("div", "blk", "?");
  }

  function highlight(code) {
    var esc = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>')
      .replace(/\b(void|if|else|int|return)\b/g, '<span class="tok-kw">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="tok-num">$1</span>');
  }

  function renderCode(code) {
    document.getElementById("code-view").innerHTML = highlight(code);
  }

  return { el: el, renderObjects: renderObjects, renderBlockList: renderBlockList, renderNode: renderNode, renderCode: renderCode };
});
```

- [ ] **Step 4: 写 `web/js/objects.js`（全文；新建/编辑弹窗）**

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"), require("./model.js"));
  } else {
    root.ObjectsUI = factory(root.Catalog, root.Model);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog, Model) {
  "use strict";

  var NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  var state = { type: null, objId: null };

  function open(project, objId, onDone) {
    var dlg = document.getElementById("object-dialog");
    var editing = !!objId;
    var obj = editing ? Model.findObject(project, objId) : null;
    state.type = editing ? obj.type : null;
    state.objId = objId || null;

    document.getElementById("dlg-title").textContent = editing ? "编辑对象" : "新建对象";
    document.getElementById("dlg-name").value = editing ? obj.name : "";
    renderTypes();
    renderParams(obj);
    document.getElementById("dlg-hint").classList.add("hidden");

    document.getElementById("dlg-ok").onclick = function (ev) {
      var name = document.getElementById("dlg-name").value.trim();
      var hint = document.getElementById("dlg-hint");
      if (!NAME_RE.test(name)) { hint.textContent = "名字只能用字母/数字/下划线，且字母开头"; hint.classList.remove("hidden"); ev.preventDefault(); return; }
      var dup = project.objects.some(function (o) { return o.name === name && o.id !== state.objId; });
      if (dup) { hint.textContent = "名字已被占用"; hint.classList.remove("hidden"); ev.preventDefault(); return; }
      var params = collectParams();
      if (editing) { obj.name = name; obj.params = params; }
      else { var created = Model.addObject(project, state.type, params); created.name = name; }
      onDone();
    };
    dlg.showModal();
  }

  function renderTypes() {
    var box = document.getElementById("dlg-types");
    box.innerHTML = "";
    Catalog.TYPES.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = Catalog.get(t).label;
      if (t === state.type) { b.className = "sel"; }
      b.onclick = function () { state.type = t; renderTypes(); renderParams(null); };
      box.appendChild(b);
    });
  }

  function renderParams(obj, defaults) {
    var box = document.getElementById("dlg-params");
    box.innerHTML = "";
    if (!state.type) { return; }
    Catalog.get(state.type).params.forEach(function (p) {
      var label = document.createElement("label");
      label.textContent = p.label + " ";
      var input;
      var current = obj ? obj.params[p.key] : (defaults && defaults[p.key]);
      if (current === undefined) {
        current = p.type === "number" ? (p.default !== undefined ? p.default : 0)
                : (p.options && p.options.length ? p.options[0].v : "");
      }
      if (p.options) {
        input = document.createElement("select");
        p.options.forEach(function (o) {
          var opt = document.createElement("option");
          opt.value = o.v; opt.textContent = o.label;
          if (o.v === current) { opt.selected = true; }
          input.appendChild(opt);
        });
      } else {
        input = document.createElement("input");
        input.type = p.type === "number" ? "number" : "text";
        input.value = current;
      }
      input.dataset.param = p.key;
      label.appendChild(input);
      box.appendChild(label);
    });
  }

  function collectParams() {
    var params = {};
    [].forEach.call(document.querySelectorAll("#dlg-params [data-param]"), function (input) {
      var p = findParamDef(input.dataset.param);
      params[input.dataset.param] = (p && p.type === "number") ? Number(input.value) : input.value;
    });
    return params;
  }

  function findParamDef(key) {
    return Catalog.get(state.type).params.filter(function (p) { return p.key === key; })[0];
  }

  function typeOf() { return state.type; }

  return { open: open, typeOf: typeOf, renderParams: renderParams };
});
```

- [ ] **Step 5: 写 `web/js/app.js`（全文；本任务先接对象区+代码面板+横幅+自动保存）**

```js
(function () {
  "use strict";

  var LS_KEY = "stm32-blocks:project";
  var project = null;

  function change() { refresh(); }

  function refresh() {
    // 1) 校验 → 横幅 + 下载按钮
    var result = Validate.check(project);
    var banner = document.getElementById("error-banner");
    if (result.errors.length > 0) {
      banner.textContent = result.errors.map(function (e) { return e.message; }).join("；");
      banner.classList.remove("hidden");
      document.getElementById("btn-download").disabled = true;
    } else {
      banner.classList.add("hidden");
      document.getElementById("btn-download").disabled = false;
    }
    // 2) 代码
    Render.renderCode(Codegen.generate(project));
    // 3) 对象区
    Render.renderObjects(document.getElementById("object-list"), project, {
      onDelete: function (id) {
        var refs = Model.countReferences(project, id);
        var msg = refs > 0 ? "该对象被 " + refs + " 块积木使用，删除会一并移除。确定？" : "确定删除？";
        if (window.confirm(msg)) { Model.deleteObject(project, id); change(); }
      },
      onEdit: function (id) {
        ObjectsUI.open(project, id, function () { change(); });
      }
    });
    // 4) 主循环渲染（本任务先静态渲染；拖拽任务接管后改为 interactive）
    Render.renderBlockList(document.getElementById("loop-slot"), project.loop, project);
    // 5) 自动保存
    try { localStorage.setItem(LS_KEY, Model.serialize(project)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function init() {
    var saved = null;
    try { saved = localStorage.getItem(LS_KEY); } catch (e) {}
    project = saved ? Model.deserialize(saved) : Examples.load("blink");

    document.getElementById("project-name").value = project.projectName;
    document.getElementById("project-name").addEventListener("input", function () {
      project.projectName = this.value || "我的工程";
      change();
    });
    document.getElementById("btn-add-object").onclick = function () {
      ObjectsUI.open(project, null, function () { change(); });
    };
    document.getElementById("btn-copy").onclick = function () {
      navigator.clipboard.writeText(Codegen.generate(project));
    };
    document.getElementById("btn-download").onclick = function () {
      alert("打包功能开发中（Task 10/11）");
    };
    refresh();
  }

  window.App = { init: init, refresh: refresh, getProject: function () { return project; } };
  document.addEventListener("DOMContentLoaded", init);
})();
```

- [ ] **Step 6: 浏览器手动验证（file:// 双击 `web/index.html`）**

Checklist（逐条肉眼确认，有问题就修）：
- [ ] 打开后自动载入"按键点灯"示例：左侧显示 key1/led1 两张对象卡，右侧代码面板出现完整 C 代码且有关键字高亮
- [ ] 点「＋ 新建对象」→ 弹窗选"蜂鸣器"→ 名字自动候选、参数两个下拉（引脚/触发逻辑）→ 确定 → 左侧新增 buzzer1，代码面板同步出现 `Buzzer buzzer1;`
- [ ] 把 buzzer1 引脚改成 PB1、把已有的 led1 引脚也改成 PB1（编辑弹窗）→ 顶部红色横幅出现"引脚冲突：PB1 被 led1、buzzer1 同时占用"，下载按钮变灰
- [ ] 改回不同引脚 → 横幅消失、按钮恢复
- [ ] 点对象卡 ✕ 删 key1 → 弹确认（提示被积木使用）→ 确定后主循环区那条 if 消失，代码同步
- [ ] 刷新浏览器 → 刚才的修改还在（localStorage）
- [ ] 代码面板「复制代码」按钮把代码复制进剪贴板

- [ ] **Step 7: Commit**

```bash
git add web && git commit -m "feat: 三栏界面骨架/对象区/代码面板/校验横幅/自动保存

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: dragdrop.js 拖拽内核（积木盒拖出、堆叠、重排、垃圾桶）

**Files:**
- Create: `web/js/dragdrop.js`
- Modify: `web/index.html`（加 `<script src="js/dragdrop.js">`，在 render.js 之后）
- Modify: `web/js/render.js`（语句块元素挂 `data-node-id` 与落点容器 `data-drop-list`，供内核命中）
- Modify: `web/js/app.js`（接入内核：拖拽提交后调 Model.moveNode/插入 + change()）

**Interfaces:**
- Consumes: Model（moveNode/findParentList/nodeAction/nodeDelay/nodeIf）。
- Produces：

```js
DragDrop.init({
  palette: HTMLElement, trash: HTMLElement,
  onChange: fn,        // 任何变动后让 App 重渲染
  onDelete: fn(info),  // info: {uid?, paletteType?, overTrash: true}
  onDrop: fn(info)     // info: {uid?, paletteType?, dropList, ownerUid, listKind, x, y}
});
```

- [ ] **Step 1: 渲染层改造（render.js）**——每个语句块元素：`el.dataset.nodeId = <节点在树中的唯一 id>`。

节点唯一 id 方案：渲染时给每个节点动态挂 `node.__uid`（纯 UI 属性，序列化前由 Model.serialize 用 replacer 剥掉 `__uid`——在 model.js 的 serialize 里加 `JSON.stringify(project, function (k, v) { return k === "__uid" ? undefined : v; })`，并补一条测试："serialize 不包含 __uid"）。

`renderBlockList(container, nodes, project, opts)` 里给每个节点分配 uid（`"n" + (++render._seq)`），`renderNode` 输出的根元素 `dataset.nodeId`；if 块的三段容器分别 `data-drop-list` 且挂 `dataset.ownerUid` + `dataset.listKind`（"then"/"else"）；主循环容器 `#loop-slot` 已有 `data-drop-list="loop"`。

- [ ] **Step 2: 写 `web/js/dragdrop.js`（全文）**

```js
(function (root) {
  "use strict";

  var opts = null;
  var drag = null;   // { uid?, paletteType?, ghost, srcEl?, overTrash? }

  function init(o) {
    opts = o;
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function makeGhost(src) {
    var g = document.createElement("div");
    g.className = "drag-ghost";
    g.style.position = "fixed";
    g.style.pointerEvents = "none";
    g.style.zIndex = "9999";
    g.style.opacity = "0.9";
    g.style.width = src.offsetWidth + "px";
    return g;
  }

  function moveGhost(ev) {
    drag.ghost.style.left = (ev.clientX + 8) + "px";
    drag.ghost.style.top = (ev.clientY + 8) + "px";
  }

  function onDown(ev) {
    var pal = ev.target.closest("[data-palette]");
    if (pal) {
      ev.preventDefault();
      drag = { paletteType: pal.dataset.palette, ghost: makeGhost(pal) };
      drag.ghost.textContent = pal.textContent;
      drag.ghost.classList.add("pal-" + pal.dataset.palette);
      document.body.appendChild(drag.ghost);
      moveGhost(ev);
      opts.trash.classList.remove("hidden");
      return;
    }
    var blk = ev.target.closest("[data-node-id]");
    if (blk && !ev.target.closest("select,input,button")) {
      drag = { uid: blk.dataset.nodeId, ghost: makeGhost(blk), srcEl: blk };
      drag.ghost.innerHTML = blk.innerHTML;   // 拖动幽灵（静态拷贝）
      document.body.appendChild(drag.ghost);
      moveGhost(ev);
      blk.classList.add("dragging-src");
      opts.trash.classList.remove("hidden");
    }
  }

  function findDropTarget(x, y) {
    var el = document.elementFromPoint(x, y);
    return el ? el.closest("[data-drop-list]") : null;
  }

  function onMove(ev) {
    if (!drag) { return; }
    moveGhost(ev);
    document.querySelectorAll(".drop-hint").forEach(function (e) { e.classList.remove("drop-hint"); });
    var target = findDropTarget(ev.clientX, ev.clientY);
    if (target) { target.classList.add("drop-hint"); }
    drag.overTrash = !!ev.target.closest("#trash");
    document.getElementById("trash").classList.toggle("trash-hot", drag.overTrash);
  }

  function onUp(ev) {
    if (!drag) { return; }
    var info = {
      uid: drag.uid, paletteType: drag.paletteType,
      overTrash: drag.overTrash, x: ev.clientX, y: ev.clientY
    };
    var ghost = drag.ghost, srcEl = drag.srcEl;
    drag = null;

    ghost.remove();
    if (srcEl) { srcEl.classList.remove("dragging-src"); }
    document.querySelectorAll(".drop-hint").forEach(function (e) { e.classList.remove("drop-hint"); });
    var trash = document.getElementById("trash");
    trash.classList.remove("trash-hot");
    trash.classList.add("hidden");

    if (info.overTrash) { opts.onDelete(info); return; }
    var target = findDropTarget(info.x, info.y);
    if (!target) { opts.onChange(); return; }   // 无效落点：重渲染回弹
    info.dropList = target.dataset.dropList;
    info.ownerUid = target.dataset.ownerUid || "";
    info.listKind = target.dataset.listKind || "";
    opts.onDrop(info);
  }

  root.DragDrop = { init: init };
})(typeof self !== "undefined" ? self : this);
```

- [ ] **Step 2b: `web/css/style.css` 追加拖拽相关样式**

```css
/* T7 拖拽 */
.blk { border-radius: 8px; padding: 8px 12px; margin: 6px 0; color: #fff; font-size: 14px; }
.blk-action { background: #2563eb; }
.blk-delay { background: #ea7a1a; }
.blk-if { background: #7c3aed; }
.blk select, .blk input { margin: 0 4px; color: #111; border-radius: 4px; border: 0; padding: 3px 6px; }
.if-head, .if-else-head { font-weight: bold; }
.if-body { background: rgba(255,255,255,0.18); border-radius: 6px; min-height: 30px; padding: 6px; margin: 6px 0; }
.drag-ghost { border-radius: 8px; padding: 8px 12px; color: #fff; background: #2563eb; box-shadow: 0 6px 16px rgba(0,0,0,.25); }
.drag-ghost.pal-delay { background: #ea7a1a; }
.drag-ghost.pal-if { background: #7c3aed; }
.drop-hint { outline: 3px solid #22c55e; outline-offset: 2px; }
.dragging-src { opacity: 0.4; }
.trash-hot { transform: scale(1.15); background: #fecaca !important; }
```

- [ ] **Step 3: app.js 接入**——`App` 增加：

```js
DragDrop.init({
  palette: document.getElementById("palette"),
  trash: document.getElementById("trash"),
  onChange: change,
  onDelete: function (info) {
    if (info.paletteType) { change(); return; }        // 从积木盒拖进垃圾桶 = 什么都不做
    Model.deleteNodeByUid(project, info.uid);
    change();
  },
  onDrop: function (info) {
    var targetList = App.resolveDropList(project, info);  // loop/then/else → 对应数组
    if (!targetList) { change(); return; }
    var index = App.dropIndexAt(info, targetList);         // 落点 y 与各块中线比较得插入位
    if (info.paletteType) {
      var node = App.makePaletteNode(info.paletteType, project);
      if (node) { targetList.splice(index, 0, node); }
    } else {
      var existing = Model.findNodeByUid(project, info.uid);
      if (existing) { Model.moveNode(project, existing, targetList, index); }
    }
    change();
  }
});
```

配套新增（含小测试，T7 Step 5 一并跑）：

- `Model.findNodeByUid(project, uid) -> node | undefined`（基于 walk 遍历找 `__uid`）
- `Model.deleteNodeByUid(project, uid) -> 被删节点 | undefined`（找到所在数组并 splice）
- App 侧 `resolveDropList(project, info)`：`dropList === "loop"` → `project.loop`；否则按 `ownerUid` 找到 if 节点，`listKind === "then" ? node.then : node.else`
- App 侧 `dropIndexAt(info, list)`：遍历 list 中各块 DOM（`[data-node-id="<uid>"]`）的 `getBoundingClientRect().top + height/2` 与 `info.y` 比较，得出插入位
- App 侧 `makePaletteNode(type, project)`：`"action"` → 第一个"有动作对象"的第一个动作；`"delay"` → `Model.nodeDelay(100)`；`"if"` → 首个按键对象的 `condState(pressed)`（没有按键则首个整数对象的 `condCompare(>=, 1)`）

- [ ] **Step 4: 浏览器手动验证 checklist**

- [ ] 从积木盒拖「延时」到主循环 → 松手出现"延时 100 毫秒"块（默认 100，可后续改）
- [ ] 拖「如果」到主循环 → 出现 C 形块，条件下拉可选中 key1 被按下
- [ ] 把「延时」块拖进"如果"肚子 → 吸附进去（缩进对齐）
- [ ] 拖动已有块上下换位 → 松手顺序变化，代码面板同步
- [ ] 拖动时垃圾桶出现；把块丢进垃圾桶 → 该块消失
- [ ] 拖到空白处松手 → 回弹（画面不变化但重渲染一次）
- [ ] 把"如果"块拖到它自己肚子上 → 不生效（moveNode 拒绝）

- [ ] **Step 5: 跑全量单测** → `node --test tests/`，Expected: 全绿（新增的 __uid 剥离、deleteNodeByUid 测试也过）

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: 自研拖拽内核（拖出/吸附/重排/垃圾桶）与模型移动操作

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 积木内下拉编辑（对象/动作/条件/参数）

**Files:**
- Modify: `web/js/render.js`（块内容从静态文本改为可交互控件）
- Modify: `web/js/app.js`（控件变更 → 改模型 → change()）

**Interfaces:**
- Consumes: `Catalog`（params/actions/states/conditions）、Model。
- Produces: 动作块 = `[对象▾][动作▾](参数框)`；延时块 = `延时 [数字] 毫秒`；如果块 = `如果 [条件编辑] 则 {…} 否则 {…}`。

- [ ] **Step 1: 动作块控件化（render.js）**

动作块结构（`renderNode` 的 action 分支重写）：

```js
function actionBlock(node, project, ops) {
  var wrap = el("div", "blk blk-action");
  // 对象下拉：只有"有动作"的对象（led/buzzer/servo/int）
  var objSel = el("select");
  project.objects.filter(function (o) { return Catalog.get(o.type).actions.length > 0; })
    .forEach(function (o) {
      var opt = el("option", null, o.name); opt.value = o.id;
      if (o.id === node.objectId) { opt.selected = true; }
      objSel.appendChild(opt);
    });
  // 动作下拉：随对象类型变化
  var actSel = el("select");
  var obj = Model.findObject(project, node.objectId);
  if (obj) {
    Catalog.get(obj.type).actions.forEach(function (a) {
      var opt = el("option", null, a.label); opt.value = a.id;
      if (a.id === node.action) { opt.selected = true; }
      actSel.appendChild(opt);
    });
  }
  // 参数框（舵机角度/变量数值）
  var act = obj ? Catalog.get(obj.type).actions.filter(function (a) { return a.id === node.action; })[0] : null;
  var paramBox = null;
  if (act && act.param) {
    paramBox = el("input"); paramBox.type = "number";
    paramBox.value = node.value !== undefined ? node.value : act.defaultParam;
    paramBox.oninput = function () { node.value = Number(this.value); ops.change(); };
  }
  objSel.onchange = function () {
    node.objectId = this.value;
    var first = Catalog.get(Model.findObject(project, this.value).type).actions[0];
    node.action = first.id;
    if (first.param) { node.value = first.defaultParam; } else { delete node.value; }
    ops.rerender();
  };
  actSel.onchange = function () {
    node.action = this.value;
    var a = Catalog.get(obj.type).actions.filter(function (x) { return x.id === this.value; }.bind(this))[0];
    if (a && a.param) { node.value = a.defaultParam; } else { delete node.value; }
    ops.rerender();
  };
  wrap.appendChild(objSel); wrap.appendChild(actSel);
  if (paramBox) { wrap.appendChild(paramBox); }
  return wrap;
}
```

延时块：`延时 [input number] 毫秒`，oninput → `node.ms = Number(this.value)` + ops.change()（空值按 0 处理）。

- [ ] **Step 2: 如果块条件编辑器（render.js）**

条件编辑：`[对象▾]`（列"按键"或"整数"对象）→ 之后分两种控件：
- 选中按键对象：`[被按下|被松开▾]` → `node.cond = Model.condState(id, state)`
- 选中整数对象：`[≥|>|=|≤|<▾][数字框]` → `node.cond = Model.condCompare(id, op, Number(v))`

否则段：若 `node.else.length === 0` 显示一个"＋否则"小按钮（点击后 else 出现空段）；已有 else 时显示"否则"标题与空容器即可。

- [ ] **Step 3: 拖拽兼容**——`onDown` 里已经排除 `select/input/button` 上开始的拖动（Task 7 已做）；本任务确认下拉在拖动幽灵里不产生报错。

- [ ] **Step 4: 浏览器手动验证 checklist**

- [ ] 动作块切对象（led1→buzzer1）→ 动作下拉自动变"响/停/翻转"，代码同步 `Buzzer_*`
- [ ] 舵机动作出现角度输入框，改成 45 → 代码出现 `Servo_Write(&servo1, 45)`
- [ ] 延时块数字改成 300 → 代码 `Delay_ms(300)`
- [ ] 如果块条件在"按键 / 整数"之间切换，控件形态正确互换
- [ ] 整数条件选 `≥` 填 5 → 代码 `if (count1 >= 5) {`
- [ ] 空 else 显示"＋否则"，点击后出现否则段，可往里拖块

- [ ] **Step 5: 跑全量单测回归** → `node --test tests/`，Expected: 全绿

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: 积木内下拉编辑（对象/动作/条件/参数就地编辑）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 持久化完善 + 导出导入 + 示例菜单 + 悬停联动（加分项）

**Files:**
- Modify: `web/index.html`（顶栏加：示例下拉、导出/导入按钮）
- Modify: `web/js/app.js`

**Interfaces:**
- Consumes: 全部前端模块。
- Produces: 完整可用的编辑器 UI（打包功能除外）。

- [ ] **Step 1: 顶栏控件**——`index.html` header 增加：

```html
<select id="example-select"><option value="">载入示例…</option></select>
<button id="btn-export">导出工程</button>
<button id="btn-import">导入工程</button>
<input id="import-file" type="file" accept=".json" class="hidden">
```

- [ ] **Step 2: app.js 接线**

```js
// 示例菜单（init 时填充）
Examples.list().forEach(function (e) {
  var opt = document.createElement("option");
  opt.value = e.id; opt.textContent = e.label;
  document.getElementById("example-select").appendChild(opt);
});
document.getElementById("example-select").onchange = function () {
  if (!this.value) { return; }
  if (window.confirm("载入示例会覆盖当前工程，继续？")) {
    project = Examples.load(this.value);
    document.getElementById("project-name").value = project.projectName;
    change();
  }
  this.value = "";
};
// 导出
document.getElementById("btn-export").onclick = function () {
  var blob = new Blob([Model.serialize(project)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (project.projectName || "工程") + ".json";
  a.click();
};
// 导入
document.getElementById("btn-import").onclick = function () { document.getElementById("import-file").click(); };
document.getElementById("import-file").onchange = function () {
  var file = this.files[0];
  if (!file) { return; }
  var reader = new FileReader();
  reader.onload = function () {
    try {
      project = Model.deserialize(reader.result);
      document.getElementById("project-name").value = project.projectName;
      change();
    } catch (err) { alert("导入失败：" + err.message); }
  };
  reader.readAsText(file);
  this.value = "";
};
```

- [ ] **Step 3: 悬停联动（加分项，先做最简版）**——代码生成时记录每个块的起止行（`Codegen.generate` 增加可选的 `opts.trace`，返回 `{code, linesByUid}`；不改默认行为）；render 时块元素 `onmouseenter` → 给对应代码行加 `.code-hl` 背景 class，mouseleave 移除。若 30 分钟内搞不定就放弃此项（不阻塞 M3），在提交说明里注明。

```css
/* style.css 追加 */
.code-hl { background: #fef3c7; display: inline-block; width: 100%; }
```

- [ ] **Step 4: 浏览器手动验证 checklist**

- [ ] 载入"舵机来回摆"示例 → 覆盖确认 → 界面与代码更新
- [ ] 导出工程 → 得到 .json 文件；刷新页面 → 载入 localStorage 版（不是刚导入的？先把工程清掉再导入刚才的 json）→ 导入成功恢复
- [ ] 悬停某个块 → 右侧对应代码行黄色高亮（若做）
- [ ] 全部 5 种对象类型建一遍、每个动作/条件都手工点一遍，代码面板结果符合直觉

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: 示例菜单/工程导入导出/代码悬停联动

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: packer.js + JSZip vendor（下载完整工程）

**Files:**
- Create: `web/vendor/jszip.min.js`（下载后 vendor）
- Create: `web/js/packer.js`
- Test: `tests/packer.test.js`
- Modify: `web/index.html`（script 加 packer.js）

**Interfaces:**
- Consumes: `Codegen`、JSZip、`window.TEMPLATE_ZIP`（Task 11 产出，测试里自造 fixture 不依赖它）。
- Produces：

```js
Packer.buildProjectZip(project, templateBase64, projectName)
  // -> Promise<Uint8Array>；根目录改名 projectName；Core/Src/user_code.c 换成生成代码
```

- [ ] **Step 1: vendor JSZip**

```bash
cd "F:/kakuns开源项目/stm32-blocks"
curl -L -o web/vendor/jszip.min.js https://registry.npmmirror.com/jszip/-/jszip-3.10.1.tgz
tar xzf jszip.min.js -C /tmp 2>/dev/null || true   # npmmirror 给的是 tgz
# 正确做法（若上面的 tgz 方案不顺）：
curl -L -o web/vendor/jszip.min.js https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
head -c 200 web/vendor/jszip.min.js   # 期望看到 /*! JSZip v3.10.1 之类字样，不是 HTML 错误页
```

- [ ] **Step 2: 写失败测试 `tests/packer.test.js`（全文）**

```js
const test = require("node:test");
const assert = require("node:assert");
const JSZip = require("../web/vendor/jszip.min.js");
const Model = require("../web/js/model.js");
const Codegen = require("../web/js/codegen.js");
const Examples = require("../web/js/examples.js");
const Packer = require("../web/js/packer.js");

async function fixtureBase64() {
  const zip = new JSZip();
  zip.file("template/CMakeLists.txt", "cmake-min");
  zip.file("template/Core/Src/user_code.c", "OLD-CONTENT");
  zip.file("template/.vscode/tasks.json", "{}");
  return zip.generateAsync({ type: "base64" });
}

test("打包：根目录改名 + user_code.c 替换为生成代码，其余文件原样", async () => {
  const project = Examples.load("blink");
  project.projectName = "小明的作品";
  const b64 = await fixtureBase64();
  const out = await Packer.buildProjectZip(project, b64, "小明的作品");
  const zip = await JSZip.loadAsync(out);
  const names = Object.keys(zip.files);
  assert.ok(names.includes("小明的作品/CMakeLists.txt"));
  assert.ok(names.includes("小明的作品/Core/Src/user_code.c"));
  assert.ok(names.includes("小明的作品/.vscode/tasks.json"));
  assert.ok(!names.some((n) => n.startsWith("template/")));
  const userCode = await zip.file("小明的作品/Core/Src/user_code.c").async("string");
  assert.equal(userCode, Codegen.generate(project));
});
```

- [ ] **Step 3: 跑测试看失败** → `node --test tests/packer.test.js`，Expected: FAIL

- [ ] **Step 4: 实现 `web/js/packer.js`（全文）**

```js
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../vendor/jszip.min.js"), require("./codegen.js"));
  } else {
    root.Packer = factory(root.JSZip, root.Codegen);
  }
})(typeof self !== "undefined" ? self : this, function (JSZip, Codegen) {
  "use strict";

  function rootFolderOf(names) {
    var first = names[0];
    var i = first.indexOf("/");
    return i > 0 ? first.slice(0, i) : "";
  }

  function buildProjectZip(project, templateBase64, projectName) {
    return JSZip.loadAsync(templateBase64, { base64: true }).then(function (tpl) {
      var out = new JSZip();
      var names = Object.keys(tpl.files).sort();
      var rootName = rootFolderOf(names);
      var prefix = rootName ? rootName + "/" : "";
      var userCode = Codegen.generate(project);

      var jobs = names.map(function (name) {
        var file = tpl.files[name];
        if (file.dir || name === rootName) { return Promise.resolve(); }
        var rel = name.indexOf(prefix) === 0 ? name.slice(prefix.length) : name;
        var newName = projectName + "/" + rel;
        if (rel === "Core/Src/user_code.c") {
          out.file(newName, userCode);
          return Promise.resolve();
        }
        return file.async("uint8array").then(function (data) { out.file(newName, data); });
      });
      return Promise.all(jobs).then(function () {
        return out.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
      });
    });
  }

  return { buildProjectZip: buildProjectZip };
});
```

- [ ] **Step 5: 跑测试到全绿** → `node --test tests/packer.test.js`，Expected: PASS
- [ ] **Step 6: app.js 下载按钮接真逻辑**（TEMPLATE_ZIP 还没内嵌时按钮临时 alert "模板未内嵌，先跑 tools/embed-template.js"）：

```js
document.getElementById("btn-download").onclick = function () {
  if (!window.TEMPLATE_ZIP) { alert("模板未内嵌：先运行 node tools/embed-template.js"); return; }
  Packer.buildProjectZip(project, window.TEMPLATE_ZIP, project.projectName || "我的工程")
    .then(function (data) {
      var blob = new Blob([data], { type: "application/zip" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (project.projectName || "我的工程") + ".zip";
      a.click();
    });
};
```

- [ ] **Step 7: Commit**

```bash
git add web/js/packer.js web/vendor tests/packer.test.js web/js/app.js web/index.html && git commit -m "feat: 打包器 packer.js（内嵌模板 → 替换生成代码 → 下载 zip）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: tools/embed-template.js（模板工程内嵌进网页）

**Files:**
- Create: `tools/embed-template.js`
- Generate: `web/js/template-data.js`（产物，提交进仓库）
- Modify: `web/index.html`（script 加 template-data.js）

**Interfaces:**
- Consumes: `template/`（M1 产物）、JSZip（node require `../web/vendor/jszip.min.js`）。
- Produces: `window.TEMPLATE_ZIP`（base64 字符串）。

- [ ] **Step 1: 实现 `tools/embed-template.js`（全文）**

```js
#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const JSZip = require("../web/vendor/jszip.min.js");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATE_DIR = path.join(ROOT, "template");
const OUT_FILE = path.join(ROOT, "web/js/template-data.js");
const EXCLUDE_DIRS = new Set(["build", ".git", ".vscode-server"]);

function walk(dir, base, out) {
  fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((ent) => {
      if (EXCLUDE_DIRS.has(ent.name)) { return; }
      const abs = path.join(dir, ent.name);
      const rel = base ? base + "/" + ent.name : ent.name;
      if (ent.isDirectory()) { walk(abs, rel, out); }
      else { out.push({ rel, abs }); }
    });
}

async function main() {
  const files = [];
  walk(TEMPLATE_DIR, "", files);
  if (!files.some((f) => f.rel.endsWith("Core/Src/user_code.c"))) {
    console.error("模板里没找到 Core/Src/user_code.c，先完成 M1 计划");
    process.exit(1);
  }
  const zip = new JSZip();
  for (const f of files) { zip.file("template/" + f.rel, fs.readFileSync(f.abs)); }
  const b64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 9 } });
  fs.writeFileSync(OUT_FILE,
    "/* 由 tools/embed-template.js 生成，勿手改 */\nwindow.TEMPLATE_ZIP = \"" + b64 + "\";\n");
  console.log(`内嵌 ${files.length} 个文件，template-data.js 大小 ${(fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2)} MB`);
}

main();
```

- [ ] **Step 2: 运行并验证**

```bash
node tools/embed-template.js   # 期望：内嵌 xx 个文件，大小 0.5-2 MB 量级
node -e "global.window={}; require('F:/kakuns开源项目/stm32-blocks/web/js/template-data.js'); console.log(typeof window.TEMPLATE_ZIP, window.TEMPLATE_ZIP.length)"   # 期望 string + 长度 >100000
```

- [ ] **Step 3: 浏览器端到端验证**——`web/index.html` 加 `<script src="js/template-data.js">` 后双击打开；随便拼一个程序 → 点「下载完整工程」→ 得到 `<工程名>.zip`；解压 → VSCode 打开 → F5 → 板子按积木逻辑动（**这是 M3 的核心验收**）。

- [ ] **Step 4: Commit**

```bash
git add tools/embed-template.js web/js/template-data.js web/index.html && git commit -m "feat: 模板工程内嵌脚本，生成 template-data.js

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: tools/run-example-builds（示例编译回归，M3 验收门）

**Files:**
- Create: `tools/run-example-builds.js`、`tools/run-example-builds.bat`

**Interfaces:**
- Consumes: `web/js/examples.js`、`web/js/codegen.js`（node require）、`template/`。
- Produces: 一条命令验证"3 个示例生成的代码都能编译"。

- [ ] **Step 1: 实现 `tools/run-example-builds.js`（全文）**

```js
#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATE = path.join(ROOT, "template");
const Examples = require("../web/js/examples.js");
const Codegen = require("../web/js/codegen.js");

const CUBECLT = process.env.CUBECLT || "D:\\STM32CubeCLT_1.18.0";
const ENV = Object.assign({}, process.env, {
  CUBECLT,
  PATH: [
    path.join(CUBECLT, "CMake", "bin"),
    path.join(CUBECLT, "Ninja"),
    path.join(CUBECLT, "GNU-tools-for-STM32", "bin"),
    path.join(CUBECLT, "STM32CubeProgrammer", "bin"),
    process.env.PATH,
  ].join(path.delimiter),
});

let failed = 0;
for (const e of Examples.list()) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blockbuild-"));
  fs.cpSync(TEMPLATE, tmp, { recursive: true, filter: (src) => !/build(\\|\/|$)/.test(src) });
  fs.writeFileSync(path.join(tmp, "Core/Src/user_code.c"), Codegen.generate(Examples.load(e.id)));
  const r = spawnSync("cmake", ["-B", "build", "-G", "Ninja",
      "-DCMAKE_BUILD_TYPE=Debug", "-DCMAKE_TOOLCHAIN_FILE=cmake/arm-gcc-toolchain.cmake"],
      { cwd: tmp, env: ENV, shell: true });
  let ok = r.status === 0;
  if (ok) {
    const b = spawnSync("cmake", ["--build", "build"], { cwd: tmp, env: ENV, shell: true });
    ok = b.status === 0;
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${e.id}  ${e.label}`);
  if (!ok) { failed++; }
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed === 0 ? "\n3/3 通过" : `\n${failed} 个失败`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: 实现 `tools/run-example-builds.bat`（全文）**

```bat
@echo off
cd /d %~dp0..
node tools\run-example-builds.js
pause
```

- [ ] **Step 3: 运行**

```bash
node tools/run-example-builds.js
```

Expected: `PASS blink / PASS combo / PASS sweep` + `3/3 通过`（每个示例全新目录编译，约 10-30 秒/个）。

- [ ] **Step 4: M3 总验收 checklist（真板 + 浏览器全流程）**

- [ ] `node --test tests/` 全绿
- [ ] 双击 `web/index.html` → 载入"按键组合技" → 下载 zip → VSCode 打开 → F5 → 板子上按键按下：蜂鸣器响、LED 翻转、舵机 90°、松开复位
- [ ] 新建对象走一遍 5 种类型，每个都下载编译烧录一次（至少 servo 和 int 各来一次）
- [ ] 制造一个引脚冲突 → 下载按钮禁灰正确
- [ ] 断网状态下全流程可用（除了首次装 CubeCLT 之外）

- [ ] **Step 5: Commit**

```bash
git add tools && git commit -m "feat: 示例编译回归脚本，3/3 通过（M3 验收门）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## M2+M3 完成标准（验收清单）

- [ ] 浏览器双击可打开，全流程离线可用（file:// 无控制台报错）
- [ ] 对象区 5 种类型可建/改/删（含引脚冲突拦截与占位清理提示）
- [ ] 拖拽：积木盒拖出、堆叠吸附、嵌套进如果、重排、垃圾桶删除、非法落点回弹
- [ ] 代码面板实时生成且与 §5.3 样例格式一致（golden 测试锁死）、语法高亮、可复制
- [ ] 3 个示例一键载入；localStorage 自动保存；工程导入导出
- [ ] 下载 zip = 完整可编译工程（含 .vscode/脚本/说明），改名正确
- [ ] `node --test tests/` 全绿；`node tools/run-example-builds.js` 3/3
- [ ] 现场流程演练：拼积木 → 下载 → VSCode F5 → 板子动，≤ 2 分钟走完
