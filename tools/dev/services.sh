#!/usr/bin/env bash
# 织梦 DreamWeaver · 本地开发编排
#
#   ./tools/dev/services.sh start    启动 Java 后端（+ 可选前端）
#   ./tools/dev/services.sh stop     停止全部
#   ./tools/dev/services.sh status   查看状态（含聚合健康）
#   ./tools/dev/services.sh restart  重启
#
# 架构：MySQL(3306) + Java 后端 apps/backend（8787，REST + BFF + WebSocket）+ Python AI apps/ai（8789）+ 前端 5173
set -uo pipefail

DW_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="$DW_ROOT/.tools/logs"
PID_DIR="$DW_ROOT/.tools/run"
mkdir -p "$LOG_DIR" "$PID_DIR"

BACKEND_PORT="${PORT:-8787}"
AI_PORT="${DW_AI_PORT:-8789}"
WITH_FRONTEND="${WITH_FRONTEND:-0}"

c_reset='\033[0m'; c_dim='\033[2m'; c_grn='\033[32m'; c_red='\033[31m'; c_ylw='\033[33m'; c_cyn='\033[36m'

log()  { printf "${c_cyn}▸${c_reset} %s\n" "$*"; }
ok()   { printf "${c_grn}✓${c_reset} %s\n" "$*"; }
warn() { printf "${c_ylw}!${c_reset} %s\n" "$*"; }
err()  { printf "${c_red}✗${c_reset} %s\n" "$*"; }

wait_http() { # url name timeout_s
  local url="$1" name="$2" limit="${3:-90}" i=0
  while [ "$i" -lt "$limit" ]; do
    if curl -fsS -m 3 -o /dev/null "$url" 2>/dev/null; then ok "${name} 就绪（${url}）"; return 0; fi
    sleep 1; i=$((i + 1))
  done
  err "${name} 在 ${limit}s 内未就绪（${url}）—— 日志：${LOG_DIR}/${name}.log"
  return 1
}

port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

start_mysql() {
  log "启动 MySQL（3306，数据目录 .tools/mysql/）"
  "$DW_ROOT/tools/dev/mysql.sh" start
}

start_backend() {
  if port_busy "$BACKEND_PORT"; then warn "端口 ${BACKEND_PORT} 已被占用，跳过 Java 后端"; return 1; fi
  log "启动 Java 后端（apps/backend：REST + BFF 聚合 + WebSocket，端口 ${BACKEND_PORT}）"
  ( . "$DW_ROOT/tools/dev/java-env.sh"
    cd "$DW_ROOT/apps/backend"
    PORT="$BACKEND_PORT" nohup ./mvnw -B -q -DskipTests spring-boot:run > "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$PID_DIR/backend.pid" )
  wait_http "http://127.0.0.1:${BACKEND_PORT}/api/health" "backend" 180
}

start_ai() {
  if port_busy "$AI_PORT"; then warn "端口 ${AI_PORT} 已被占用，跳过 Python AI"; return 0; fi
  log "启动 Python AI 服务（apps/ai，端口 ${AI_PORT}）"
  ( cd "$DW_ROOT/apps/ai"
    nohup ./run.sh > "$LOG_DIR/ai.log" 2>&1 &
    echo $! > "$PID_DIR/ai.pid" )
  wait_http "http://127.0.0.1:${AI_PORT}/health" "ai" 180
}

start_frontend() {
  if port_busy 5173; then warn "端口 5173 已被占用，跳过前端"; return 0; fi
  log "启动前端（apps/frontend，端口 5173）"
  ( cd "$DW_ROOT/apps/frontend"
    [ -d node_modules ] || npm install
    nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
    echo $! > "$PID_DIR/frontend.pid" )
  wait_http "http://localhost:5173/" "frontend" 60
}

stop_pid() { # pidfile name
  local f="$1" name="$2"
  if [ -f "$f" ]; then
    local pid; pid="$(cat "$f")"
    if kill -0 "$pid" 2>/dev/null; then
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      ok "${name} 已停止（pid ${pid}）"
    fi
    rm -f "$f"
  fi
}

# 判定某 pid 是否属于本工程：其工作目录位于仓库内（lsof 读取 cwd，无需 ps 权限）
pid_in_workspace() { # pid
  local cwd
  cwd="$(lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
  case "$cwd" in "$DW_ROOT"/*) return 0 ;; *) return 1 ;; esac
}

stop_all() {
  for name in frontend ai backend; do
    stop_pid "$PID_DIR/$name.pid" "$name"
  done
  # 兜底：清理监听本工程端口、且工作目录在仓库内的进程（不处理 5173，避免误杀其它工程）
  for p in "$BACKEND_PORT" "$AI_PORT"; do
    local pid
    pid="$(lsof -nP -iTCP:"$p" -sTCP:LISTEN -t 2>/dev/null | head -1)"
    [ -n "$pid" ] || continue
    if pid_in_workspace "$pid"; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      ok "端口 ${p} 上的本工程进程已停止（pid ${pid}）"
    else
      warn "端口 ${p} 被非本工程进程占用（pid ${pid}），未处理"
    fi
  done
}

status() {
  echo "── 服务状态 ──────────────────────────────────────────"
  if "$DW_ROOT/tools/dev/mysql.sh" status >/dev/null 2>&1; then
    printf "  ${c_grn}●${c_reset} %-10s :%-5s %s\n" "MySQL" "3306" "$(lsof -nP -iTCP:3306 -sTCP:LISTEN -t 2>/dev/null | head -1 | sed 's/^/pid=/')"
  else
    printf "  ${c_dim}○${c_reset} %-10s :%-5s ${c_dim}未运行${c_reset}\n" "MySQL" "3306"
  fi
  for pair in "Java后端/${BACKEND_PORT}" "PythonAI/${AI_PORT}" "前端/5173"; do
    local name="${pair%/*}" port="${pair#*/}" pid
    pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1)"
    if [ -n "$pid" ]; then printf "  ${c_grn}●${c_reset} %-10s :%-5s pid=%s\n" "$name" "$port" "$pid"
    else printf "  ${c_dim}○${c_reset} %-10s :%-5s ${c_dim}未运行${c_reset}\n" "$name" "$port"; fi
  done
  echo "── 聚合健康（GET http://127.0.0.1:${BACKEND_PORT}/api/health）──"
  curl -fsS -m 5 "http://127.0.0.1:${BACKEND_PORT}/api/health" 2>/dev/null \
    | python3 -c '
import sys, json
d = json.load(sys.stdin)["data"]
for s in d.get("services", []):
    mark = "  ok  " if s["ok"] else "  fail"
    print(mark, s["name"].ljust(8), s["url"].ljust(24), str(s["latencyMs"]) + "ms")
print("  entities:", json.dumps(d.get("entities"), ensure_ascii=False))
' || warn "后端未运行或不可达"
}

case "${1:-start}" in
  start)
    start_mysql; start_backend; start_ai
    [ "$WITH_FRONTEND" = "1" ] && start_frontend
    echo; status ;;
  stop)    stop_all ;;
  restart) stop_all; sleep 2; start_mysql; start_backend; start_ai ;;
  status)  status ;;
  *) echo "用法：$0 {start|stop|restart|status}（WITH_FRONTEND=1 一并启动前端）"; exit 1 ;;
esac
