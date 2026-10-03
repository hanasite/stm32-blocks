#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATE = path.join(ROOT, "template");
const Examples = require("../web/js/examples.js");
const Codegen = require("../web/js/codegen.js");

const CUBECLT = process.env.CUBECLT || "D:\\STM32CubeCLT_1.18.0";
const ENV = Object.assign({}, process.env, {
  CUBECLT,
  PATH: [
    path.join(CUBECLT, "CMake", "bin"),
    path.join(CUBECLT, "Ninja"),
    path.join(CUBECLT, "GNU-tools-for-STM32", "bin"),
    path.join(CUBECLT, "STM32CubeProgrammer", "bin"),
    process.env.PATH,
  ].join(path.delimiter),
});

// 按路径前缀排除（不用正则匹配路径：仓库若位于含 "build" 的目录会误伤全部文件）
const EXCLUDES = ["build", ".git", ".vscode-server"]
  .map((d) => path.join(TEMPLATE, d));
const filter = (src) => !EXCLUDES.some((ex) => src === ex || src.startsWith(ex + path.sep));

const CONFIGURE_ARGS = ["-B", "build", "-G", "Ninja",
  "-DCMAKE_BUILD_TYPE=Debug", "-DCMAKE_TOOLCHAIN_FILE=cmake/arm-gcc-toolchain.cmake"];

let failed = 0;
for (const e of Examples.list()) {
  const t0 = Date.now();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blockbuild-"));
  fs.cpSync(TEMPLATE, tmp, { recursive: true, filter });
  fs.writeFileSync(path.join(tmp, "Core/Src/user_code.c"), Codegen.generate(Examples.load(e.id)));
  const r = spawnSync("cmake", CONFIGURE_ARGS, { cwd: tmp, env: ENV, shell: true });
  let b = null;
  let ok = r.status === 0;
  if (ok) {
    b = spawnSync("cmake", ["--build", "build"], { cwd: tmp, env: ENV, shell: true });
    ok = b.status === 0;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${ok ? "PASS" : "FAIL"}  ${e.id}  ${e.label}  (${secs}s)`);
  if (!ok) {
    failed++;
    [r, b].filter(Boolean).forEach((x) => {
      const s = ((x.stdout || "") + (x.stderr || "")).toString();
      console.log(s.split(/\r?\n/).slice(-25).join("\n"));
    });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed === 0 ? "\n3/3 通过" : `\n${failed} 个失败`);
process.exit(failed === 0 ? 0 : 1);
