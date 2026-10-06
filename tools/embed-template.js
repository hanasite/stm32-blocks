#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const JSZip = require("../web/vendor/jszip.min.js");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATE_DIR = path.join(ROOT, "template");
const OUT_FILE = path.join(ROOT, "web/js/template-data.js");
const EXCLUDE_DIRS = new Set(["build", ".git", ".vscode-server"]);

function walk(dir, base, out) {
  fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((ent) => {
      if (EXCLUDE_DIRS.has(ent.name)) { return; }
      const abs = path.join(dir, ent.name);
      const rel = base ? base + "/" + ent.name : ent.name;
      if (ent.isDirectory()) { walk(abs, rel, out); }
      else { out.push({ rel, abs }); }
    });
}

async function main() {
  const files = [];
  walk(TEMPLATE_DIR, "", files);
  if (!files.some((f) => f.rel.endsWith("Core/Src/user_code.c"))) {
    console.error("模板里没找到 Core/Src/user_code.c，先完成 M1 计划");
    process.exit(1);
  }
  const zip = new JSZip();
  for (const f of files) { zip.file("template/" + f.rel, fs.readFileSync(f.abs)); }
  const b64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 9 } });
  fs.writeFileSync(OUT_FILE,
    "/* 由 tools/embed-template.js 生成，勿手改 */\nwindow.TEMPLATE_ZIP = \"" + b64 + "\";\n");
  console.log(`内嵌 ${files.length} 个文件，template-data.js 大小 ${(fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2)} MB`);
}

main();
