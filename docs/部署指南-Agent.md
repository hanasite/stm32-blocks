# 部署指南（AI Agent 版）

> 给负责"把这套工具在目标机器上跑起来 / 保持可运行"的 AI 助手（Claude Code、Codex 等）。
> 人类请读 [部署指南.md](部署指南.md)。
> 工作方式：**先检测 → 再安装 → 后验证**；每步给出成功判据；不要跳步猜测。

## 0. 这套东西是什么

零构建静态网页（`web/`）+ 可选本地服务（`tools/serve.js`，Node 纯内置模块，**无 npm 依赖**）
+ 嵌入式模板工程（`template/`，CMake + Ninja + arm-none-eabi-gcc + HAL）。

三种部署形态：

| 形态 | 需要什么 | 交付判据 |
|---|---|---|
| A 直连（主推） | Node ≥18 + STM32CubeCLT | 双击 `启动本地编译服务.bat` → 页面出现「本地工具链已连接」→ 能编译能烧录 |
| B 分发 | STM32CubeCLT + VSCode + cortex-debug | 下载 zip → 解压 → F5 → 板子动 |
| C 便携 U 盘 | 无（自带 env\） | 双击 `启动本地编译服务-便携.bat` 直接可用 |
| D Docker/NAS | Docker（Linux） | `docker compose up -d --build` → `curl http://<ip>:8899/api/ping` 中 `cubecltOk:true` 且 `canFlash:false`；编译产物经 `/api/download?name=<工程名>&ext=hex|bin|elf` 下载到电脑烧录 |

## 1. 环境检测（幂等，先全跑一遍）

```bash
node --version        # 期望 v18+（本项目开发机为 v24.x）
# CubeCLT 默认路径（或换成 $CUBECLT 指向的位置）：
ls "D:/STM32CubeCLT_1.18.0/CMake/bin/cmake.exe"
ls "D:/STM32CubeCLT_1.18.0/GNU-tools-for-STM32/bin/arm-none-eabi-gcc.exe"
ls "D:/STM32CubeCLT_1.18.0/STM32CubeProgrammer/bin/STM32_Programmer_CLI.exe"
ls "D:/STM32CubeCLT_1.18.0/STLink-gdb-server/bin/ST-LINK_gdbserver.exe"
```

## 2. 安装缺失项

### STM32CubeCLT（约 2.3GB，三选一）

1. **FubeMX（波特律动，国内推荐）**：<https://fubemx.keysking.com> —— 可下载 STM32CubeMX / **STM32CubeCLT**，装默认路径 `D:\STM32CubeCLT_1.18.0`
2. ST 官网：搜 "STM32CubeCLT" → Windows 64-bit 安装包（需 ST 账号）
3. 已有机器的整目录拷贝（`CUBECLT` 环境变量指向它即可，目录可重定位）

### Node.js

官方 LTS 安装包，或从便携 U 盘 `env\node` 拷贝（node.exe 单文件即可运行 `tools/serve.js`）。

### VSCode 侧（仅形态 B）

装 VSCode 扩展 `marus25.cortex-debug`；模板里 `.vscode/` 路径写死 `D:\STM32CubeCLT_1.18.0`——装别处需同步改 `template/.vscode/{launch.json,c_cpp_properties.json,settings.json}` 和仓库根的 `.vscode/`。

## 3. 验证门（必须全过，缺一不可）

```bash
node --test                        # 单元测试：期望 42/42
node tools/run-example-builds.js   # 六个示例真编译：期望 6/6（每例 ~3s）
# 本地服务 E2E：
node tools/serve.js --no-open &     # 或 PORT=xxxx 换端口
curl -s http://127.0.0.1:8899/api/ping   # 期望 ok:true 且 cubecltOk:true
# UI 无头自检（Windows + Edge）：
# msedge --headless=new --window-size=1600,900 --virtual-time-budget=20000
#   --dump-dom file:///<仓库绝对路径>/web/_selftest.html
# 结果在 <pre id="selftest-results">，离线期望 57/57
```

烧录验证（形态 A，需插着 ST-Link）：页面「⚡ 编译并烧录」或在 `local-builds/<工程名>/` 上跑 `STM32_Programmer_CLI -c port=SWD -w build/firmware.elf -v -rst` + 再来一次 `-c port=SWD -run`（**必须有第二个 -run**，否则内核停着不跑）。

## 4. 制作/更新便携 U 盘（形态 C）

```bash
node tools/make-portable.js <目标目录> [--refresh-clt] [--skip-clt]
```

自动做：镜像同步仓库（逐顶层条目 rm+copy）→ 下载便携 Node（npmmirror 优先，跟随当前 Node 版本）→ 从 `$CUBECLT`/默认路径拷 CubeCLT（已存在则跳过）→ 生成便携启动器与说明。重复运行为幂等增量。

## 5. 已知坑（全部是真踩出来的，改代码前必读）

1. **`fs.cpSync(srcRoot, target, {filter})` 且 target 预先存在时，Node 24 在 Windows 上会原生崩溃（exit 127、零报错）**——打包脚本必须用"逐顶层条目 rm+copy"，不要用 filter 版本。
2. **`.bat` 文件必须纯 ASCII**：中文会让 GBK 的 cmd 把 bat 解析崩坏。
3. **cmake 3.28 在非 ASCII 工作目录下 configure 崩溃（0xC0000409）**：所有构建入口固定 `cwd=C:\` + 全绝对路径（`build.bat`、`tools/lib/project-build.js` 已处理，勿改）。
4. **node spawn 给 gcc/cmake 传中文参数必须 `shell:false`**（走 cmd 会按 GBK 转码毁掉参数）。
5. **改完 `template/` 必须重跑 `node tools/embed-template.js`**，否则网页内嵌的模板还是旧的（zip/编译都拿旧驱动）。
6. **克隆版 ST-Link**：烧录可用；gdbserver（F5 调试）要求固件 V2J48+，否则拒服务。
7. **烧录后不加 `-run`**：CubeProgrammer 会把内核留在 halt 状态，表现为"烧完板子不动"。
8. `启动本地编译服务.bat` 用系统 Node；没装 Node 的机器用 `启动本地编译服务-便携.bat`（走 `env\node`）。
9. Windows 控制台跑 node 看中文日志需要 `chcp 65001`（bat 已带）；git-bash 里调用 `msedge` 必须全路径。

## 6. 禁止事项

- 不要引入 npm 依赖（`node --test`/原生模块是刻意设计；vendor 里只有 JSZip）
- 不要修改 `tests/codegen.test.js` 的 golden 期望值，除非有意变更生成格式并**同步**设计文档 §5.3 与各示例断言
- 不要删除 `local-builds/`（它是编译产物目录，已被 gitignore；删了只是丢缓存）
- 仓库根 `CMakeLists` 不存在是正常的——构建发生在 `template/` 或 `local-builds/<工程名>/` 副本里
