# 本地编译服务（网页直连本机工具链）实施计划

> **For agentic workers:** 轻量计划（2026-10-03 深夜，招新现场模式）；单会话内联执行，逐项勾选。

**Goal:** 招新现场用本人/现场笔记本：双击一个 bat → 浏览器里拼积木 → 点「编译」「编译并烧录」直接调本机 CubeCLT 工具链，几秒后板子动；分发给其他人时仍走"下载 zip + VSCode F5（自配工具链）"原流程。

**Architecture:** 零依赖 Node 本地服务（127.0.0.1:8899）：
- 静态托管 `web/`（同源模式，绕开 file:// 的各种限制）
- `POST /api/build`：项目名+生成代码 → 全新副本模板 → cmake+ninja（**cwd=C:\ + 全绝对路径 + shell:false**，继承 cmake 非 ASCII cwd 崩溃与中文参数两坑的规避）→ 返回日志
- `POST /api/flash`：STM32_Programmer_CLI 烧录（`-w elf -v -rst` 后显式 `-run`）
- `GET /api/ping`：网页探测服务是否在线 → 在线才显示「编译」按钮组；离线自动隐藏，行为与现在完全一致
- 构建产物放 `<repo>/local-builds/<工程名>/`（git 忽略），可一键在资源管理器中打开（`/api/reveal`）

**Tech Stack:** Node 内置 http/child_process（无 npm 依赖）；前端沿用现有 UMD-lite 风格。

## Global Constraints

- `.bat` 文件内容必须纯 ASCII；node spawn 一律 shell:false + 绝对可执行文件路径
- file:// 纯离线流程不得回归（无服务时按钮隐藏、无 console 报错；_selftest 42/42 保持）
- 端口 8899，仅绑定 127.0.0.1；并发构建串行化
- CUBECLT 环境变量优先，默认 `D:\STM32CubeCLT_1.18.0`

---

### Task 1: 抽出共享构建核心 `tools/lib/project-build.js`

**Files:** Create `tools/lib/project-build.js`；Modify `tools/run-example-builds.js`

- [x] Step 1: 实现（cubecltEnv / copyTemplate / runBuild：cmake 绝对路径 + cwd=C:\ + shell:false；返回 {ok, log}）
- [x] Step 2: run-example-builds.js 改用共享核心 → `node tools/run-example-builds.js` 期望仍 3/3 通过 —— **实测 3/3（2.6/2.5/2.5s）**
- [x] Step 3: Commit

### Task 2: `tools/serve.js`（HTTP 服务）

**Files:** Create `tools/serve.js`；Modify `.gitignore`（+`local-builds/`）；Create `启动本地编译服务.bat`（纯 ASCII + chcp 65001）

- [x] Step 1: createBridge({port, open})：静态托管 + /api/ping（含 cubeclt/gcc 探测）+ /api/build + /api/flash + /api/reveal + OPTIONS 预检（CORS/私网头）
- [x] Step 2: CLI 入口（双击 bat 场景）：启动后自动开浏览器到 `http://127.0.0.1:8899/`
- [x] Step 3: Commit

### Task 3: 测试 `tests/serve.test.js`

- [x] Step 1: ping/静态页/404 路径穿越防护（`%2e%2e` 变体）
- [x] Step 2: build API 真编译（blink，中文工程名"测试-桥"；CubeCLT 缺失时 skip）—— **`node --test` 27/27 全绿（总耗时 3.3s）**
- [x] Step 3: Commit

### Task 4: 前端接入（探测 + 按钮 + 日志弹窗）

**Files:** Modify `web/index.html`、`web/css/style.css`、`web/js/app.js`（`_selftest.html` 同步镜像结构）

- [x] Step 1: header 加 `#bridge-status` 徽标 + `#btn-build`/`#btn-flash`（默认 hidden）+ `#log-dialog` 日志弹窗
- [x] Step 2: app.js 探测（1.5s 超时，失败静默隐藏）+ 编译/烧录流程（弹窗显示日志与耗时；校验报错时与下载按钮一起禁灰）；探针成功仅切换显隐、不回炉重渲染
- [x] Step 3: _selftest 双模式实测：
  - file:// 无服务：**42/42**，按钮保持 hidden ✓
  - http://127.0.0.1:8899/：**44/44**（新增 bridge-connected + bridge-compile-click：真点击→服务编译→"✅ 编译成功（2.9s）"）
  - file:// 有服务（跨源 PNA 探索）：**44/44** —— ACPN 头生效，双保险也能连上
- [x] Step 4: Commit

### Task 5: 实测与收尾

- [x] Step 1: 起服务 → curl ping（cubecltOk:true、gcc 13.3.1）→ 静态页 200 → 无头 Edge 确认徽标"本地工具链已连接"、两按钮可见可用
- [x] Step 2: 真板烧录实测：**未做（用户调试会话占着探针）**——/api/flash 与已验证的 flash.bat 走同一条 CLI 命令（-w -v -rst + -run），留用户点一次「编译并烧录」验收
- [x] Step 3: README 增补"两种使用方式"；执行记录回填；记忆更新；推送

## 验收标准

- [x] 双击 bat → 浏览器自动打开 → 徽标显示"本地工具链已连接"（serve.js 与 openBrowser 代码就位；未双击实测，首次交给用户）
- [x] 编译 ≤10 秒出结果——实测 2.9s；编译失败会在弹窗里显示 GCC 日志
- [ ] 编译并烧录 → 板子按积木动（**待用户一键实测**，探针当天被调试会话占用）
- [x] 不启动服务时 file:// 流程与现在完全一致（42/42；zip 下载照旧）
- [x] `node --test` 全绿（27/27，含 2 项 serve 测试）

## 执行记录（2026-10-03 深夜）

一次成型，仅两处实现期微调：① `runBuild` 里 Windows 用 cmake.exe 绝对路径 + `shell:false`（避免 cmd 对中文参数的 GBK 转码）；② 前端探针成功后不回炉 `quickRefresh()`，只切按钮显隐（避免干扰自检时序）。遗留一项：`/api/flash` 的真板实测留给用户（当时探针被 VSCode 调试会话占用）——双保险：flash 命令与 flash.bat 完全一致，且失败日志会带"未检测到 ST-Link"提示。
