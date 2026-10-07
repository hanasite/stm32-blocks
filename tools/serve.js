#!/usr/bin/env node
"use strict";
/* 本地编译服务：托管 web/ 并提供 /api/build、/api/flash 等接口。
   双击「启动本地编译服务.bat」使用；仅绑定 127.0.0.1。 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { ROOT, TEMPLATE, CUBECLT, EXE, HAS_CUBECLT, cubecltEnv, copyTemplate, runBuild, cmakePath, gccPath, programmerPath, canFlash } = require("./lib/project-build.js");

const WEB = path.join(ROOT, "web");
const LOCAL_BUILDS = path.join(ROOT, "local-builds");
const HOST = process.env.HOST || "127.0.0.1";   /* 容器里用 HOST=0.0.0.0 */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function safeName(name) {
  var s = String(name || "").replace(/[\\/:*?"<>|]/g, "_").trim();
  if (!s) { s = "我的工程"; }
  return s.slice(0, 40);
}

function trimLog(log) {
  const lines = String(log || "").split(/\r?\n/);
  return lines.length > 80 ? "[日志前部省略]\n" + lines.slice(-80).join("\n") : lines.join("\n");
}

let gccCache = null;
function gccVersion() {
  if (gccCache !== null) { return gccCache; }
  const r = spawnSync(gccPath(), ["--version"], { encoding: "utf8", shell: false });
  gccCache = r.status === 0 ? String(r.stdout).split("\n")[0] : "";
  return gccCache;
}

let toolsOkCache = null;
function toolsOk() {
  if (toolsOkCache === null) {
    toolsOkCache = spawnSync(cmakePath(), ["--version"], { encoding: "utf8", shell: false }).status === 0;
  }
  return toolsOkCache;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("请求体过大")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

function serveStatic(res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { res.writeHead(400); res.end(); return; }
  if (rel === "/") { rel = "/index.html"; }
  const abs = path.normalize(path.join(WEB, rel));
  if (abs !== WEB && !abs.startsWith(WEB + path.sep)) { res.writeHead(404); res.end("Not Found"); return; }
  fs.readFile(abs, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not Found"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(abs).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

function doBuild(name, code) {
  const t0 = Date.now();
  const dir = path.join(LOCAL_BUILDS, safeName(name));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  copyTemplate(dir);
  fs.writeFileSync(path.join(dir, "Core", "Src", "user_code.c"), code);
  const r = runBuild(dir);
  return { ok: r.ok, log: trimLog(r.log), dir, name: safeName(name), secs: +((Date.now() - t0) / 1000).toFixed(1) };
}

function doFlash(name) {
  const t0 = Date.now();
  const dir = path.join(LOCAL_BUILDS, safeName(name));
  const elf = path.join(dir, "build", "firmware.elf");
  const done = (ok, log) => ({ ok, log: trimLog(log), secs: +((Date.now() - t0) / 1000).toFixed(1) });
  if (!fs.existsSync(elf)) { return done(false, "没有找到编译产物：请先点「编译」，再点「编译并烧录」。"); }
  if (!canFlash()) { return done(false, "当前没有可用的烧录器（NAS/容器模式）：请在编译成功后下载 .hex / .bin 到电脑，用 STM32CubeProgrammer 烧录。"); }
  const cli = programmerPath();
  const env = cubecltEnv();
  const r1 = spawnSync(cli, ["-c", "port=SWD", "-w", elf, "-v", "-rst"], { cwd: "C:\\", env, encoding: "utf8", shell: false });
  let log = (r1.stdout || "") + (r1.stderr || "");
  let ok = r1.status === 0;
  if (ok) {
    const r2 = spawnSync(cli, ["-c", "port=SWD", "-run"], { cwd: "C:\\", env, encoding: "utf8", shell: false });
    log += (r2.stdout || "") + (r2.stderr || "");
    ok = r2.status === 0;
  }
  if (!ok && /no st-?link|not connected|no device|error/i.test(log)) {
    log += "\n（提示：若未检测到 ST-Link，检查 USB 是否插好、是否被其它调试会话占用）";
  }
  return done(ok, log);
}

function doReveal(name) {
  const dir = path.join(LOCAL_BUILDS, safeName(name));
  if (!fs.existsSync(dir)) { return { ok: false, log: "还没有编译过这个工程。" }; }
  if (process.platform === "win32") {
    spawn("explorer", [dir], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [dir], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [dir], { detached: true, stdio: "ignore" }).unref();
  }
  return { ok: true, dir };
}

function createBridge(opts) {
  opts = opts || {};
  let busy = Promise.resolve();

  function handle(req, res) {
    let u;
    try { u = new URL(req.url, "http://127.0.0.1"); } catch (e) { res.writeHead(400); res.end(); return; }
    const p = u.pathname;

    if (!p.startsWith("/api/")) { serveStatic(res, p); return; }
    cors(req, res);
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    if (p === "/api/ping" && req.method === "GET") {
      json(res, 200, {
        ok: true,
        node: process.version,
        cubeclt: HAS_CUBECLT ? CUBECLT : "(系统工具链)",
        cubecltOk: toolsOk(),
        canFlash: canFlash(),
        templateOk: fs.existsSync(path.join(TEMPLATE, "Core", "Src", "user_code.c")),
        gcc: gccVersion(),
      });
      return;
    }

    if (p === "/api/download" && req.method === "GET") {
      const nm = safeName(u.searchParams.get("name") || "");
      const ext = (u.searchParams.get("ext") || "hex").toLowerCase();
      if (["hex", "bin", "elf"].indexOf(ext) < 0) { json(res, 400, { ok: false, log: "ext 只支持 hex / bin / elf" }); return; }
      const file = path.join(LOCAL_BUILDS, nm, "build", "firmware." + ext);
      if (!fs.existsSync(file)) { json(res, 404, { ok: false, log: "还没有这个产物：先在页面上「编译」一次" }); return; }
      const dlName = encodeURIComponent(nm + "." + ext);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename=\"" + dlName + "\"; filename*=UTF-8''" + dlName,
      });
      fs.createReadStream(file).pipe(res);
      return;
    }

    if (req.method === "POST" && (p === "/api/build" || p === "/api/flash" || p === "/api/reveal")) {
      readBody(req, 4 * 1024 * 1024).then((raw) => {
        let body = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch (e) { json(res, 400, { ok: false, log: "请求体不是合法 JSON" }); return; }
        const job = busy.then(() => {
          if (p === "/api/build") {
            if (typeof body.code !== "string" || body.code.length === 0) { return { ok: false, log: "缺少 code 字段" }; }
            return doBuild(body.name, body.code);
          }
          if (p === "/api/flash") { return doFlash(body.name); }
          return doReveal(body.name);
        });
        busy = job.then(() => {}, () => {});
        job.then((r) => json(res, 200, r)).catch((e) => json(res, 500, { ok: false, log: String((e && e.message) || e) }));
      }).catch((e) => json(res, 413, { ok: false, log: String(e.message || e) }));
      return;
    }

    json(res, 404, { ok: false, log: "未知接口" });
  }

  const server = http.createServer(handle);
  const ready = new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port || 0, opts.host || HOST, resolve);
  });
  return {
    server,
    ready,
    get port() { return server.address().port; },
    close() {
      if (server.closeAllConnections) { server.closeAllConnections(); }
      return new Promise((r) => server.close(() => r()));
    },
  };
}

