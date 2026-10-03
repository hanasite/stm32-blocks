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
