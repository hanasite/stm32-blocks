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
    var buz = Object.assign(Model.addObject(p, "buzzer", { pin: "PB1", active: "high" }), { id: "o3", name: "buzzer1" });
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

  function irLed() {
    var p = Model.newProject("红外感应灯");
    var ir = Object.assign(Model.addObject(p, "ir", { pin: "PA2", active: "low" }), { id: "o1", name: "ir1" });
    var led = Object.assign(Model.addObject(p, "led", { pin: "PC13", active: "low" }), { id: "o2", name: "led1" });
    var oled = Object.assign(Model.addObject(p, "oled", {}), { id: "o3", name: "oled1" });
    p.loop.push(Model.nodeIf(Model.condState(ir.id, "detected"), [
      Model.nodeAction(led.id, "on"),
      Model.nodeAction(oled.id, "showyes")
    ], [
      Model.nodeAction(led.id, "off"),
      Model.nodeAction(oled.id, "showno")
    ]));
    return p;
  }

  var ALL = [
    { id: "blink", label: "按键点灯", build: blink },
    { id: "combo", label: "按键组合技", build: combo },
    { id: "sweep", label: "舵机来回摆", build: sweep },
    { id: "irled", label: "红外感应灯", build: irLed }
  ];

  function list() { return ALL.map(function (e) { return { id: e.id, label: e.label }; }); }
  function load(id) {
    var e = ALL.filter(function (x) { return x.id === id; })[0];
    if (!e) { throw new Error("示例不存在: " + id); }
    return Model.deserialize(Model.serialize(e.build()));
  }

  return { list: list, load: load };
});
