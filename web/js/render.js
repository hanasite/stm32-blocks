(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"), require("./model.js"));
  } else {
    root.Render = factory(root.Catalog, root.Model);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog, Model) {
  "use strict";

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
    container.innerHTML = "";
    nodes.forEach(function (node) {
      container.appendChild(renderNode(node, project, opts || {}));
    });
  }

  function renderNode(node, project) {
    if (node.kind === "delay") {
      var d = el("div", "blk blk-delay", "延时 " + node.ms + " 毫秒");
      return d;
    }
    if (node.kind === "action") {
      var obj = Model.findObject(project, node.objectId) || { name: "?" };
      var act = "?";
      try {
        act = Catalog.get(obj.type).actions.filter(function (a) { return a.id === node.action; })[0].label;
      } catch (e) { /* 忽略渲染错误 */ }
      var extra = node.value !== undefined ? " " + node.value : "";
      return el("div", "blk blk-action", obj.name + " " + act + extra);
    }
    if (node.kind === "if") {
      var wrap = el("div", "blk blk-if");
      var obj2 = Model.findObject(project, node.cond.objectId) || { name: "?" };
      var condText = node.cond.kind === "state"
        ? obj2.name + " " + (node.cond.state === "pressed" ? "被按下" : "被松开")
        : obj2.name + " " + node.cond.op + " " + node.cond.value;
      wrap.appendChild(el("div", "if-head", "如果 " + condText + " 则"));
      var thenBox = el("div", "if-body");
      renderBlockList(thenBox, node.then, project);
      wrap.appendChild(thenBox);
      if (node.else.length > 0) {
        wrap.appendChild(el("div", "if-else-head", "否则"));
        var elseBox = el("div", "if-body");
        renderBlockList(elseBox, node.else, project);
        wrap.appendChild(elseBox);
      }
      return wrap;
    }
    return el("div", "blk", "?");
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
