(function () {
  "use strict";

  var LS_KEY = "stm32-blocks:project";
  var project = null;

  function change() { refresh(); }

  function refresh() {
    // 1) 校验 → 横幅 + 下载按钮
    var result = Validate.check(project);
    var banner = document.getElementById("error-banner");
    if (result.errors.length > 0) {
      banner.textContent = result.errors.map(function (e) { return e.message; }).join("；");
      banner.classList.remove("hidden");
      document.getElementById("btn-download").disabled = true;
    } else {
      banner.classList.add("hidden");
      document.getElementById("btn-download").disabled = false;
    }
    // 2) 代码
    Render.renderCode(Codegen.generate(project));
    // 3) 对象区
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
    // 4) 主循环渲染（本任务先静态渲染；拖拽任务接管后改为 interactive）
    Render.renderBlockList(document.getElementById("loop-slot"), project.loop, project);
    // 5) 自动保存
    try { localStorage.setItem(LS_KEY, Model.serialize(project)); } catch (e) { /* 隐私模式忽略 */ }
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
      alert("打包功能开发中（Task 10/11）");
    };
    refresh();
  }

  window.App = { init: init, refresh: refresh, getProject: function () { return project; } };
  document.addEventListener("DOMContentLoaded", init);
})();
