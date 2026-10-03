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

test("serialize 不包含 __uid（UI 临时属性）", () => {
  const p = Model.newProject("t");
  const d = Model.nodeDelay(5); d.__uid = "n1"; d.__elseOn = true; p.loop.push(d);
  const s = Model.serialize(p);
  assert.ok(!s.includes("__uid"));
  assert.ok(!s.includes("__elseOn"));
});

test("findNodeByUid / deleteNodeByUid", () => {
  const p = Model.newProject("t");
  const a = Model.nodeDelay(1); a.__uid = "na";
  const b = Model.nodeDelay(2); b.__uid = "nb";
  p.loop.push(a, b);
  assert.equal(Model.findNodeByUid(p, "nb"), b);
  assert.equal(Model.deleteNodeByUid(p, "na"), a);
  assert.equal(p.loop.length, 1);
  assert.equal(p.loop[0], b);
});

test("删除对象后再新建不会产生 ID 冲突（回归：曾致 findObject 取错对象）", () => {
  const p = Model.newProject("t");
  const a = Model.addObject(p, "key", { pin: "PA1", pull: "up" });      // o1
  Model.addObject(p, "led", { pin: "PC13", active: "high" });           // o2
  Model.deleteObject(p, a.id);
  const c = Model.addObject(p, "int", { init: 0 });
  const ids = p.objects.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, "ID 必须唯一");
  assert.equal(c.id, "o3");
});

test("删除整数对象会清理「显示变量」积木（varId 引用），且计数生效", () => {
  const p = Model.newProject("t");
  const oled = Model.addObject(p, "oled", {});
  const cnt = Model.addObject(p, "int", { init: 0 });
  const node = Model.nodeAction(oled.id, "showvar");
  node.varId = cnt.id;
  p.loop.push(node, Model.nodeDelay(10));
  assert.equal(Model.countReferences(p, cnt.id), 1);
  const removed = Model.deleteObject(p, cnt.id);
  assert.equal(removed, 1);
  assert.equal(p.loop.length, 1);
  assert.equal(p.loop[0].kind, "delay");
});
