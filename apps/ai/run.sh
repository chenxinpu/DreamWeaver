#!/usr/bin/env bash
# 织梦 Python AI 服务启动脚本：创建/复用 .venv 后监听 127.0.0.1:8789
# 用法：./run.sh            （可用 DW_AI_PORT / DW_AI_HOST / DW_INTERNAL_TOKEN / PYTHON 覆盖）
set -euo pipefail
cd "$(dirname "$0")"

PYTHON_BIN="${PYTHON:-python3}"
HOST="${DW_AI_HOST:-127.0.0.1}"
PORT="${DW_AI_PORT:-8789}"

if [ ! -d .venv ]; then
  echo "[ai] 创建虚拟环境 .venv（$PYTHON_BIN）"
  "$PYTHON_BIN" -m venv .venv
fi

if ! .venv/bin/python -c "import fastapi, uvicorn, pydantic" >/dev/null 2>&1; then
  echo "[ai] 安装依赖 requirements.txt"
  .venv/bin/pip install -q --upgrade pip
  .venv/bin/pip install -q -r requirements.txt
fi

echo "[ai] 启动 dreamweaver-ai → http://${HOST}:${PORT}（令牌头 X-Internal-Token）"
exec .venv/bin/python -m uvicorn app.main:app --host "$HOST" --port "$PORT" --log-level info