function openBrowser(url) {
  try {
    let c = null;
    if (process.platform === "win32") { c = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }); }
    else if (process.platform === "darwin") { c = spawn("open", [url], { detached: true, stdio: "ignore" }); }
    else { c = spawn("xdg-open", [url], { detached: true, stdio: "ignore" }); }
    if (c) {
      c.on("error", function () { /* 无桌面环境（容器）时忽略 */ });
      c.unref();
    }
  } catch (e) { /* 打不开浏览器不致命 */ }
}

module.exports = { createBridge };

if (require.main === module) {
  const port = Number(process.env.PORT || 8899);
  const srv = createBridge({ port });
  srv.ready.then(() => {
    const shown = (HOST === "0.0.0.0" || HOST === "::") ? "127.0.0.1" : HOST;
    const url = "http://" + shown + ":" + srv.port + "/";
    console.log("本地编译服务已启动: " + url + (HOST === "0.0.0.0" ? "  (监听 0.0.0.0:" + srv.port + ")" : ""));
    console.log("工具链: " + (HAS_CUBECLT ? CUBECLT : "系统 PATH（cmake / arm-none-eabi-gcc）"));
    console.log("按 Ctrl+C 退出。");
    if (process.argv.indexOf("--no-open") < 0) { openBrowser(url); }
  }).catch((e) => {
    if (e && e.code === "EADDRINUSE") {
      console.error("端口 " + port + " 已被占用——可能已经开着一个服务窗口了，直接去浏览器用即可。");
    } else {
      console.error("启动失败: " + ((e && e.message) || e));
    }
    process.exit(1);
  });
}
