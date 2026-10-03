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

test("红外与 OLED：引脚映射、动作定义与接线提示", () => {
  assert.equal(Catalog.pinOfObject({ type: "ir", params: { pin: "PA2" } }), "PA2");
  assert.deepEqual(Catalog.pinsOfObject({ type: "oled", params: {} }), ["PB8", "PB9"]);
  assert.deepEqual(Catalog.pinsOfObject({ type: "servo", params: { channel: "TIM3_CH4" } }), ["PB1"]);
  assert.deepEqual(Catalog.pinsOfObject({ type: "int", params: {} }), []);
  assert.ok(Catalog.get("ir").states.some((s) => s.id === "detected"));
  assert.equal(Catalog.get("oled").actions.length, 6);
  const sv = Catalog.get("oled").actions.find((a) => a.id === "showvar");
  assert.equal(sv.paramType, "intref");
  const mq = Catalog.get("oled").actions.find((a) => a.id === "marquee");
  assert.equal(mq.min, 0);
  assert.equal(mq.max, 100);
  // 按键/LED 的电平选项带接线提示（另一端接什么）
  assert.ok(Catalog.get("key").params.find((p) => p.key === "pull").options[0].label.includes("接 GND"));
  assert.ok(Catalog.get("led").params.find((p) => p.key === "active").options[1].label.includes("接 3V3"));
});
