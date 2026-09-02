#!/bin/bash
# ============================================================
# Phase 2 会员订阅 E2E 测试
# 流程：注册 → 手动 verify → 模拟爱发电 webhook (product_type=0)
#      → activateSubscription → user_subscriptions 写入
#      → users.tier 升级到 silver → 发邮件（mock）
# ============================================================

set -e

cd "$(dirname "$0")/../server"

USER_ID=""
OUT_TRADE_NO=""
TS=""
SIGN=""

echo "=== Phase 2 会员订阅 E2E ==="
echo ""

# 1. 注册
EMAIL="test-p2-$(date +%s)@example.com"
echo "1. 注册: $EMAIL"
REG_RES=$(curl -sS -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"test1234\"}")
USER_ID=$(echo "$REG_RES" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('user',{}).get('id',''))")
echo "   USER_ID: $USER_ID"

# 2. 手动 verify email + 设 tier=registered
echo ""
echo "2. 手动验证邮箱 + tier=registered"
sqlite3 ./data/tarot_v3.db "UPDATE users SET email_verified=1, tier='registered' WHERE id='$USER_ID'"

# 3. 登录拿 session
echo ""
echo "3. 登录拿 session"
LOGIN_RES=$(curl -sS -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"test1234\"}" \
  -D /tmp/login-headers.txt -o /tmp/login-body.json)
echo "   login: $(cat /tmp/login-body.json | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"user\",{}).get(\"tier\",\"?\"))')"

# 4. 调 /api/membership/subscribe 创建订阅 URL
echo ""
echo "4. POST /api/membership/subscribe (silver_monthly)"
SESSION=$(grep -i "set-cookie:" /tmp/login-headers.txt | sed 's/.*arcana_session=//;s/;.*//' | head -1)
echo "   session token: ${SESSION:0:30}..."

SUB_RES=$(curl -sS -X POST http://localhost:3003/api/membership/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION" \
  -d '{"plan":"silver_monthly"}')
echo "   response: $(echo "$SUB_RES" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f\"planId={d.get(\"planId\")} tier={d.get(\"tier\")}\")')"

# 5. 模拟爱发电 webhook product_type=0 (订阅)
echo ""
echo "5. 模拟爱发电 webhook product_type=0 (订阅银月月卡)"
OUT_TRADE_NO="test_sub_$(date +%s)"
TS=$(date +%s)

# 直接在 Node 里算签名 + 发 webhook（最稳）
node -e "
import('./lib/afdian.js').then(async (m) => {
  const { signPayload, verifyWebhook } = m;
  const userId = '$USER_ID';
  const outTradeNo = '$OUT_TRADE_NO';
  const ts = '$TS';
  const token = process.env.AFDIAN_TOKEN;
  const afdianUserId = process.env.AFDIAN_USER_ID;
  
  const order = {
    out_trade_no: outTradeNo,
    custom_order_id: userId,
    product_type: 0,
    total_amount: '19.90',
    status: 2,
    plan_id: 'silver_monthly',
    pay_month: 1,
    sku_id: '',
    redeem_id: '',
    month: 1,
    title: '银月会员月卡',
    user_id: afdianUserId,
    create_time: Math.floor(Date.now() / 1000),
  };
  
  const sign = signPayload(order, ts, afdianUserId, token);
  
  const payload = { ec: 200, em: '', data: { order } };
  const params = new URLSearchParams();
  params.append('ec', '200');
  params.append('em', '');
  params.append('sign', sign);
  params.append('ts', ts);
  params.append('data', JSON.stringify(payload));
  
  const res = await fetch('http://localhost:3003/api/afdian/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await res.text();
  console.log('   HTTP', res.status, ':', text);
});
" 2>&1 | head -10

# 6. 验证 user_subscriptions 写入
echo ""
echo "6. 验证 user_subscriptions 表"
SUB_COUNT=$(sqlite3 ./data/tarot_v3.db "SELECT COUNT(*) FROM user_subscriptions WHERE user_id='$USER_ID'")
echo "   该用户订阅数: $SUB_COUNT"
sqlite3 ./data/tarot_v3.db "SELECT id, tier, status, pay_month, datetime(expires_at/1000, 'unixepoch') AS expires FROM user_subscriptions WHERE user_id='$USER_ID'" | head -3

# 7. 验证 users.tier 已升级
echo ""
echo "7. 验证 users.tier"
sqlite3 ./data/tarot_v3.db "SELECT id, email, tier FROM users WHERE id='$USER_ID'"

# 8. 验证 /api/membership/status 返回 subscription
echo ""
echo "8. /api/membership/status (登录后)"
STATUS_RES=$(curl -sS http://localhost:3003/api/membership/status \
  -H "Authorization: Bearer $SESSION")
echo "$STATUS_RES" | python3 -m json.tool | head -25

# 9. 测试幂等性（再发一次同样 webhook 应该被 ignore）
echo ""
echo "9. 测试幂等性（再发一次相同 webhook）"
node -e "
import('./lib/afdian.js').then(async (m) => {
  const { signPayload } = m;
  const order = {
    out_trade_no: '$OUT_TRADE_NO',
    custom_order_id: '$USER_ID',
    product_type: 0,
    total_amount: '19.90',
    status: 2,
    plan_id: 'silver_monthly',
    pay_month: 1,
    sku_id: '',
    redeem_id: '',
    month: 1,
    title: '银月会员月卡',
    user_id: process.env.AFDIAN_USER_ID,
    create_time: Math.floor(Date.now() / 1000),
  };
  const sign = signPayload(order, '$TS', process.env.AFDIAN_USER_ID, process.env.AFDIAN_TOKEN);
  const payload = { ec: 200, em: '', data: { order } };
  const params = new URLSearchParams();
  params.append('ec', '200');
  params.append('em', '');
  params.append('sign', sign);
  params.append('ts', '$TS');
  params.append('data', JSON.stringify(payload));
  const res = await fetch('http://localhost:3003/api/afdian/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await res.text();
  console.log('   HTTP', res.status, ':', text);
});
" 2>&1 | head -3

echo ""
echo "=== 测试完成 ==="
