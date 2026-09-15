#!/usr/bin/env bash
# 织梦 DreamWeaver · 本地 MySQL 管理
#
#   ./tools/dev/mysql.sh start     启动 MySQL（数据目录在工作区 .tools/mysql/，不污染系统）
#   ./tools/dev/mysql.sh stop      停止
#   ./tools/dev/mysql.sh status    查看状态
#   ./tools/dev/mysql.sh cli       打开 mysql 客户端（已连到 dreamweaver 库）
#   ./tools/dev/mysql.sh init      首次初始化数据目录 + 建库建账号
#
# 默认：127.0.0.1:3306 · 库 dreamweaver · 账号 dw / dw123456
set -uo pipefail

DW_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MYSQL_BASE="${DW_MYSQL_BASE:-/opt/anaconda3}"
MYSQLD="$MYSQL_BASE/bin/mysqld"
MYSQL="$MYSQL_BASE/bin/mysql"
DATA_DIR="$DW_ROOT/.tools/mysql/data"
RUN_DIR="$DW_ROOT/.tools/mysql/run"
LOG_DIR="$DW_ROOT/.tools/mysql/logs"
SOCKET="$RUN_DIR/mysql.sock"
PIDFILE="$RUN_DIR/mysqld.pid"

DB_NAME="${DW_DB_NAME:-dreamweaver}"
DB_USER="${DW_DB_USER:-dw}"
DB_PASSWORD="${DW_DB_PASSWORD:-dw123456}"
DB_PORT="${DW_DB_PORT:-3306}"

c_reset='\033[0m'; c_grn='\033[32m'; c_red='\033[31m'; c_cyn='\033[36m'; c_dim='\033[2m'
log() { printf "${c_cyn}▸${c_reset} %s\n" "$*"; }
ok()  { printf "${c_grn}✓${c_reset} %s\n" "$*"; }
err() { printf "${c_red}✗${c_reset} %s\n" "$*"; }

[ -x "$MYSQLD" ] || { err "找不到 mysqld：${MYSQLD}（可用 DW_MYSQL_BASE 指定 MySQL 安装目录）"; exit 1; }

is_up() { "$MYSQL" --socket="$SOCKET" -uroot -e "SELECT 1" >/dev/null 2>&1; }

do_init() {
  if [ -d "$DATA_DIR/mysql" ]; then ok "数据目录已存在，跳过初始化（${DATA_DIR}）"; return 0; fi
  log "初始化 MySQL 数据目录 → $DATA_DIR"
  mkdir -p "$DATA_DIR" "$RUN_DIR" "$LOG_DIR"
  "$MYSQLD" --initialize-insecure --basedir="$MYSQL_BASE" --datadir="$DATA_DIR" \
    --lc-messages-dir="$MYSQL_BASE/share/mysql" 2>&1 | tail -3
  do_start
  log "创建数据库与账号"
  "$MYSQL" --socket="$SOCKET" -uroot -e "
    CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '$DB_USER'@'%' IDENTIFIED BY '$DB_PASSWORD';
    GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'%';
    FLUSH PRIVILEGES;"
  ok "数据库 $DB_NAME 与账号 $DB_USER 就绪"
}

do_start() {
  if is_up; then ok "MySQL 已在运行（${SOCKET}）"; return 0; fi
  mkdir -p "$RUN_DIR" "$LOG_DIR"
  log "启动 MySQL（端口 ${DB_PORT}，数据目录 ${DATA_DIR}）"
  nohup "$MYSQLD" --basedir="$MYSQL_BASE" --datadir="$DATA_DIR" --socket="$SOCKET" \
    --pid-file="$PIDFILE" --port="$DB_PORT" --bind-address=127.0.0.1 \
    --lc-messages-dir="$MYSQL_BASE/share/mysql" --log-error="$LOG_DIR/error.log" \
    >/dev/null 2>&1 &
  for _ in $(seq 1 40); do
    if is_up; then ok "MySQL 就绪（127.0.0.1:$DB_PORT / socket ${SOCKET}）"; return 0; fi
    sleep 1
  done
  err "MySQL 启动超时，日志：$LOG_DIR/error.log"
  return 1
}

do_stop() {
  if [ -f "$PIDFILE" ]; then
    local pid; pid="$(cat "$PIDFILE")"
    kill "$pid" 2>/dev/null && ok "MySQL 已停止（pid ${pid}）" || err "停止失败（pid ${pid}）"
    for _ in $(seq 1 20); do [ -S "$SOCKET" ] || break; sleep 1; done
  else
    err "未找到 pid 文件，MySQL 可能未运行"
  fi
}

case "${1:-start}" in
  init)   do_init ;;
  start)  do_start ;;
  stop)   do_stop ;;
  cli)    "$MYSQL" --socket="$SOCKET" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" ;;
  status)
    if is_up; then
      ok "MySQL 运行中"
      "$MYSQL" --socket="$SOCKET" -uroot -e "SELECT VERSION() version, @@port port; SHOW TABLES FROM \`$DB_NAME\`;" 2>/dev/null
    else
      printf "${c_dim}○ MySQL 未运行${c_reset}\n"
    fi ;;
  *) echo "用法：$0 {init|start|stop|status|cli}"; exit 1 ;;
esac
