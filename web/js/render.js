(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"), require("./model.js"));
  } else {
    root.Render = factory(root.Catalog, root.Model);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog, Model) {
  "use strict";

  var uidSeq = 0;

  function noop() {}

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }

  function renderObjects(container, project, handlers) {
    container.innerHTML = "";
    project.objects.forEach(function (obj) {
      var card = el("div", "obj-card");
      var del = el("button", "obj-del", "✕");
      del.title = "删除对象";
      del.onclick = function (ev) { ev.stopPropagation(); handlers.onDelete(obj.id); };
      var code = el("code", null, obj.name + " = " + Catalog.get(obj.type).label);
      var desc = el("div", null, describeParams(obj));
      desc.style.fontSize = "12px"; desc.style.color = "#64748b";
      card.appendChild(del); card.appendChild(code); card.appendChild(desc);
      card.onclick = function () { handlers.onEdit(obj.id); };
      container.appendChild(card);
    });
  }

  function describeParams(obj) {
    return Object.keys(obj.params).map(function (k) { return k + "=" + obj.params[k]; }).join(" ");
  }

  function renderBlockList(container, nodes, project, opts) {
    opts = opts || {};
    container.innerHTML = "";
    nodes.forEach(function (node) {
      if (!node.__uid) { node.__uid = "n" + (++uidSeq); }
      container.appendChild(renderNode(node, project, opts));
    });
  }

  function selectOf(options, current) {
    var s = el("select");
    options.forEach(function (o) {
      var opt = el("option", null, o.label);
      opt.value = o.v;
      if (o.v === current) { opt.selected = true; }
      s.appendChild(opt);
    });
    return s;
  }

  function actionObjects(project) {
    return project.objects.filter(function (o) { return Catalog.get(o.type).actions.length > 0; });
  }

  function conditionObjects(project) {
    return project.objects.filter(function (o) { return o.type === "key" || o.type === "int"; });
  }

  function delayBlock(node, opts) {
    var root = el("div", "blk blk-delay");
    root.appendChild(el("span", null, "延时 "));
    var num = el("input");
    num.type = "number";
    num.value = node.ms;
    num.oninput = function () {
      node.ms = Number(this.value === "" ? 0 : this.value);
      (opts.quick || opts.rerender || noop)();
    };
    root.appendChild(num);
    root.appendChild(el("span", null, " 毫秒"));
    return root;
  }

  function actionBlock(node, project, opts) {
    var root = el("div", "blk blk-action");
    var objs = actionObjects(project);
    var obj = Model.findObject(project, node.objectId);
    if (!obj || objs.indexOf(obj) < 0) {
      obj = objs[0];
      if (obj) { node.objectId = obj.id; }
    }
    if (!obj) {
      root.textContent = "动作（先在左边建对象）";
      return root;
    }

    var objSel = selectOf(objs.map(function (o) { return { v: o.id, label: o.name }; }), node.objectId);
    objSel.onchange = function () {
      var o = Model.findObject(project, this.value);
      node.objectId = o.id;
      var first = Catalog.get(o.type).actions[0];
      node.action = first.id;
      if (first.param) { node.value = first.defaultParam; } else { delete node.value; }
      (opts.rerender || noop)();
    };
    root.appendChild(objSel);

    var acts = Catalog.get(obj.type).actions;
    var act = acts.filter(function (a) { return a.id === node.action; })[0];
    if (!act) { act = acts[0]; node.action = act.id; }
    var actSel = selectOf(acts.map(function (a) { return { v: a.id, label: a.label }; }), node.action);
    actSel.onchange = function () {
      var self = this;
      var a = Catalog.get(obj.type).actions.filter(function (x) { return x.id === self.value; })[0];
      node.action = a.id;
      if (a.param) { node.value = a.defaultParam; } else { delete node.value; }
      (opts.rerender || noop)();
    };
    root.appendChild(actSel);

    if (act.param) {
      var num = el("input");
      num.type = "number";
      if (act.min !== undefined) { num.min = act.min; }
      if (act.max !== undefined) { num.max = act.max; }
      num.value = node.value !== undefined ? node.value : act.defaultParam;
      num.oninput = function () {
        node.value = Number(this.value === "" ? 0 : this.value);
        (opts.quick || opts.rerender || noop)();
      };
      root.appendChild(num);
    }
    return root;
  }

  function conditionEditor(node, project, opts) {
    var wrap = el("span", "cond-edit");
    var objs = conditionObjects(project);
    if (!objs.some(function (o) { return o.id === node.cond.objectId; })) {
      var first = objs[0];
      if (!first) { wrap.textContent = "（先在左边建按键或整数对象）"; return wrap; }
      node.cond = first.type === "key"
        ? Model.condState(first.id, "pressed")
        : Model.condCompare(first.id, ">=", 1);
    }
    var cond = node.cond;
    var objSel = selectOf(objs.map(function (o) { return { v: o.id, label: o.name }; }), cond.objectId);
    objSel.onchange = function () {
      var o = Model.findObject(project, this.value);
      node.cond = o.type === "key"
        ? Model.condState(o.id, "pressed")
        : Model.condCompare(o.id, ">=", 1);
      (opts.rerender || noop)();
    };
    wrap.appendChild(objSel);

    var obj = Model.findObject(project, cond.objectId);
    if (obj.type === "key") {
      var stateSel = selectOf([{ v: "pressed", label: "被按下" }, { v: "released", label: "被松开" }], cond.state);
      stateSel.onchange = function () {
        node.cond = Model.condState(obj.id, this.value);
        (opts.quick || opts.rerender || noop)();
      };
      wrap.appendChild(stateSel);
    } else {
      var opSel = selectOf(Catalog.get("int").conditions.map(function (c) { return { v: c.op, label: c.label }; }), cond.op);
      opSel.onchange = function () {
        node.cond = Model.condCompare(obj.id, this.value, cond.value);
        (opts.quick || opts.rerender || noop)();
      };
      wrap.appendChild(opSel);
      var num = el("input");
      num.type = "number";
      num.value = cond.value;
      num.oninput = function () {
        node.cond = Model.condCompare(obj.id, cond.op, Number(this.value === "" ? 0 : this.value));
        (opts.quick || opts.rerender || noop)();
      };
      wrap.appendChild(num);
    }
    return wrap;
  }

  function renderNode(node, project, opts) {
    opts = opts || {};
    var root;
    if (node.kind === "delay") {
      root = delayBlock(node, opts);
    } else if (node.kind === "action") {
      root = actionBlock(node, project, opts);
    } else if (node.kind === "if") {
      root = el("div", "blk blk-if");
      var head = el("div", "if-head");
      head.appendChild(el("span", null, "如果 "));
      head.appendChild(conditionEditor(node, project, opts));
      head.appendChild(el("span", null, " 则"));
      root.appendChild(head);
      var thenBox = el("div", "if-body");
      thenBox.dataset.dropList = "then";
      thenBox.dataset.ownerUid = node.__uid;
      thenBox.dataset.listKind = "then";
      renderBlockList(thenBox, node.then, project, opts);
      root.appendChild(thenBox);
      if (node.else.length > 0 || node.__elseOn) {
        root.appendChild(el("div", "if-else-head", "否则"));
        var elseBox = el("div", "if-body");
        elseBox.dataset.dropList = "else";
        elseBox.dataset.ownerUid = node.__uid;
        elseBox.dataset.listKind = "else";
        renderBlockList(elseBox, node.else, project, opts);
        root.appendChild(elseBox);
      } else {
        var addElse = el("button", "add-else-btn", "＋否则");
        addElse.type = "button";
        addElse.onclick = function () { node.__elseOn = true; (opts.rerender || noop)(); };
        root.appendChild(addElse);
      }
    } else {
      root = el("div", "blk", "?");
    }
    root.dataset.nodeId = node.__uid;
    return root;
  }

  function highlight(code) {
    var esc = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>')
      .replace(/\b(void|if|else|int|return)\b/g, '<span class="tok-kw">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="tok-num">$1</span>');
  }

  function renderCode(code) {
    document.getElementById("code-view").innerHTML = highlight(code);
  }

  return { el: el, renderObjects: renderObjects, renderBlockList: renderBlockList, renderNode: renderNode, renderCode: renderCode };
});
