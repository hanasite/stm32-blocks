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
"Key    key1;      /* key1 = 按键(PA1, 上拉，另一端接 GND) */",
"Led    led1;      /* led1 = LED(PC13, 高电平亮，另一端接 GND) */",
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
"/* 主循环：单片机会从头到尾一直执行这一段（不断重复） */",
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

test("红外 + OLED 生成代码（显示变量取对象名、跑马灯带参数）", () => {
  const p = Model.newProject("红外演示");
  const ir = Object.assign(Model.addObject(p, "ir", { pin: "PA2", active: "low" }), { id: "o1", name: "ir1" });
  const oled = Object.assign(Model.addObject(p, "oled", {}), { id: "o2", name: "oled1" });
  const cnt = Object.assign(Model.addObject(p, "int", { init: 0 }), { id: "o3", name: "count1" });
  const showVar = Model.nodeAction(oled.id, "showvar");
  showVar.varId = cnt.id;
  const marqueeVar = Model.nodeAction(oled.id, "marquee", 0);
  marqueeVar.varId = cnt.id;
  p.loop.push(Model.nodeIf(Model.condState(ir.id, "detected"), [
    Model.nodeAction(oled.id, "showyes"),
    showVar,
    marqueeVar
  ], [
    Model.nodeAction(oled.id, "showno"),
    Model.nodeAction(oled.id, "marquee", 60)
  ]));

  const lines = Codegen.generate(p).split("\n");
  const declOf = (key) => lines.find((l) => l.indexOf(key + ";") === 7);   // decl.padEnd(7) 后接名字
  assert.equal(declOf("ir1"), "Ir".padEnd(7) + "ir1;".padEnd(11) + "/* ir1 = 红外(PA2, 低电平触发（检测到输出低）) */");
  assert.equal(declOf("oled1"), "Oled".padEnd(7) + "oled1;".padEnd(11) + "/* oled1 = OLED(SSD1306 128x64, 软I2C PB8/PB9) */");

  const code = lines.join("\n");
  assert.ok(code.includes("Ir_Init(&ir1, GPIOA, GPIO_PIN_2, ACTIVE_LOW);"));
  assert.ok(code.includes("Oled_Init(&oled1);"));
  assert.ok(code.includes("if (Ir_IsTriggered(&ir1)) {"));
  assert.ok(code.includes('Oled_ShowText(&oled1, "YES");'));
  assert.ok(code.includes("Oled_ShowInt(&oled1, count1);"));
  assert.ok(code.includes("Oled_Marquee(&oled1, count1);   /* 跑马灯：显示进度 count1 */"));   // 变量驱动进度 + 尾注释
  assert.ok(code.includes('Oled_ShowText(&oled1, "NO");'));
  assert.ok(code.includes("Oled_Marquee(&oled1, 60);"));
});

test("显示变量积木未选对象时回退成 0（由 validate 拦截提示）", () => {
  const p = Model.newProject("t");
  const oled = Object.assign(Model.addObject(p, "oled", {}), { id: "o1", name: "oled1" });
  p.loop.push(Model.nodeAction(oled.id, "showvar"));
  assert.ok(Codegen.generate(p).includes("Oled_ShowInt(&oled1, 0);"));
});

test("小恐龙组件：多参数绑定生成代码（红外/按键/不接/缺屏）", () => {
  const p = Model.newProject("恐龙塔");
  const key = Object.assign(Model.addObject(p, "key", { pin: "PA1", pull: "up" }), { id: "o1", name: "key1" });
  const ir = Object.assign(Model.addObject(p, "ir", { pin: "PA2", active: "low" }), { id: "o2", name: "ir1" });
  const oled = Object.assign(Model.addObject(p, "oled", {}), { id: "o3", name: "oled1" });
  const dino = Object.assign(Model.addObject(p, "dino", {}), { id: "o4", name: "dino1" });
  const frame = Model.nodeAction(dino.id, "frame");
  frame.refs = { oled: oled.id, jump: ir.id };
  p.loop.push(frame);

  const lines = Codegen.generate(p).split("\n");
  assert.equal(lines.find((l) => l.indexOf("dino1;") === 7),
    "Dino".padEnd(7) + "dino1;".padEnd(11) + "/* dino1 = 小恐龙游戏(组件) */");
  let code = lines.join("\n");
  assert.ok(code.includes("Dino_Init(&dino1);"));
  assert.ok(code.includes("Dino_Frame(&dino1, &oled1, Ir_IsTriggered(&ir1));"));   // 默认取第一个条件：检测到

  frame.refState = { jump: "idle" };                                              // 红外：未检测到
  assert.ok(Codegen.generate(p).includes("Dino_Frame(&dino1, &oled1, Ir_IsIdle(&ir1));"));

  frame.refs.jump = key.id;
  frame.refState = { jump: "released" };                                          // 按键：被松开
  assert.ok(Codegen.generate(p).includes("Dino_Frame(&dino1, &oled1, Key_IsReleased(&key1));"));
  frame.refState = { jump: "pressed" };
  assert.ok(Codegen.generate(p).includes("Dino_Frame(&dino1, &oled1, Key_IsPressed(&key1));"));
  delete frame.refState;

  frame.refs.jump = "";
  assert.ok(Codegen.generate(p).includes("Dino_Frame(&dino1, &oled1, 0);"));

  frame.refs.jump = "__hook__";   // 外部钩子：由「请求跳跃」置位
  assert.ok(Codegen.generate(p).includes("Dino_Frame(&dino1, &oled1, DINO_JUMP_HOOK);"));

  delete frame.refs.oled;
  assert.ok(Codegen.generate(p).includes("Dino_Frame(&dino1, 0, DINO_JUMP_HOOK);"));
});
