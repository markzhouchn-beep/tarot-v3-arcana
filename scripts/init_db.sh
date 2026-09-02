#!/usr/bin/env bash
# ============================================================
# scripts/init_db.sh · 初始化 v3 数据库
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V3_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$V3_DIR/server"
SCHEMA_FILE="$SCRIPT_DIR/schema.sql"

DB_PATH="${DB_PATH:-$SERVER_DIR/data/tarot_v3.db}"
DB_DIR="$(dirname "$DB_PATH")"

echo "[init_db] DB: $DB_PATH"

# 创建 data 目录
mkdir -p "$DB_DIR"

# 检查 .env
ENV_FILE="$SERVER_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[init_db] ⚠️  .env 不存在，复制 .env.example → .env"
  cp "$SERVER_DIR/.env.example" "$ENV_FILE"
  echo "[init_db] 📝 请编辑 .env 填写真实值（MINIMAX_API_KEY / AFDIAN_TOKEN / SMTP）"
fi

# 删除旧 DB（如果是测试）
if [[ "${RESET:-0}" == "1" ]]; then
  echo "[init_db] RESET=1，删除旧 DB"
  rm -f "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm"
fi

# 检查 sqlite3
if ! command -v sqlite3 &> /dev/null; then
  echo "[init_db] ❌ sqlite3 命令不存在，请安装：brew install sqlite3"
  exit 1
fi

# 加载 schema
echo "[init_db] 加载 schema.sql ..."
sqlite3 "$DB_PATH" < "$SCHEMA_FILE"

echo "[init_db] ✅ 数据库初始化完成"
echo "[init_db] 表数: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table'")"
echo ""
echo "下一步："
echo "  cd $SERVER_DIR"
echo "  npm install"
echo "  npm run dev"
