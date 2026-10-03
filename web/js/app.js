(function () {
  "use strict";

  var LS_KEY = "stm32-blocks:project";
  var project = null;

  function change() { refresh(); }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  function quickRefresh() {
    // 校验 → 横幅 + 下载/编译按钮
    var result = Validate.check(project);
    var bad = result.errors.length > 0;
    var banner = document.getElementById("error-banner");
    if (bad) {
      banner.textContent = result.errors.map(function (e) { return e.message; }).join("；");
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
    lastValid = !bad;
    document.getElementById("btn-download").disabled = bad;
    ["btn-build", "btn-flash"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) { b.disabled = bad; }
    });
    // 代码面板（带 trace 用于悬停联动）
    lastTrace = {};
    Render.renderCode(Codegen.generate(project, { trace: lastTrace }));
    // 自动保存
    try { localStorage.setItem(LS_KEY, Model.serialize(project)); } catch (e) { /* 隐私模式忽略 */ }
  }

  var lastTrace = {};

  function hoverLines(uid, on) {
    var range = lastTrace[uid];
    if (!range) { return; }
    for (var i = range[0]; i <= range[1]; i++) {
      var lineEl = document.querySelector('.code-line[data-line="' + i + '"]');
      if (lineEl) { lineEl.classList.toggle("code-hl", on); }
    }
  }

  var blockOpts = { rerender: refresh, quick: quickRefresh, hover: hoverLines };

  function refresh() {
    Render.assignUids(project.loop);   // 先给新节点分配 uid，代码生成的 trace 才查得到
    quickRefresh();
    Render.renderObjects(document.getElementById("object-list"), project, {
      onDelete: function (id) {
        var refs = Model.countReferences(project, id);
        var msg = refs > 0 ? "该对象被 " + refs + " 块积木使用，删除会一并移除。确定？" : "确定删除？";
        if (window.confirm(msg)) { Model.deleteObject(project, id); change(); }
      },
      onEdit: function (id) {
        ObjectsUI.open(project, id, function () { change(); });
      }
    });
    Render.renderBlockList(document.getElementById("loop-slot"), project.loop, project, blockOpts);
  }

  /* ---------- 拖拽落地辅助 ---------- */

  function resolveDropList(proj, info) {
    if (info.dropList === "loop") { return proj.loop; }
    var owner = Model.findNodeByUid(proj, info.ownerUid);
    if (!owner) { return null; }
    return info.listKind === "then" ? owner.then : owner.else;
  }

  function dropIndexAt(info, list) {
    for (var i = 0; i < list.length; i++) {
      var dom = list[i].__uid ? document.querySelector('[data-node-id="' + list[i].__uid + '"]') : null;
      if (!dom) { continue; }
      var r = dom.getBoundingClientRect();
      if (info.y < r.top + r.height / 2) { return i; }
    }
    return list.length;
  }

  function makePaletteNode(type, proj) {
    if (type === "delay") { return Model.nodeDelay(100); }
    if (type === "if") {
      var keyObj = proj.objects.filter(function (o) { return o.type === "key"; })[0];
      if (keyObj) { return Model.nodeIf(Model.condState(keyObj.id, "pressed"), [], []); }
      var intObj = proj.objects.filter(function (o) { return o.type === "int"; })[0];
      if (intObj) { return Model.nodeIf(Model.condCompare(intObj.id, ">=", 1), [], []); }
      return null;   // 没有可用对象：不给放
    }
    var actObj = proj.objects.filter(function (o) { return Catalog.get(o.type).actions.length > 0; })[0];
    if (!actObj) { return null; }
    var act = Catalog.get(actObj.type).actions[0];
    var node = Model.nodeAction(actObj.id, act.id);
    if (act.param) { node.value = act.defaultParam; }
    return node;
  }

  /* ---------- 本地编译服务（可选增强；探测不到则保持纯离线模式） ---------- */

  var BRIDGE = (location.protocol === "http:" || location.protocol === "https:") ? "" : "http://127.0.0.1:8899";
  var bridgeInfo = null;
  var lastValid = true;

  function bridgeFetch(pathname, body) {
    var opts;
    if (body !== undefined) {
      opts = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    }
    return fetch(BRIDGE + pathname, opts).then(function (r) { return r.json(); });
  }

  function probeBridge() {
    var timeout = (typeof AbortSignal !== "undefined" && AbortSignal.timeout) ? AbortSignal.timeout(1500) : undefined;
    fetch(BRIDGE + "/api/ping", { signal: timeout })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) { return; }
        bridgeInfo = j;
        var chip = document.getElementById("bridge-status");
        if (chip) {
          chip.textContent = j.cubecltOk ? "本地工具链已连接" : "本地服务在线（未找到 CubeCLT）";
          chip.title = "CubeCLT: " + j.cubeclt + "\n" + (j.gcc || "未探测到 gcc");
          chip.classList.remove("hidden");
        }
        ["btn-build", "btn-flash"].forEach(function (id) {
          var b = document.getElementById(id);
          if (b) { b.classList.remove("hidden"); b.disabled = !lastValid; }
        });
      })
      .catch(function () { /* 没有本地服务：静默保持隐藏 */ });
  }

  function runBridge(kind) {
    var name = project.projectName || "我的工程";
    var dlg = document.getElementById("log-dialog");
    var title = document.getElementById("log-title");
    var view = document.getElementById("log-view");
    title.textContent = kind === "flash" ? "编译并烧录中…（通常 5～15 秒）" : "编译中…（通常 3～10 秒）";
    view.textContent = "正在调用本机工具链…";
    if (dlg && !dlg.open) { dlg.showModal(); }
    bridgeFetch("/api/build", { name: name, code: Codegen.generate(project) })
      .then(function (b) {
        if (!b.ok) {
          title.textContent = "❌ 编译失败（" + b.secs + "s）";
          view.textContent = b.log || "（无日志）";
          return null;
        }
        if (kind !== "flash") {
          title.textContent = "✅ 编译成功（" + b.secs + "s）";
          view.textContent = "产物目录：" + b.dir + "\n" + (b.log || "").split("\n").slice(-8).join("\n");
          return null;
        }
        title.textContent = "编译成功（" + b.secs + "s），正在烧录…";
        view.textContent = "正在连接 ST-Link…";
        return bridgeFetch("/api/flash", { name: name }).then(function (f) {
          title.textContent = f.ok ? "✅ 烧录完成（" + f.secs + "s），板子应该动起来了" : "❌ 烧录失败（" + f.secs + "s）";
          view.textContent = f.log || "（无日志）";
        });
      })
      .catch(function (e) {
        title.textContent = "❌ 连接本地服务失败";
        view.textContent = "服务可能已退出——重新双击「启动本地编译服务.bat」即可。\n" + ((e && e.message) || e);
      });
  }

  function init() {
    var saved = null;
    try { saved = localStorage.getItem(LS_KEY); } catch (e) {}
    project = saved ? Model.deserialize(saved) : Examples.load("blink");

    document.getElementById("project-name").value = project.projectName;
    document.getElementById("project-name").addEventListener("input", function () {
      project.projectName = this.value || "我的工程";
      change();
    });
    document.getElementById("btn-add-object").onclick = function () {
      ObjectsUI.open(project, null, function () { change(); });
    };
    document.getElementById("btn-copy").onclick = function () {
      navigator.clipboard.writeText(Codegen.generate(project));
    };
    document.getElementById("btn-download").onclick = function () {
      if (!window.TEMPLATE_ZIP) { alert("模板未内嵌：先运行 node tools/embed-template.js"); return; }
      Packer.buildProjectZip(project, window.TEMPLATE_ZIP, project.projectName || "我的工程")
        .then(function (data) {
          var blob = new Blob([data], { type: "application/zip" });
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = (project.projectName || "我的工程") + ".zip";
          a.click();
        })
        .catch(function (err) { alert("打包失败：" + err.message); });
    };
    var btnBuild = document.getElementById("btn-build");
    if (btnBuild) { btnBuild.onclick = function () { runBridge("build"); }; }
    var btnFlash = document.getElementById("btn-flash");
    if (btnFlash) { btnFlash.onclick = function () { runBridge("flash"); }; }
    var logClose = document.getElementById("log-close");
    if (logClose) { logClose.onclick = function () { document.getElementById("log-dialog").close(); }; }
    probeBridge();

    Examples.list().forEach(function (e) {
      var opt = document.createElement("option");
      opt.value = e.id; opt.textContent = e.label;
      document.getElementById("example-select").appendChild(opt);
    });
    document.getElementById("example-select").onchange = function () {
      if (!this.value) { return; }
      if (window.confirm("载入示例会覆盖当前工程，继续？")) {
        project = Examples.load(this.value);
        document.getElementById("project-name").value = project.projectName;
        change();
      }
      this.value = "";
    };
    document.getElementById("btn-export").onclick = function () {
      var blob = new Blob([Model.serialize(project)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (project.projectName || "工程") + ".json";
      a.click();
    };
    document.getElementById("btn-import").onclick = function () { document.getElementById("import-file").click(); };
    document.getElementById("import-file").onchange = function () {
      var file = this.files[0];
      if (!file) { return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          project = Model.deserialize(reader.result);
          document.getElementById("project-name").value = project.projectName;
          change();
        } catch (err) { alert("导入失败：" + err.message); }
      };
      reader.readAsText(file);
      this.value = "";
    };

    DragDrop.init({
      palette: document.getElementById("palette"),
      trash: document.getElementById("trash"),
      onChange: change,
      onDelete: function (info) {
        if (info.paletteType) { change(); return; }        // 从积木盒拖进垃圾桶 = 什么都不做
        Model.deleteNodeByUid(project, info.uid);
        change();
      },
      onDrop: function (info) {
        var targetList = resolveDropList(project, info);
        if (!targetList) { change(); return; }
        var index = dropIndexAt(info, targetList);
        if (info.paletteType) {
          var node = makePaletteNode(info.paletteType, project);
          if (node) {
            targetList.splice(index, 0, node);
          } else {
            toast(info.paletteType === "if"
              ? "先在左边建一个「按键」或「整数」对象，再拖「如果」"
              : "先在左边建一个 LED / 蜂鸣器 / 舵机 / 整数 对象，再拖「动作」");
          }
        } else {
          var existing = Model.findNodeByUid(project, info.uid);
          if (existing) { Model.moveNode(project, existing, targetList, index); }
        }
        change();
      }
    });

    refresh();
  }

  window.App = {
    init: init, refresh: refresh, getProject: function () { return project; },
    resolveDropList: resolveDropList, dropIndexAt: dropIndexAt, makePaletteNode: makePaletteNode,
    getBridge: function () { return bridgeInfo; }
  };
  document.addEventListener("DOMContentLoaded", init);
})();
