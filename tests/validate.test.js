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
