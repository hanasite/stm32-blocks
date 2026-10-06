(function (root) {
  "use strict";

  var opts = null;
  var drag = null;   // { uid?, paletteType?, ghost, srcEl?, overTrash? }

  function init(o) {
    opts = o;
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function makeGhost(src) {
    var g = document.createElement("div");
    g.className = "drag-ghost";
    g.style.position = "fixed";
    g.style.pointerEvents = "none";
    g.style.zIndex = "9999";
    g.style.opacity = "0.9";
    g.style.width = src.offsetWidth + "px";
    return g;
  }

  function moveGhost(ev) {
    drag.ghost.style.left = (ev.clientX + 8) + "px";
    drag.ghost.style.top = (ev.clientY + 8) + "px";
  }

  function onDown(ev) {
    var pal = ev.target.closest && ev.target.closest("[data-palette]");
    if (pal) {
      ev.preventDefault();
      drag = { paletteType: pal.dataset.palette, ghost: makeGhost(pal) };
      drag.ghost.textContent = pal.textContent;
      drag.ghost.classList.add("pal-" + pal.dataset.palette);
      document.body.appendChild(drag.ghost);
      moveGhost(ev);
      opts.trash.classList.remove("hidden");
      return;
    }
    var blk = ev.target.closest && ev.target.closest("[data-node-id]");
    if (blk && !ev.target.closest("select,input,button")) {
      drag = { uid: blk.dataset.nodeId, ghost: makeGhost(blk), srcEl: blk };
      drag.ghost.innerHTML = blk.innerHTML;   // 拖动幽灵（静态拷贝）
      document.body.appendChild(drag.ghost);
      moveGhost(ev);
      blk.classList.add("dragging-src");
      opts.trash.classList.remove("hidden");
    }
  }

  function findDropTarget(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) { return null; }
    var t = el.closest("[data-drop-list]");
    if (t) { return t; }
    var canvas = document.getElementById("canvas");
    if (canvas && canvas.contains(el)) {
      return document.getElementById("loop-slot");   // 画布空白区域视同落到主循环
    }
    return null;
  }

  function onMove(ev) {
    if (!drag) { return; }
    moveGhost(ev);
    document.querySelectorAll(".drop-hint").forEach(function (e) { e.classList.remove("drop-hint"); });
    var target = findDropTarget(ev.clientX, ev.clientY);
    if (target) { target.classList.add("drop-hint"); }
    drag.overTrash = !!(ev.target.closest && ev.target.closest("#trash"));
    document.getElementById("trash").classList.toggle("trash-hot", drag.overTrash);
  }

  function onUp(ev) {
    if (!drag) { return; }
    var info = {
      uid: drag.uid, paletteType: drag.paletteType,
      overTrash: drag.overTrash, x: ev.clientX, y: ev.clientY
    };
    var ghost = drag.ghost, srcEl = drag.srcEl;
    drag = null;

    ghost.remove();
    if (srcEl) { srcEl.classList.remove("dragging-src"); }
    document.querySelectorAll(".drop-hint").forEach(function (e) { e.classList.remove("drop-hint"); });
    var trash = document.getElementById("trash");
    trash.classList.remove("trash-hot");
    trash.classList.add("hidden");

    if (info.overTrash) { opts.onDelete(info); return; }
    var target = findDropTarget(info.x, info.y);
    if (!target) { opts.onChange(); return; }   // 无效落点：重渲染回弹
    info.dropList = target.dataset.dropList;
    info.ownerUid = target.dataset.ownerUid || "";
    info.listKind = target.dataset.listKind || "";
    opts.onDrop(info);
  }

  root.DragDrop = { init: init };
})(typeof self !== "undefined" ? self : this);
