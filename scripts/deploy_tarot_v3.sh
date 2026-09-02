#!/bin/bash
# ============================================================
# deploy_tarot_v3.sh · v3.0 阿里云部署脚本（替代 v2）
# ============================================================
# 使用：
#   1. 上传本地代码到阿里云（rsync + sshpass）
#   2. 后端 PM2 重启
#   3. 前端 dist/ 部署到 nginx
#   4. nginx reload
#
# 前提：
#   - 阿里云 nginx 已配置 server_name tarot-v3.layershop.store
#   - SSL 已签（Let's Encrypt certbot）
#   - PM2 已装
# ============================================================

set -e

# ========== 配置 ==========
SERVER="root@YOUR_SERVER_IP"           # 阿里云（红线：Mark 拍板才动）
PASSWORD="${DEPLOY_SSH_PASSWORD}"       # SSH 密码（用 sshpass；生产环境通过 env 传，不要硬编码）
REMOTE_DIR="/var/www/tarot-v3"         # 服务器部署路径
BACKEND_PORT="3003"                    # 后端端口
FRONTEND_PORT="5175"                   # Vite dev（生产用 nginx 直接服务 dist/）
PM2_NAME="tarot-v3"

# ========== 前置 ==========
echo "🛑  检查依赖..."
which sshpass || { echo "❌ sshpass 未装（brew install sshpass）"; exit 1; }
which rsync || { echo "❌ rsync 未装"; exit 1; }

# ========== 1. 同步代码 ==========
echo ""
echo "📦  1/5  同步代码到服务器..."
sshpass -p "$PASSWORD" rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'data/*.db' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude 'web/dist' \
  --exclude '.git' \
  --exclude '*.log' \
  --exclude '_archive' \
  -e ssh \
  "$(dirname "$0")/.." "$SERVER:$REMOTE_DIR/"

# ========== 2. 同步 .env ==========
echo ""
echo "🔑  2/5  同步 .env（仅生产配置）..."
if [ -f "$(dirname "$0")/../server/.env.production" ]; then
  sshpass -p "$PASSWORD" scp \
    "$(dirname "$0")/../server/.env.production" \
    "$SERVER:$REMOTE_DIR/server/.env"
fi

# ========== 3. 装依赖 ==========
echo ""
echo "📥  3/5  安装后端依赖..."
sshpass -p "$PASSWORD" ssh "$SERVER" "
  cd $REMOTE_DIR/server && npm ci --omit=dev 2>&1 | tail -5
"

# ========== 4. 构建前端 ==========
echo ""
echo "🔨  4/5  构建前端 + 部署 dist..."
sshpass -p "$PASSWORD" ssh "$SERVER" "
  cd $REMOTE_DIR/web && npm ci 2>&1 | tail -3 && npm run build 2>&1 | tail -5
"

# ========== 5. 重启 PM2 + 修权限 ==========
echo ""
echo "🔄  5/5  重启后端 + 修文件权限..."
sshpass -p "$PASSWORD" ssh "$SERVER" "
  cd $REMOTE_DIR/server
  pm2 delete $PM2_NAME 2>/dev/null || true
  pm2 start server.js --name $PM2_NAME --time
  pm2 save
  
  # 修复文件权限（macOS 默认 0600 + 501:staff → 阿里云 www-data 读不到）
  chmod -R o+rX $REMOTE_DIR/web/dist/
  chmod -R o+rX $REMOTE_DIR/server/data/ 2>/dev/null || true
  
  # nginx reload
  nginx -t && systemctl reload nginx || echo '⚠️  nginx reload 失败'
  
  # 健康检查
  sleep 3
  curl -s http://localhost:$BACKEND_PORT/api/health
"

echo ""
echo "✅  部署完成"
echo "   后端：http://$SERVER:$BACKEND_PORT"
echo "   前端：https://tarot-v3.layershop.store"
echo "   日志：pm2 logs $PM2_NAME"