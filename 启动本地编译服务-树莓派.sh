#!/usr/bin/env bash
# 树莓派 / Linux 启动脚本
# 依赖（一次性）：sudo apt install nodejs cmake ninja-build gcc-arm-none-eabi libnewlib-arm-none-eabi
# HOST=0.0.0.0 让局域网里的手机/电脑也能打开页面
cd "$(dirname "$0")" || exit 1
export HOST=0.0.0.0
export PORT="${PORT:-8899}"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 没找到 node，先装：sudo apt install nodejs cmake ninja-build gcc-arm-none-eabi libnewlib-arm-none-eabi"
  exit 1
fi

echo "=============================================="
echo " STM32 积木工坊 · 树莓派服务"
echo " 本机访问:   http://127.0.0.1:${PORT}/"
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -n "$IP" ] && echo " 局域网访问: http://${IP}:${PORT}/   （手机/电脑同一 WiFi 打开）"
echo " 停止服务:   Ctrl+C"
echo "=============================================="
exec node tools/serve.js --no-open
