#!/usr/bin/env node
"use strict";
/* 制作「便携 U 盘版」：把本仓库 + Node + STM32CubeCLT 打包到目标目录。
   用法: node tools/make-portable.js <目标目录> [--refresh-clt] [--skip-clt]
   说明: 目标已存在的内容增量刷新；env\node 与 env\STM32CubeCLT 存在时自动跳过。
   设计: 全程纯 Node 单线程（U 盘上并发/多线程反而慢——寻道风暴）。 */

const fs = require("fs");
const path = require("path");
const JSZip = require(path.join(__dirname, "..", "web", "vendor", "jszip.min.js"));

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const targetArg = argv.find((a) => !a.startsWith("--"));
if (!targetArg) {
  console.error("用法: node tools/make-portable.js <目标目录> [--refresh-clt] [--skip-clt]");
  process.exit(1);
}
const TARGET = path.resolve(targetArg);
if (TARGET === ROOT || TARGET.startsWith(ROOT + path.sep)) {
  console.error("目标目录不能在源仓库内部");
  process.exit(1);
}

const EXCLUDE = new Set(["local-builds", "build", ".vscode-server", "env", "node_modules"]);

function copyRepo() {
  /* 逐顶层条目镜像：先删目标旧项再整体拷贝。
     注意：不要用 cpSync(srcRoot, target, {filter}) —— 目标目录预先存在时
     Node 24 在 Windows 上会原生崩溃（exit 127，无任何报错），这是实测过的坑。 */
  fs.mkdirSync(TARGET, { recursive: true });
  const entries = fs.readdirSync(ROOT).filter((e) => !EXCLUDE.has(e));
  for (const ent of entries) {
    const dst = path.join(TARGET, ent);
    fs.rmSync(dst, { recursive: true, force: true });
    fs.cpSync(path.join(ROOT, ent), dst, { recursive: true, force: true });
  }
  console.log("[1/5] 仓库已同步到 " + TARGET + "（" + entries.length + " 个顶层条目）");
}

async function ensureNode() {
  const ver = process.version;                     // 跟随打包机上的 Node 版本
  const nodeExe = path.join(TARGET, "env", "node", "node.exe");
  if (fs.existsSync(nodeExe)) {
    console.log("[2/5] 便携 Node 已存在，跳过（" + ver + "）");
    return;
  }
  const urls = [
    "https://registry.npmmirror.com/-/binary/node/" + ver + "/node-" + ver + "-win-x64.zip",
    "https://nodejs.org/dist/" + ver + "/node-" + ver + "-win-x64.zip",
  ];
  console.log("[2/5] 下载便携 Node " + ver + " ...");
  let buf = null;
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) { throw new Error("HTTP " + r.status); }
      buf = Buffer.from(await r.arrayBuffer());
      console.log("      来自 " + u);
      break;
    } catch (e) {
      console.warn("      失败: " + u + " (" + e.message + ")");
    }
  }
  if (!buf) {
    throw new Error("下载失败。可手动下载 node-" + ver + "-win-x64.zip 并解压到 " + path.join(TARGET, "env", "node"));
  }
  const zip = await JSZip.loadAsync(buf);
  const prefix = "node-" + ver + "-win-x64/";
  const rootDir = path.join(TARGET, "env", "node");
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith(prefix)) { continue; }
    const rel = name.slice(prefix.length);
    if (!rel) { continue; }
    const dest = path.join(rootDir, rel);
    if (zip.files[name].dir) { fs.mkdirSync(dest, { recursive: true }); continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, await zip.files[name].async("uint8array"));
  }
  console.log("      解压完成");
}

function ensureClt() {
  const dest = path.join(TARGET, "env", "STM32CubeCLT");
  if (fs.existsSync(path.join(dest, "CMake", "bin", "cmake.exe")) && !flags.has("--refresh-clt")) {
    console.log("[3/5] CubeCLT 已存在，跳过（--refresh-clt 可强制重拷）");
    return;
  }
  if (flags.has("--skip-clt")) {
    console.log("[3/5] --skip-clt：跳过 CubeCLT");
    return;
  }
  const src = process.env.CUBECLT || "D:\\STM32CubeCLT_1.18.0";
  if (!fs.existsSync(path.join(src, "CMake", "bin", "cmake.exe"))) {
    throw new Error("找不到 CubeCLT 源目录: " + src + "\n  请装好 CubeCLT（默认 D:\\STM32CubeCLT_1.18.0）、或用 CUBECLT 环境变量指过去、或加 --skip-clt");
  }
  console.log("[3/5] 拷贝 CubeCLT（约 2.3GB，U 盘上要几分钟，慢是正常的）...");
  if (flags.has("--refresh-clt")) { fs.rmSync(dest, { recursive: true, force: true }); }
  fs.cpSync(src, dest, { recursive: true });
  console.log("      CubeCLT 拷贝完成");
}

