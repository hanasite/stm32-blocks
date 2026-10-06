const test = require("node:test");
const assert = require("node:assert");
const JSZip = require("../web/vendor/jszip.min.js");
const Model = require("../web/js/model.js");
const Codegen = require("../web/js/codegen.js");
const Examples = require("../web/js/examples.js");
const Packer = require("../web/js/packer.js");

async function fixtureBase64() {
  const zip = new JSZip();
  zip.file("template/CMakeLists.txt", "cmake-min");
  zip.file("template/Core/Src/user_code.c", "OLD-CONTENT");
  zip.file("template/.vscode/tasks.json", "{}");
  return zip.generateAsync({ type: "base64" });
}

test("打包：根目录改名 + user_code.c 替换为生成代码，其余文件原样", async () => {
  const project = Examples.load("blink");
  project.projectName = "小明的作品";
  const b64 = await fixtureBase64();
  const out = await Packer.buildProjectZip(project, b64, "小明的作品");
  const zip = await JSZip.loadAsync(out);
  const names = Object.keys(zip.files);
  assert.ok(names.includes("小明的作品/CMakeLists.txt"));
  assert.ok(names.includes("小明的作品/Core/Src/user_code.c"));
  assert.ok(names.includes("小明的作品/.vscode/tasks.json"));
  assert.ok(!names.some((n) => n.startsWith("template/")));
  const userCode = await zip.file("小明的作品/Core/Src/user_code.c").async("string");
  assert.equal(userCode, Codegen.generate(project));
});
