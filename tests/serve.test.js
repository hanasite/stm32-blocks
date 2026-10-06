const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { createBridge } = require("../tools/serve.js");
const { ROOT, cmakePath } = require("../tools/lib/project-build.js");
const Codegen = require("../web/js/codegen.js");
const Examples = require("../web/js/examples.js");

const hasCube = fs.existsSync(cmakePath());

test("本地服务：ping / 静态页 / 目录穿越防护", async () => {
  const srv = createBridge({ port: 0 });
  await srv.ready;
  const base = "http://127.0.0.1:" + srv.port;
  try {
    const ping = await (await fetch(base + "/api/ping")).json();
    assert.equal(ping.ok, true);
    assert.equal(typeof ping.node, "string");
    const html = await (await fetch(base + "/")).text();
    assert.ok(html.includes("STM32 积木工坊"));
    const js = await fetch(base + "/js/app.js");
    assert.equal(js.status, 200);
    const bad = await fetch(base + "/%2e%2e/package.json");
    assert.equal(bad.status, 404);
    const noApi = await (await fetch(base + "/api/nope")).json();
    assert.equal(noApi.ok, false);
  } finally {
    await srv.close();
  }
});

test("本地服务：build API 真编译（含中文工程名）", { skip: hasCube ? false : "未找到 CubeCLT" }, async () => {
  const srv = createBridge({ port: 0 });
  await srv.ready;
  const base = "http://127.0.0.1:" + srv.port;
  let r;
  try {
    r = await (await fetch(base + "/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "测试-桥", code: Codegen.generate(Examples.load("blink")) }),
    })).json();
  } finally {
    await srv.close();
  }
  assert.equal(r.ok, true, r.log);
  const elf = path.join(ROOT, "local-builds", "测试-桥", "build", "firmware.elf");
  assert.ok(fs.existsSync(elf), "firmware.elf 应存在: " + elf);
  fs.rmSync(path.join(ROOT, "local-builds", "测试-桥"), { recursive: true, force: true });
});
