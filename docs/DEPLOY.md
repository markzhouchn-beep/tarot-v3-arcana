# 部署文档（v3.0 上线）

## 📋 部署前检查清单（Mark 必须确认）

### 1. 阿里云服务器准备（红线：Mark 拍板才动）
- [ ] 阿里云 nginx 装好（已存在，端口 80/443）
- [ ] 阿里云 DNS 添加子域名解析：`tarot-v3.layershop.store` → `39.106.162.16`
- [ ] SSL 证书签发：`certbot --nginx -d tarot-v3.layershop.store`

### 2. 爱发电后台（需 Mark 登录 afdian.com/dashboard/dev 手工建）
- [ ] 3 个单次解读商品方案（¥1.9/¥3.9/¥9.9）
- [ ] 4 个订阅方案（银月月年 + 金月月年）
- [ ] 7 个 plan_id 记下，填到 `.env`
- [ ] webhook URL 填：`https://tarot-v3.layershop.store/api/afdian/webhook`

### 3. 环境变量（在阿里云服务器 `~/.env` 或 PM2 环境配置）
```bash
NODE_ENV=production
PORT=3003
FRONTEND_URL=https://tarot-v3.layershop.store
DB_PATH=/var/www/tarot-v3/server/data/tarot_v3.db

# Session
SESSION_SECRET=<64 位随机字符串>

# Admin（生产环境必须设 bcrypt hash）
ADMIN_USERNAME=mark
ADMIN_PASSWORD_HASH=$2a$12$...

# SMTP（阿里云邮件推送）
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...

# AI
MINIMAX_API_KEY=...
MINIMAX_BASE_URL=https://api.minimaxi.com/anthropic
MINIMAX_MODEL=MiniMax-M2.7

# 爱发电
AFDIAN_USER_ID=...
AFDIAN_TOKEN=...
AFDIAN_PLAN_LITE=...
AFDIAN_PLAN_CLASSIC=...
AFDIAN_PLAN_DEEP=...
AFDIAN_PLAN_SILVER_M=...
AFDIAN_PLAN_SILVER_Y=...
AFDIAN_PLAN_GOLD_M=...
AFDIAN_PLAN_GOLD_Y=...

# 灰度（上线时 CANARY_PERCENTAGE=100 全量）
CANARY_PERCENTAGE=100

# AI 告警阈值
AI_COST_DAILY_LIMIT=50
AI_USER_DAILY_LIMIT=100
```

## 🚀 部署步骤

### Step 1: 准备数据库
```bash
ssh root@39.106.162.16
mkdir -p /var/www/tarot-v3/server/data
# 跑迁移脚本
cd /var/www/tarot-v3
sqlite3 server/data/tarot_v3.db < scripts/schema.sql
sqlite3 server/data/tarot_v3.db < scripts/migrate_phase4.sql
sqlite3 server/data/tarot_v3.db < scripts/migrate_phase5_6.sql
```

### Step 2: 同步代码（rsync）
```bash
# 本地：跑 deploy 脚本
bash scripts/deploy_tarot_v3.sh
```

### Step 3: nginx 配置
```bash
# 上传 nginx 配置
scp scripts/nginx_tarot_v3.conf root@39.106.162.16:/etc/nginx/conf.d/tarot-v3.conf

# 测试 + 重载
ssh root@39.106.162.16 "nginx -t && systemctl reload nginx"
```

### Step 4: 申请 SSL（首次）
```bash
ssh root@39.106.162.16 "certbot --nginx -d tarot-v3.layershop.store"
```

### Step 5: 后端启动
```bash
ssh root@39.106.162.16
cd /var/www/tarot-v3/server
npm ci --omit=dev
pm2 start server.js --name tarot-v3 --time
pm2 save
pm2 startup  # 开机自启
```

### Step 6: 验证
```bash
# 后端健康
curl https://tarot-v3.layershop.store/api/health

# 前端首页
curl -I https://tarot-v3.layershop.store/

# 后台
curl -I https://tarot-v3.layershop.store/admin
```

## ⚠️ 关键红线

1. **不可动 v2.0**：`tarot.layershop.store` 继续作为现金牛，不动
2. **v3.0 子域名独立**：`tarot-v3.layershop.store`，数据/代码/PM2 全独立
3. **回滚方案**：v3 故障时 → DNS 切回 v2.0 子域名不生效（v2 是主域名，v3 是子域名）
4. **日志位置**：`/var/www/tarot-v3/server/*.log`（PM2 输出）

## 📊 上线后第一周观察

每天检查：
- [ ] `pm2 logs tarot-v3` 有无异常
- [ ] `/admin` 总览数据（订单数、营收、追问数）
- [ ] 续费率窗口（30 天后看）
- [ ] AI 成本监控（`/admin/stats/ai-cost`）

## 🆘 故障排查

| 现象 | 可能原因 | 解决 |
|---|---|---|
| 前端 502 | 后端 PM2 挂了 | `pm2 restart tarot-v3` |
| SSL 过期 | certbot 未续期 | `certbot renew` |
| 数据库锁死 | 并发过高 | 检查是否有长事务 |
| 邮件发不出 | SMTP 配置错 | 检查 `.env` SMTP_USER/SMTP_PASS |
| AI 调用失败 | API key 过期 | 检查 MINIMAX_API_KEY |