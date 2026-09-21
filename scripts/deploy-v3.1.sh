#!/usr/bin/env bash
# ============================================================
# scripts/deploy-v3.1.sh · 一键部署脚本（prod + test 双部署）
# 创建：2026-09-21 · v3.1
#
# 流程（在 39.106.162.16 上执行）：
#   1. 备份当前 prod 到 /var/www/_archive/
#   2. 同步代码到 /var/www/tarot-app-v3/（正式，端口 3003）
#   3. 同步代码到 /var/www/tarot-app-v3-test/（测试，端口 3004）
#   4. 安装两边依赖 + 构建前端
#   5. 初始化测试 db（不动 prod db）
#   6. 写 nginx 配置 + reload
#   7. PM2 重启（tarot-v3-prod + tarot-v3-test）
#   8. 健康检查
#
# 前置：本地代码已 commit + push 到 GitHub
# 用法（在服务器上）：
#   cd /tmp && git clone https://github.com/markzhouchn-beep/tarot-v3-arcana.git arcana-src
#   cd /tmp && bash /tmp/arcana-src/scripts/deploy-v3.1.sh
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $1"; }
err()  { echo -e "${RED}[deploy]${NC} $1"; exit 1; }

[ "$(whoami)" = "root" ] || err "请用 root 运行"

ARCHIVE_DIR="/var/www/_archive"
SRC_DIR="/tmp/arcana-src"
PROD_DIR="/var/www/tarot-app-v3"
TEST_DIR="/var/www/tarot-app-v3-test"

mkdir -p "$ARCHIVE_DIR"

# ===== 1. 备份当前 prod 部署 =====
if [ -d "$PROD_DIR" ]; then
  BAK_TS=$(date +%Y%m%d-%H%M%S)
  BAK_DIR="$ARCHIVE_DIR/tarot-app-v3-bak-$BAK_TS"
  log "备份当前 prod 部署到 $BAK_DIR"
  cp -a "$PROD_DIR" "$BAK_DIR"
fi

# ===== 2. 源码校验 =====
[ -d "$SRC_DIR" ] || err "源码目录不存在：$SRC_DIR
请先在 /tmp 下：
  git clone https://github.com/markzhouchn-beep/tarot-v3-arcana.git arcana-src"
log "源码路径：$SRC_DIR"
cd "$SRC_DIR" && git pull --rebase origin main || err "git pull 失败"

# ===== 3. 同步 prod =====
log "同步代码到 $PROD_DIR（正式站）"
rm -rf "$PROD_DIR"
cp -a "$SRC_DIR" "$PROD_DIR"
cd "$PROD_DIR/server" || err "进入 prod server 目录失败"

# ===== 4. 安装 prod 后端依赖 =====
log "安装 prod 后端依赖"
npm install --omit=dev --silent || err "prod 后端 npm install 失败"

# ===== 5. 构建 prod 前端 =====
log "构建 prod 前端"
cd "$PROD_DIR/web" || err "进入 prod web 目录失败"
npm install --silent || err "prod 前端 npm install 失败"
npm run build --silent || err "prod 前端 build 失败"

# ===== 6. prod db（保留现有） =====
mkdir -p "$PROD_DIR/server/data"
if [ ! -f "$PROD_DIR/server/data/tarot_v3.db" ]; then
  log "初始化 prod 数据库"
  cd "$PROD_DIR/server"
  node init_db.cjs 2>/dev/null || node init_db.js 2>/dev/null || warn "prod db 初始化跳过"
fi

# ===== 7. 同步测试站 =====
log "同步代码到 $TEST_DIR（测试站）"
rm -rf "$TEST_DIR"
cp -a "$SRC_DIR" "$TEST_DIR"
cd "$TEST_DIR/server" || err "进入 test server 目录失败"

# ===== 8. 安装 test 后端依赖 =====
log "安装 test 后端依赖"
npm install --omit=dev --silent || err "test 后端 npm install 失败"

# ===== 9. 构建 test 前端 =====
log "构建 test 前端"
cd "$TEST_DIR/web" || err "进入 test web 目录失败"
npm install --silent || err "test 前端 npm install 失败"
npm run build --silent || err "test 前端 build 失败"

# ===== 10. 初始化 test 数据库（全新） =====
mkdir -p "$TEST_DIR/server/data"
log "初始化 test 数据库（全新）"
cd "$TEST_DIR/server"
node init_db.cjs 2>/dev/null || node init_db.js 2>/dev/null || warn "test db 初始化跳过"

# ===== 11. nginx 配置 =====
log "安装 nginx 配置"
if [ -f "$PROD_DIR/scripts/nginx/tarotbox.cn.conf" ]; then
  cp "$PROD_DIR/scripts/nginx/tarotbox.cn.conf" /etc/nginx/sites-enabled/tarotbox.cn
fi
if [ -f "$PROD_DIR/scripts/nginx/tarot.layershop.store.test.conf" ]; then
  cp "$PROD_DIR/scripts/nginx/tarot.layershop.store.test.conf" /etc/nginx/sites-enabled/tarot.layershop.store
fi

# ===== 12. .env 检查 =====
if [ ! -f "$PROD_DIR/server/.env" ]; then
  warn "prod .env 不存在，请手动创建 $PROD_DIR/server/.env（参考 .env.example）"
fi
if [ ! -f "$TEST_DIR/server/.env" ]; then
  warn "test .env 不存在，请手动创建 $TEST_DIR/server/.env（参考 .env.example，DOMAIN/FRONTEND_URL 用 tarot.layershop.store）"
fi

# ===== 13. nginx reload =====
log "nginx -t + reload"
nginx -t || err "nginx 配置语法错误"
systemctl reload nginx || warn "nginx reload 失败"

# ===== 14. PM2 =====
log "PM2 启动/重启"
cd "$PROD_DIR/server"
pm2 delete tarot-v3-prod 2>/dev/null || true
pm2 delete tarot-v3-test 2>/dev/null || true
pm2 delete tarot-v3 2>/dev/null || true   # 清理老的单进程
pm2 start ecosystem.config.cjs
pm2 save

# ===== 15. 健康检查 =====
sleep 3
log "健康检查"
echo "--- 正式站 tarotbox.cn（待 DNS + SSL 生效） ---"
curl -sk -o /dev/null -w "  https://www.tarotbox.cn: %{http_code}\n" https://www.tarotbox.cn/ 2>&1 || warn "正式站不通（DNS/SSL 可能还没就绪）"
echo "--- 测试站 tarot.layershop.store ---"
curl -sk -o /dev/null -w "  https://tarot.layershop.store: %{http_code}\n" https://tarot.layershop.store/ 2>&1 || warn "测试站不通"
curl -sk -o /dev/null -w "  https://tarot.layershop.store/api/health: %{http_code}\n" https://tarot.layershop.store/api/health 2>&1 || warn "测试站 API 不通"

log "部署完成 ✅"
log "PM2 状态：pm2 list"
log "后续步骤："
log "  1. 配置 .env（如果还没配）：vi $PROD_DIR/server/.env"
log "  2. 重启 PM2：pm2 restart all"
log "  3. DNS 解析生效后申请 SSL：certbot certonly --nginx -d tarotbox.cn -d www.tarotbox.cn"