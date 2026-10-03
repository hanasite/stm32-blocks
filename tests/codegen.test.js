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
