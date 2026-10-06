const test = require("node:test");
const assert = require("node:assert");
const Examples = require("../web/js/examples.js");
const Validate = require("../web/js/validate.js");
const Codegen = require("../web/js/codegen.js");

test("六个示例都存在且校验通过", () => {
  assert.equal(Examples.list().length, 6);
  Examples.list().forEach((e) => {
    const p = Examples.load(e.id);
    assert.equal(Validate.check(p).errors.length, 0, e.id + " 应无校验错误");
    assert.ok(Codegen.generate(p).includes("void user_loop(void)"));
  });
});

test("dino 示例：绑定 OLED 与红外跳跃输入", () => {
  const code = Codegen.generate(Examples.load("dino"));
  assert.ok(code.includes("Dino_Init(&dino1);"));
  assert.ok(code.includes("Dino_Frame(&dino1, &oled1, Ir_IsTriggered(&ir1));"));
  assert.ok(code.includes("Delay_ms(30);"));
});

test("marquee 示例：变量驱动进度、满 100 归零", () => {
  const code = Codegen.generate(Examples.load("marquee"));
  assert.ok(code.includes("if (count1 < 100) {"));
  assert.ok(code.includes("count1 = count1 + 1;"));
  assert.ok(code.includes("count1 = 0;"));
  assert.ok(code.includes("Oled_Marquee(&oled1, count1);"));
});

test("irled 示例包含红外条件与 OLED 大字体显示", () => {
  const code = Codegen.generate(Examples.load("irled"));
  assert.ok(code.includes("if (Ir_IsTriggered(&ir1)) {"));
  assert.ok(code.includes('Oled_ShowText(&oled1, "YES");'));
  assert.ok(code.includes('Oled_ShowText(&oled1, "NO");'));
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
