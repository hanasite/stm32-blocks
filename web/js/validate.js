(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"));
  } else {
    root.Validate = factory(root.Catalog);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog) {
  "use strict";

  var NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

  function check(project) {
    var errors = [];

    // 1) 名字
    var seen = {};
    project.objects.forEach(function (o) {
      if (!NAME_RE.test(o.name)) {
        errors.push({ code: "BAD_NAME", message: "对象名 \"" + o.name + "\" 只能用字母/数字/下划线，字母开头", objectIds: [o.id] });
      }
      if (seen[o.name]) {
        errors.push({ code: "DUP_NAME", message: "对象名重复：" + o.name, objectIds: [seen[o.name], o.id] });
      } else {
        seen[o.name] = o.id;
      }
    });

    // 2) 引脚冲突（含舵机通道映射、OLED 固定占用 PB8/PB9）
    var byPin = {};
    project.objects.forEach(function (o) {
      Catalog.pinsOfObject(o).forEach(function (pin) {
        if (byPin[pin]) { byPin[pin].push(o.id); } else { byPin[pin] = [o.id]; }
      });
    });
    Object.keys(byPin).forEach(function (pin) {
      if (byPin[pin].length > 1) {
        var owners = byPin[pin].map(function (id) {
          return project.objects.filter(function (x) { return x.id === id; })[0];
        });
        var names = owners.map(function (o) { return o ? o.name : "?"; });
        var hasOled = owners.some(function (o) { return o && o.type === "oled"; });
        errors.push({ code: "PIN_CONFLICT",
                      message: "引脚冲突：" + pin + " 被 " + names.join("、") + " 同时占用"
                               + (hasOled ? "（OLED 固定占用 PB8/PB9）" : ""),
                      objectIds: byPin[pin] });
      }
    });

    // 3) 「显示变量」积木必须选中一个存在的整数对象
    (function walkLoop(nodes) {
      nodes.forEach(function (node) {
        if (node.kind === "if") { walkLoop(node.then); walkLoop(node.else); return; }
        if (node.kind !== "action") { return; }
        var obj = project.objects.filter(function (o) { return o.id === node.objectId; })[0];
        if (!obj) { return; }
        var act = Catalog.get(obj.type).actions.filter(function (a) { return a.id === node.action; })[0];
        if (!act) { return; }

        /* 多参数动作（objref 绑定，如小恐龙的 OLED/跳跃输入） */
        if (act.params) {
          act.params.forEach(function (pd) {
            var refId = node.refs ? node.refs[pd.key] : null;
            if (!refId) {
              if (!pd.allowNone) {
                errors.push({ code: "MISSING_REF",
                              message: "「" + obj.name + "」的「" + act.label + "」积木还没绑定「" + pd.label + "」"
                                       + (pd.refType === "oled" ? "（先在左边建一个 OLED 屏对象）" : "（先在左边建一个按键/红外对象）"),
                              objectIds: [obj.id] });
              }
              return;
            }
            if (refId === "__hook__") { return; }   /* 外部钩子：特殊值，合法 */
            var okRef = project.objects.some(function (o) {
              if (o.id !== refId) { return false; }
              return pd.refType === "oled" ? o.type === "oled" : (o.type === "key" || o.type === "ir");
            });
            if (!okRef) {
              errors.push({ code: "MISSING_REF",
                            message: "「" + obj.name + "」的「" + act.label + "」积木的「" + pd.label + "」对象不存在了，请重新绑定",
                            objectIds: [obj.id] });
            }
          });
          return;
        }

        var varOk = node.varId && project.objects.some(function (o) { return o.id === node.varId && o.type === "int"; });
        if (act.paramType === "intref" && !varOk) {
          errors.push({ code: "MISSING_VAR",
                        message: "「" + obj.name + "」的「" + act.label + "」积木还没选整数对象",
                        objectIds: [obj.id] });
        } else if (act.paramType === "numref" && node.varId && !varOk) {
          errors.push({ code: "MISSING_VAR",
                        message: "「" + obj.name + "」的「" + act.label + "」积木选的变量不存在了，请重新选一个",
                        objectIds: [obj.id] });
        }
      });
    })(project.loop);

    return { errors: errors };
  }

  return { check: check };
});
