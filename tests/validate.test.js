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

test("OLED 固定占用 PB8/PB9：与 PB8 上的 LED 冲突", () => {
  const p = Model.newProject("t");
  Model.addObject(p, "oled", {});
  Model.addObject(p, "led", { pin: "PB8", active: "high" });
  const e = Validate.check(p).errors;
  assert.equal(e.length, 1);
  assert.equal(e[0].code, "PIN_CONFLICT");
  assert.ok(e[0].message.includes("PB8"));
  assert.ok(e[0].message.includes("OLED 固定占用"));
});

test("红外与普通 GPIO 同引脚同样冲突", () => {
  const p = Model.newProject("t");
  Model.addObject(p, "ir", { pin: "PA2", active: "low" });
  Model.addObject(p, "led", { pin: "PA2", active: "high" });
  const e = Validate.check(p).errors;
  assert.equal(e.length, 1);
  assert.equal(e[0].code, "PIN_CONFLICT");
});

test("「显示变量」积木未选整数对象报错，选中后通过", () => {
  const p = Model.newProject("t");
  const oled = Model.addObject(p, "oled", {});
  p.loop.push(Model.nodeAction(oled.id, "showvar"));
  const codes = Validate.check(p).errors.map((x) => x.code);
  assert.ok(codes.includes("MISSING_VAR"));
  const cnt = Model.addObject(p, "int", { init: 0 });
  p.loop[0].varId = cnt.id;
  assert.deepEqual(Validate.check(p).errors, []);
});

test("跑马灯：固定数值合法；选中的变量消失（悬空 varId）报错", () => {
  const p = Model.newProject("t");
  const oled = Model.addObject(p, "oled", {});
  const n = Model.nodeAction(oled.id, "marquee", 40);
  p.loop.push(n);
  assert.deepEqual(Validate.check(p).errors, []);   // 固定数值模式
  n.varId = "o99";                                   // 悬空引用
  const codes = Validate.check(p).errors.map((x) => x.code);
  assert.ok(codes.includes("MISSING_VAR"));
  delete n.varId;
  assert.deepEqual(Validate.check(p).errors, []);
});
