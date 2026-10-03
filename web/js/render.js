(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./catalog.js"), require("./model.js"));
  } else {
    root.Render = factory(root.Catalog, root.Model);
  }
})(typeof self !== "undefined" ? self : this, function (Catalog, Model) {
  "use strict";

  var uidSeq = 0;

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
      if (!node.__uid) { node.__uid = "n" + (++uidSeq); }
      container.appendChild(renderNode(node, project, opts || {}));
    });
  }

  function renderNode(node, project) {
    var root;
    if (node.kind === "delay") {
      root = el("div", "blk blk-delay", "延时 " + node.ms + " 毫秒");
    } else if (node.kind === "action") {
      var obj = Model.findObject(project, node.objectId) || { name: "?" };
      var act = "?";
      try {
        act = Catalog.get(obj.type).actions.filter(function (a) { return a.id === node.action; })[0].label;
      } catch (e) { /* 忽略渲染错误 */ }
      var extra = node.value !== undefined ? " " + node.value : "";
      root = el("div", "blk blk-action", obj.name + " " + act + extra);
    } else if (node.kind === "if") {
      root = el("div", "blk blk-if");
      var obj2 = Model.findObject(project, node.cond.objectId) || { name: "?" };
      var condText = node.cond.kind === "state"
        ? obj2.name + " " + (node.cond.state === "pressed" ? "被按下" : "被松开")
        : obj2.name + " " + node.cond.op + " " + node.cond.value;
      root.appendChild(el("div", "if-head", "如果 " + condText + " 则"));
      var thenBox = el("div", "if-body");
      thenBox.dataset.dropList = "then";
      thenBox.dataset.ownerUid = node.__uid;
      thenBox.dataset.listKind = "then";
      renderBlockList(thenBox, node.then, project);
      root.appendChild(thenBox);
      if (node.else.length > 0) {
        root.appendChild(el("div", "if-else-head", "否则"));
        var elseBox = el("div", "if-body");
        elseBox.dataset.dropList = "else";
        elseBox.dataset.ownerUid = node.__uid;
        elseBox.dataset.listKind = "else";
        renderBlockList(elseBox, node.else, project);
        root.appendChild(elseBox);
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
