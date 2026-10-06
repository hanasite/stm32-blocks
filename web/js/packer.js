(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../vendor/jszip.min.js"), require("./codegen.js"));
  } else {
    root.Packer = factory(root.JSZip, root.Codegen);
  }
})(typeof self !== "undefined" ? self : this, function (JSZip, Codegen) {
  "use strict";

  function rootFolderOf(names) {
    var first = names[0];
    var i = first.indexOf("/");
    return i > 0 ? first.slice(0, i) : "";
  }

  function buildProjectZip(project, templateBase64, projectName) {
    return JSZip.loadAsync(templateBase64, { base64: true }).then(function (tpl) {
      var out = new JSZip();
      var names = Object.keys(tpl.files).sort();
      var rootName = rootFolderOf(names);
      var prefix = rootName ? rootName + "/" : "";
      var userCode = Codegen.generate(project);

      var jobs = names.map(function (name) {
        var file = tpl.files[name];
        if (file.dir || name === rootName) { return Promise.resolve(); }
        var rel = name.indexOf(prefix) === 0 ? name.slice(prefix.length) : name;
        var newName = projectName + "/" + rel;
        if (rel === "Core/Src/user_code.c") {
          out.file(newName, userCode);
          return Promise.resolve();
        }
        return file.async("uint8array").then(function (data) { out.file(newName, data); });
      });
      return Promise.all(jobs).then(function () {
        return out.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
      });
    });
  }

  return { buildProjectZip: buildProjectZip };
});
