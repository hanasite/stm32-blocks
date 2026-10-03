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

    // 2) 引脚冲突（含舵机通道映射到的引脚）
    var byPin = {};
    project.objects.forEach(function (o) {
      var pin = Catalog.pinOfObject(o);
      if (!pin) { return; }
      if (byPin[pin]) { byPin[pin].push(o.id); } else { byPin[pin] = [o.id]; }
    });
    Object.keys(byPin).forEach(function (pin) {
      if (byPin[pin].length > 1) {
        var names = byPin[pin].map(function (id) {
          var o = project.objects.filter(function (x) { return x.id === id; })[0];
          return o ? o.name : id;
        });
        errors.push({ code: "PIN_CONFLICT", message: "引脚冲突：" + pin + " 被 " + names.join("、") + " 同时占用",
                      objectIds: byPin[pin] });
      }
    });

    return { errors: errors };
  }

  return { check: check };
});
