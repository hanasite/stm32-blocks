FROM node:20-bookworm-slim

# 只需编译工具链：gcc-arm-none-eabi + newlib（stdio 等 C 库头在单独包里！）
# + cmake + ninja（烧录不在容器里做——编译产物 hex/bin 下载到电脑上用 CubeProgrammer 烧）
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc-arm-none-eabi libnewlib-arm-none-eabi cmake ninja-build \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY web/ web/
COPY tools/ tools/
COPY template/ template/

ENV HOST=0.0.0.0
ENV PORT=8899
EXPOSE 8899

CMD ["node", "tools/serve.js", "--no-open"]