function writeLauncher() {
  const bat = [
    "@echo off",
    "chcp 65001 >nul",
    "cd /d %~dp0",
    'set "CUBECLT=%~dp0env\\STM32CubeCLT"',
    'set "PATH=%~dp0env\\node;%CUBECLT%\\CMake\\bin;%CUBECLT%\\Ninja;%CUBECLT%\\GNU-tools-for-STM32\\bin;%CUBECLT%\\STM32CubeProgrammer\\bin;%PATH%"',
    'if not exist "%~dp0env\\node\\node.exe" (',
    "  echo [ERROR] env\\node\\node.exe not found - USB copy incomplete.",
    "  pause",
    "  exit /b 1",
    ")",
    'if not exist "%CUBECLT%\\CMake\\bin\\cmake.exe" (',
    "  echo [ERROR] env\\STM32CubeCLT not found - USB copy incomplete.",
    "  pause",
    "  exit /b 1",
    ")",
    '"%~dp0env\\node\\node.exe" "%~dp0tools\\serve.js"',
    "pause",
    "",
  ].join("\r\n");
  fs.writeFileSync(path.join(TARGET, "启动本地编译服务-便携.bat"), bat);
  console.log("[4/5] 便携启动器已生成");
}

function writeReadme() {
  const cltVer = path.basename(process.env.CUBECLT || "D:\\STM32CubeCLT_1.18.0");
  const md = `# STM32 积木工坊 · 便携版（U 盘）

这份拷贝可以直接插到任何 Windows 电脑上用，**不需要安装** Node 和 STM32CubeCLT——依赖都在 \`env\\\` 里（绿色打包，类似容器化）：

## 怎么用

1. 双击 **\`启动本地编译服务-便携.bat\`** → 浏览器自动打开工具页面
2. 拼积木 → 「🔨 编译」/「⚡ 编译并烧录」（烧录需要插 ST-Link）
3. 插到别的电脑盘符变了（H: 变 E: 之类）也不用改任何东西——启动器全部用相对路径

## 结构

- \`web/ tools/ template/ tests/ docs/\` —— 项目本体（快照，由 \`tools/make-portable.js\` 生成）
- \`env\\node\\\` —— 便携版 Node.js ${process.version}（官方 zip 版）
- \`env\\STM32CubeCLT\\\` —— ${cltVer}（arm-none-eabi-gcc / CMake / Ninja / CubeProgrammer / ST-LINK_gdbserver）
- \`启动本地编译服务.bat\` —— 旧版启动器（用系统安装的 Node）
- \`启动本地编译服务-便携.bat\` —— **推荐**，全部走 \`env\\\`

## 更新这份 U 盘

在开发机仓库里运行（会增量刷新，已有的 Node/CubeCLT 自动跳过）：

\`\`\`
node tools/make-portable.js <U盘目标目录>
\`\`\`

或双击仓库根目录的 \`制作便携U盘.bat\`。

## 注意

- **ST-Link 驱动**是系统级的，便携版带不了：目标电脑第一次用 ST-Link 时 Windows 一般会自动装驱动。
- 克隆版 ST-Link 想用调试（VSCode F5）需要较新固件（V2J48+）；只**烧录**一般不受影响。
- 想用「下载 zip → VSCode F5」模式：模板 \`.vscode\` 配置里写死了 \`D:\\STM32CubeCLT_1.18.0\`，要么装同路径，要么改路径。
- 开发源头在仓库（GitHub: hanasite/stm32-blocks）；大改动后重新跑一次打包脚本即可。
`;
  fs.writeFileSync(path.join(TARGET, "便携版说明.md"), md);
  console.log("[4/5] 便携版说明已生成");
}

function patchGitignore() {
  const p = path.join(TARGET, ".gitignore");
  const cur = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  if (!/^env\/\s*$/m.test(cur)) {
    fs.writeFileSync(p, cur + (cur.endsWith("\n") ? "" : "\n") + "env/\n");
  }
}

(async () => {
  copyRepo();
  await ensureNode();
  ensureClt();
  writeLauncher();
  writeReadme();
  patchGitignore();
  console.log("[5/5] 完成 → " + TARGET);
  console.log("  使用：插到目标电脑，双击「启动本地编译服务-便携.bat」");
})().catch((e) => {
  console.error("打包失败: " + e.message);
  process.exit(1);
});
