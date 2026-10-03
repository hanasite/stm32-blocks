#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const Examples = require("../web/js/examples.js");
const Codegen = require("../web/js/codegen.js");
const { copyTemplate, runBuild } = require("./lib/project-build.js");

let failed = 0;
const all = Examples.list();
for (const e of all) {
  const t0 = Date.now();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blockbuild-"));
  copyTemplate(tmp);
  fs.writeFileSync(path.join(tmp, "Core/Src/user_code.c"), Codegen.generate(Examples.load(e.id)));
  const r = runBuild(tmp);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${e.id}  ${e.label}  (${secs}s)`);
  if (!r.ok) {
    failed++;
    console.log(r.log.split(/\r?\n/).slice(-25).join("\n"));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed === 0 ? `\n${all.length}/${all.length} 通过` : `\n${failed} 个失败`);
process.exit(failed === 0 ? 0 : 1);
