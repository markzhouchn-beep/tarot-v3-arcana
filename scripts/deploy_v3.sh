#!/usr/bin/env bash
# ============================================================
# scripts/deploy_v3.sh · 阿里云部署占位
# ⚠️ 本脚本为占位，Mark 拍板前不部署
# ============================================================

set -euo pipefail

echo "⚠️  本脚本为占位，未启用"
echo "⚠️  部署 v3.0 到阿里云需要 Mark 明确拍板（同机 vs 新机）"
echo "⚠️  见 KNOWN_ISSUES.md 待 Mark 拍板部分"
exit 1

# 实际部署逻辑（Phase 5 启用）：
# 1. rsync 本地 dist/ + server.js + db.js → /var/www/tarot-v3/
# 2. chmod -R o+rX dist/
# 3. 初始化数据库（执行 schema.sql）
# 4. pm2 start ecosystem.config.js
# 5. nginx reload（添加 tarot-v3.layershop.store 反代）
# 6. curl /api/health 验证
# 7. 测试 webhook 联通
