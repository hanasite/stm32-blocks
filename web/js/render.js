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

  function assignUids(nodes) {
    nodes.forEach(function (node) {
      if (!node.__uid) { node.__uid = "n" + (++uidSeq); }
      if (node.kind === "if") { assignUids(node.then); assignUids(node.else); }
    });
  }

  /* 预处理：多参数动作的 objref 绑定（在代码生成之前跑，否则首帧代码里绑定还是空） */
  function assignRefs(project) {
    (function walk(nodes) {
      nodes.forEach(function (node) {
        if (node.kind === "if") { walk(node.then); walk(node.else); return; }
        if (node.kind !== "action") { return; }
        var obj = Model.findObject(project, node.objectId);
        if (!obj) { return; }
        var act = Catalog.get(obj.type).actions.filter(function (a) { return a.id === node.action; })[0];
        if (!act || !act.params) { return; }
        node.refs = node.refs || {};
        act.params.forEach(function (pd) {
          var pool = project.objects.filter(function (o) {
            if (pd.refType === "oled") { return o.type === "oled"; }
            return o.type === "key" || o.type === "ir";
          });
          var cur = node.refs[pd.key];
          var curOk = cur && pool.some(function (o) { return o.id === cur; });
          if (cur === undefined || (cur !== "" && !curOk)) {
            node.refs[pd.key] = pool.length > 0 ? pool[0].id : "";
          }
        });
      });
    })(project.loop);
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
    return project.objects.filter(function (o) {
      return o.type === "key" || o.type === "ir" || o.type === "int";
    });
  }

  function defaultCondFor(obj) {
    var states = Catalog.get(obj.type).states;
    return states.length > 0
      ? Model.condState(obj.id, states[0].id)
      : Model.condCompare(obj.id, ">=", 1);
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
      if (a.param && a.paramType !== "intref") { node.value = a.defaultParam; } else { delete node.value; }
      if (a.paramType !== "intref" && a.paramType !== "numref") { delete node.varId; }
      (opts.rerender || noop)();
    };
    root.appendChild(actSel);

    if (act.params) {
      /* 多参数动作（objref 绑定）：每个参数一个对象下拉，缺对象给提示 */
      node.refs = node.refs || {};
      act.params.forEach(function (pd) {
        root.appendChild(el("span", null, " " + pd.label + " "));
        var pool = project.objects.filter(function (o) {
          if (pd.refType === "oled") { return o.type === "oled"; }
          return o.type === "key" || o.type === "ir";
        });
        if (pool.length === 0 && !pd.allowNone) {
          var hint2 = el("span", null, pd.refType === "oled" ? "（先建一个 OLED 屏对象）" : "（先建一个按键/红外对象）");
          hint2.style.fontSize = "12px";
          root.appendChild(hint2);
          delete node.refs[pd.key];
          return;
        }
        if (node.refs[pd.key] === undefined
            || (node.refs[pd.key] !== "" && !pool.some(function (o) { return o.id === node.refs[pd.key]; }))) {
          node.refs[pd.key] = pool.length > 0 ? pool[0].id : "";
        }
        var opts2 = [];
        if (pd.allowNone) { opts2.push({ v: "", label: "（不接）" }); }
        opts2 = opts2.concat(pool.map(function (o) { return { v: o.id, label: o.name }; }));
        var refSel = selectOf(opts2, node.refs[pd.key] || "");
        refSel.onchange = function () {
          node.refs[pd.key] = this.value;
          (opts.quick || opts.rerender || noop)();
        };
        root.appendChild(refSel);
      });
      return root;
    }

    if (act.param) {
      if (act.paramType === "intref") {
        var ints = project.objects.filter(function (o) { return o.type === "int"; });
        if (ints.length === 0) {
          var hint = el("span", null, "（先在左边建一个整数对象）");
          hint.style.fontSize = "12px";
          root.appendChild(hint);
          delete node.varId;
        } else {
          if (!ints.some(function (o) { return o.id === node.varId; })) { node.varId = ints[0].id; }
          var varSel = selectOf(ints.map(function (o) { return { v: o.id, label: o.name }; }), node.varId);
          varSel.onchange = function () {
            node.varId = this.value;
            (opts.quick || opts.rerender || noop)();
          };
          root.appendChild(varSel);
        }
      } else if (act.paramType === "numref") {
        /* 数值或变量二选一：先选「固定数值」或某个整数对象 */
        root.appendChild(el("span", null, " " + (act.paramLabel || "进度") + " "));
        var ints2 = project.objects.filter(function (o) { return o.type === "int"; });
        if (node.varId && !ints2.some(function (o) { return o.id === node.varId; })) { delete node.varId; }
        var modeOpts = [{ v: "", label: "固定数值" }].concat(ints2.map(function (o) { return { v: o.id, label: o.name }; }));
        var modeSel = selectOf(modeOpts, node.varId || "");
        modeSel.onchange = function () {
          if (this.value) { node.varId = this.value; } else { delete node.varId; }
          (opts.rerender || noop)();
        };
        root.appendChild(modeSel);
        if (!node.varId) {
          var numM = el("input");
          numM.type = "number";
          if (act.min !== undefined) { numM.min = act.min; }
          if (act.max !== undefined) { numM.max = act.max; }
          numM.value = node.value !== undefined ? node.value : act.defaultParam;
          numM.oninput = function () {
            node.value = Number(this.value === "" ? 0 : this.value);
            (opts.quick || opts.rerender || noop)();
          };
          root.appendChild(numM);
        }
      } else {
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
        if (act.paramLabel) { root.appendChild(el("span", null, " " + act.paramLabel)); }
      }
    }
    return root;
  }

  function conditionEditor(node, project, opts) {
    var wrap = el("span", "cond-edit");
    var objs = conditionObjects(project);
    if (!objs.some(function (o) { return o.id === node.cond.objectId; })) {
      var first = objs[0];
      if (!first) { wrap.textContent = "（先在左边建按键/红外/整数对象）"; return wrap; }
      node.cond = defaultCondFor(first);
    }
    var cond = node.cond;
    var objSel = selectOf(objs.map(function (o) { return { v: o.id, label: o.name }; }), cond.objectId);
    objSel.onchange = function () {
      var o = Model.findObject(project, this.value);
      node.cond = defaultCondFor(o);
      (opts.rerender || noop)();
    };
    wrap.appendChild(objSel);

    var obj = Model.findObject(project, cond.objectId);
    var states = Catalog.get(obj.type).states;
    if (states.length > 0) {
      /* 状态失效自愈（比如导入的工程里状态和类型对不上） */
      if (!states.some(function (s) { return s.id === cond.state; })) {
        node.cond = Model.condState(obj.id, states[0].id);
        cond = node.cond;
      }
      var stateSel = selectOf(states.map(function (s) { return { v: s.id, label: s.label }; }), cond.state);
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
    root.addEventListener("mouseenter", function () { (opts.hover || noop)(node.__uid, true); });
    root.addEventListener("mouseleave", function () { (opts.hover || noop)(node.__uid, false); });
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
    var view = document.getElementById("code-view");
    var lines = code.split("\n");
    var html = "";
    for (var i = 0; i < lines.length; i++) {
      var h = highlight(lines[i]);
      html += '<div class="code-line" data-line="' + i + '">' + (h === "" ? "&nbsp;" : h) + "</div>";
    }
    view.innerHTML = html;
  }

  return { el: el, assignUids: assignUids, assignRefs: assignRefs, renderObjects: renderObjects, renderBlockList: renderBlockList, renderNode: renderNode, renderCode: renderCode };
});
