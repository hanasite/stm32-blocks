"use strict";
/* 共享构建核心：把 template/ 副本编成 firmware.elf。

Windows 两坑规避（与 build.bat 同源）：
- cmake 3.28 在非 ASCII 工作目录下 configure 崩溃 -> 固定 cwd=C:\，全绝对路径
- node spawn shell:true 走 cmd 会按 GBK 转码参数 -> 一律 shell:false（UTF-16 直传）
*/

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const TEMPLATE = path.join(ROOT, "template");
const CUBECLT = process.env.CUBECLT || "D:\\STM32CubeCLT_1.18.0";
const SAFE_CWD = process.platform === "win32" ? "C:\\" : "/";
const EXE = process.platform === "win32" ? ".exe" : "";

/* 工具链两种形态：
   - CubeCLT 模式（Windows 开发机）：CUBECLT 目录下齐活
   - 系统工具链模式（Linux 容器 / NAS）：cmake / ninja / arm-none-eabi-gcc 直接走 PATH */
const CUBECLT_CMAKE = path.join(CUBECLT, "CMake", "bin", "cmake" + EXE);
const HAS_CUBECLT = fs.existsSync(CUBECLT_CMAKE);

function cmakePath() { return HAS_CUBECLT ? CUBECLT_CMAKE : "cmake" + EXE; }
function gccPath() { return HAS_CUBECLT ? path.join(CUBECLT, "GNU-tools-for-STM32", "bin", "arm-none-eabi-gcc" + EXE) : "arm-none-eabi-gcc" + EXE; }
function programmerPath() { return path.join(CUBECLT, "STM32CubeProgrammer", "bin", "STM32_Programmer_CLI" + EXE); }
function stflashPath() { return "st-flash" + EXE; }   /* Linux（树莓派等）：stlink-tools 包 */
let stflashOkCache = null;
function hasStflash() {
  if (stflashOkCache === null) {
    stflashOkCache = spawnSync(stflashPath(), ["--version"], { encoding: "utf8", shell: false }).status === 0;
  }
  return stflashOkCache;
}
function canFlash() { return fs.existsSync(programmerPath()) || hasStflash(); }

const EXCLUDES = ["build", ".git", ".vscode-server"].map((d) => path.join(TEMPLATE, d));
function templateFilter(src) {
  return !EXCLUDES.some((ex) => src === ex || src.startsWith(ex + path.sep));
}

function cubecltEnv() {
  const env = Object.assign({}, process.env);
  if (HAS_CUBECLT) {
    env.CUBECLT = CUBECLT;
    env.PATH = [
      path.join(CUBECLT, "CMake", "bin"),
      path.join(CUBECLT, "Ninja"),
      path.join(CUBECLT, "GNU-tools-for-STM32", "bin"),
      path.join(CUBECLT, "STM32CubeProgrammer", "bin"),
      process.env.PATH,
    ].join(path.delimiter);
  }
  return env;
}

function copyTemplate(dest) {
  fs.cpSync(TEMPLATE, dest, { recursive: true, filter: templateFilter });
}

function runBuild(projectDir) {
  const env = cubecltEnv();
  const cmake = cmakePath();
  const buildDir = path.join(projectDir, "build");
  const r1 = spawnSync(cmake, ["-S", projectDir, "-B", buildDir, "-G", "Ninja",
    "-DCMAKE_BUILD_TYPE=Debug",
    "-DCMAKE_TOOLCHAIN_FILE=" + path.join(projectDir, "cmake", "arm-gcc-toolchain.cmake")],
    { cwd: SAFE_CWD, env, encoding: "utf8", shell: false });
  let log = (r1.stdout || "") + (r1.stderr || "");
  if (r1.status !== 0) { return { ok: false, log, stage: "configure" }; }
  const r2 = spawnSync(cmake, ["--build", buildDir], { cwd: SAFE_CWD, env, encoding: "utf8", shell: false });
  log += (r2.stdout || "") + (r2.stderr || "");
  return { ok: r2.status === 0, log, stage: "build" };
}

module.exports = { ROOT, TEMPLATE, CUBECLT, EXE, HAS_CUBECLT, cubecltEnv, copyTemplate, runBuild, cmakePath, gccPath, programmerPath, stflashPath, canFlash };
