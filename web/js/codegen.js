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
    if (obj.type === "key" || obj.type === "led" || obj.type === "buzzer" || obj.type === "ir") {
      map.port = Catalog.gpioPortOf(obj.params.pin);
      map.pin = Catalog.gpioPinMacroOf(obj.params.pin);
    }
    if (obj.type === "key") { map.pull = paramOption(obj, "pull"); }
    if (obj.type === "led" || obj.type === "buzzer" || obj.type === "ir") { map.active = paramOption(obj, "active"); }
    if (obj.type === "int") { map.init = String(obj.params.init); }
    return map;
  }

  function commentText(obj) {
    var map = { n: obj.name };
    if (obj.type === "servo") { map.channel = obj.params.channel; }
    if (obj.type === "key" || obj.type === "led" || obj.type === "buzzer" || obj.type === "ir") { map.pin = obj.params.pin; }
    if (obj.type === "key") { map.pullLabel = paramLabel(obj, "pull"); }
    if (obj.type === "led" || obj.type === "buzzer" || obj.type === "ir") { map.activeLabel = paramLabel(obj, "active"); }
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

  function emitNodes(nodes, depth, project, out, trace) {
    var pad = INDENT.repeat(depth);
    nodes.forEach(function (node) {
      var obj;
      var start = out.length;
      if (node.kind === "delay") {
        out.push(pad + "Delay_ms(" + node.ms + ");");
      } else if (node.kind === "action") {
        obj = Model.findObject(project, node.objectId);
        var act = Catalog.get(obj.type).actions.filter(function (a) { return a.id === node.action; })[0];
        var map = { n: obj.name };
        if (act.params) {
          /* 多参数动作（objref 绑定）：解析 node.refs 里的对象引用 */
          act.params.forEach(function (pd) {
            var refId = node.refs ? node.refs[pd.key] : null;
            var refObj = refId ? Model.findObject(project, refId) : null;
            if (pd.refType === "oled") {
              map[pd.key] = refObj ? "&" + refObj.name : "0";   /* 缺绑定给 0，引擎侧容错 */
            } else if (refObj && refObj.type === "ir") {
              map[pd.key] = "Ir_IsTriggered(&" + refObj.name + ")";
            } else if (refObj && refObj.type === "key") {
              map[pd.key] = "Key_IsPressed(&" + refObj.name + ")";
            } else {
              map[pd.key] = "0";                                 /* 不接输入 */
            }
          });
        } else if (act.param) {
          if (act.paramType === "intref") {
            var varObj = node.varId ? Model.findObject(project, node.varId) : null;
            map[act.param] = varObj ? varObj.name : "0";   /* 缺变量时给 0，validate 会拦截 */
          } else if (act.paramType === "numref") {
            var refObj = node.varId ? Model.findObject(project, node.varId) : null;
            map[act.param] = refObj ? refObj.name
              : (node.value !== undefined ? node.value : act.defaultParam);
          } else {
            map[act.param] = node.value !== undefined ? node.value : act.defaultParam;
          }
        }
        out.push(pad + fill(act.code, map));
      } else if (node.kind === "if") {
        out.push(pad + "if (" + emitCondition(node.cond, project) + ") {");
        emitNodes(node.then, depth + 1, project, out, trace);
        if (node.else.length > 0) {
          out.push(pad + "} else {");
          emitNodes(node.else, depth + 1, project, out, trace);
        }
        out.push(pad + "}");
      }
      if (trace && node.__uid) { trace[node.__uid] = [start, out.length - 1]; }
    });
  }

  function generate(project, opts) {
    var trace = (opts && opts.trace) || null;   // 侧通道：node.__uid → [起始行, 结束行]
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
    out.push("/* 主循环：单片机会从头到尾一直执行这一段（不断重复） */");
    out.push("void user_loop(void)");
    out.push("{");
    emitNodes(project.loop, 1, project, out, trace);
    out.push("}");
    return out.join("\n") + "\n";
  }

  return { generate: generate };
});
