(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"), require("./model.js"));
  } else {
    root.ObjectsUI = factory(root.Catalog, root.Model);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog, Model) {
  "use strict";

  var NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  var state = { type: null, objId: null };

  function open(project, objId, onDone) {
    var dlg = document.getElementById("object-dialog");
    var editing = !!objId;
    var obj = editing ? Model.findObject(project, objId) : null;
    state.type = editing ? obj.type : null;
    state.objId = objId || null;

    document.getElementById("dlg-title").textContent = editing ? "编辑对象" : "新建对象";
    document.getElementById("dlg-name").value = editing ? obj.name : "";
    renderTypes();
    renderParams(obj);
    document.getElementById("dlg-hint").classList.add("hidden");

    document.getElementById("dlg-ok").onclick = function (ev) {
      var name = document.getElementById("dlg-name").value.trim();
      var hint = document.getElementById("dlg-hint");
      if (!state.type) { hint.textContent = "先选一个类型"; hint.classList.remove("hidden"); ev.preventDefault(); return; }
      if (!NAME_RE.test(name)) { hint.textContent = "名字只能用字母/数字/下划线，且字母开头"; hint.classList.remove("hidden"); ev.preventDefault(); return; }
      var dup = project.objects.some(function (o) { return o.name === name && o.id !== state.objId; });
      if (dup) { hint.textContent = "名字已被占用"; hint.classList.remove("hidden"); ev.preventDefault(); return; }
      var params = collectParams();
      if (editing) { obj.name = name; obj.params = params; }
      else { var created = Model.addObject(project, state.type, params); created.name = name; }
      onDone();
    };
    dlg.showModal();
  }

  function renderTypes() {
    var box = document.getElementById("dlg-types");
    box.innerHTML = "";
    Catalog.TYPES.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = Catalog.get(t).label;
      if (t === state.type) { b.className = "sel"; }
      b.onclick = function () { state.type = t; renderTypes(); renderParams(null); };
      box.appendChild(b);
    });
  }

  function renderParams(obj, defaults) {
    var box = document.getElementById("dlg-params");
    box.innerHTML = "";
    if (!state.type) { return; }
    Catalog.get(state.type).params.forEach(function (p) {
      var label = document.createElement("label");
      label.textContent = p.label + " ";
      var input;
      var current = obj ? obj.params[p.key] : (defaults && defaults[p.key]);
      if (current === undefined) {
        current = p.type === "number" ? (p.default !== undefined ? p.default : 0)
                : (p.options && p.options.length ? p.options[0].v : "");
      }
      if (p.options) {
        input = document.createElement("select");
        p.options.forEach(function (o) {
          var opt = document.createElement("option");
          opt.value = o.v; opt.textContent = o.label;
          if (o.v === current) { opt.selected = true; }
          input.appendChild(opt);
        });
      } else {
        input = document.createElement("input");
        input.type = p.type === "number" ? "number" : "text";
        input.value = current;
      }
      input.dataset.param = p.key;
      label.appendChild(input);
      box.appendChild(label);
    });
  }

  function collectParams() {
    var params = {};
    [].forEach.call(document.querySelectorAll("#dlg-params [data-param]"), function (input) {
      var p = findParamDef(input.dataset.param);
      params[input.dataset.param] = (p && p.type === "number") ? Number(input.value) : input.value;
    });
    return params;
  }

  function findParamDef(key) {
    return Catalog.get(state.type).params.filter(function (p) { return p.key === key; })[0];
  }

  function typeOf() { return state.type; }

  return { open: open, typeOf: typeOf, renderParams: renderParams };
});
