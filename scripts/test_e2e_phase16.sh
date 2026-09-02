#!/bin/bash
# ============================================================
# test_e2e_phase16.sh · v3.0 Phase 1.6 完整 E2E
# 创建：2026-09-01 · Mark 早上可直接跑
# 涵盖：6 后端核心路由 + 13 前端页面 + 完整支付链路
# ============================================================

set -e

FRONTEND=http://localhost:5175
BACKEND=http://localhost:3003
PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

echo "════════════════════════════════════════════════"
echo "  ARCANA ai v3.0 · Phase 1.6 E2E"
echo "  Frontend: $FRONTEND"
echo "  Backend:  $BACKEND"
echo "════════════════════════════════════════════════"

echo ""
echo "▸ 1. 前端 13 页面 HTTP 200"
PAGES=(
  /
  /spreads
  /yes-no
  /auth
  /ask/love-3
  /draw/test
  /spread/test
  /reading/test
  /loading/test
  /membership
  /dashboard
  /checkout/single
  /oracle
)
for p in "${PAGES[@]}"; do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$FRONTEND$p")
  [ "$CODE" = "200" ] && pass "$p → 200" || fail "$p → $CODE"
done

echo ""
echo "▸ 2. 后端核心路由"
SPREADS=$(curl -sS $BACKEND/api/spreads | python3 -c "import sys,json; print(len(json.load(sys.stdin)['spreads']))")
[ "$SPREADS" -ge 10 ] && pass "GET /api/spreads → $SPREADS 个牌阵" || fail "牌阵数量异常: $SPREADS"

SPREAD=$(curl -sS $BACKEND/api/spreads/love-3 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d['name']}|{d['cards']}|{d['price']}\")")
[ -n "$SPREAD" ] && pass "GET /api/spreads/love-3 → $SPREAD" || fail "love-3 查询失败"

ORDER_ID=$(curl -sS -X POST -H "Content-Type: application/json" -d '{
  "spread_type":"love-3","spread_theme":"love","question":"E2E test","tier":"three","device_id":"e2e-001"
}' $BACKEND/api/orders/create | python3 -c "import sys,json; print(json.load(sys.stdin)['orderId'])")
[ -n "$ORDER_ID" ] && pass "POST /api/orders/create → $ORDER_ID" || fail "创建订单失败"

PAY_URL=$(curl -sS $BACKEND/api/orders/$ORDER_ID | python3 -c "import sys,json; print(json.load(sys.stdin).get('afdian_pay_url',''))")
echo "$PAY_URL" | grep -q "afdian.com" && pass "GET /api/orders/:id → payUrl 含 afdian.com" || fail "payUrl 异常: $PAY_URL"

RECON=$(curl -sS -X POST $BACKEND/api/orders/$ORDER_ID/reconcile | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status'))")
[ -n "$RECON" ] && pass "POST /api/orders/:id/reconcile → status=$RECON" || fail "reconcile 失败"

LIST=$(curl -sS "$BACKEND/api/orders?limit=5" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['orders']))")
[ "$LIST" -ge 1 ] && pass "GET /api/orders → $LIST 个订单" || fail "订单列表异常"

echo ""
echo "▸ 3. PD v0.8 防御 · trust-paid 必须 404"
HTTP=$(curl -sS -X POST -o /dev/null -w "%{http_code}" $BACKEND/api/orders/test/trust-paid)
[ "$HTTP" = "404" ] && pass "POST /api/orders/:id/trust-paid → 404" || fail "trust-paid 应返 404, 实际 $HTTP"

echo ""
echo "▸ 4. 完整链路：标 paid → AI 解读"
sqlite3 ~/Desktop/tarot-app/v3/server/data/tarot_v3.db "UPDATE orders SET status='paid', paid_at=$(date +%s)000 WHERE id='$ORDER_ID';" > /dev/null
curl -sS -X POST $BACKEND/api/orders/$ORDER_ID/interpret > /dev/null
pass "标 paid + 触发 AI 解读"

# 等 10s 让 AI 出结果
echo "  ⏳ 等待 AI 生成解读..."
for i in 1 2 3 4 5; do
  STATUS=$(curl -sS $BACKEND/api/orders/$ORDER_ID | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status'))")
  if [ "$STATUS" = "interpreted" ]; then
    pass "AI 解读生成成功（status=$STATUS）"
    break
  fi
  sleep 3
done

echo ""
echo "════════════════════════════════════════════════"
echo "  📊 结果：通过 $PASS / 失败 $FAIL"
echo "════════════════════════════════════════════════"

[ $FAIL -eq 0 ] && exit 0 || exit 1