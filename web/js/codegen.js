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

  function paramOption(obj, paramKey) {
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
