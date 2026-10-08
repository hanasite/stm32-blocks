#!/usr/bin/env bash
# 树莓派桌面版·一键启动：后台起服务（已在跑就跳过）+ 弹出浏览器打开工具页面
# 用法：双击本文件，或在终端跑  bash 一键启动-树莓派.sh
cd "$(dirname "$0")" || exit 1
export HOST=0.0.0.0
export PORT="${PORT:-8899}"
URL="http://127.0.0.1:${PORT}/"

if pgrep -f 'node tools/serv[e]' >/dev/null; then
  echo "服务已在运行：$URL"
else
  if ! command -v node >/dev/null 2>&1; then
    echo "[错误] 没找到 node。先装依赖："
    echo "  sudo apt install --no-install-recommends nodejs cmake ninja-build gcc-arm-none-eabi libnewlib-arm-none-eabi"
    echo "  （要在树莓派上直接烧录再加：sudo apt install stlink-tools）"
    exit 1
  fi
  nohup node tools/serve.js --no-open < /dev/null > /tmp/stm32-serve.log 2>&1 &
  sleep 2
  echo "服务已后台启动（日志：/tmp/stm32-serve.log）"
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  chromium "$URL" >/dev/null 2>&1 &
elif command -v firefox >/dev/null 2>&1; then
  firefox "$URL" >/dev/null 2>&1 &
else
  echo "没找到浏览器，请手动打开：$URL"
fi

echo "已打开工具页面：$URL"
echo "（停服务：pkill -f 'node tools/serve'）"
