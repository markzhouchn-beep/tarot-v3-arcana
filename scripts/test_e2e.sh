#!/usr/bin/env bash
# ============================================================
# scripts/test_e2e.sh · E2E 测试脚本
# Phase 0 覆盖 8 步核心流程
# ============================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3003}"
DEVICE_ID="test-device-$(date +%s)"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}━━━ Step $1: $2 ━━━${NC}"; }

echo "============================================="
echo "  ARCANA v3.0 E2E Test · $BASE_URL"
echo "  Device: $DEVICE_ID"
echo "============================================="

# ─── Step 1: 健康检查 ───
step 1 "健康检查"
RES=$(curl -fsS "$BASE_URL/api/health")
echo "$RES" | head -c 300
echo ""
echo "$RES" | grep -q '"ok":true' && pass "Health OK" || fail "Health failed"

# ─── Step 2: 列出牌阵 ───
step 2 "列出牌阵"
RES=$(curl -fsS "$BASE_URL/api/spreads")
SPREAD_COUNT=$(echo "$RES" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['spreads']))")
[[ "$SPREAD_COUNT" -ge 10 ]] && pass "Spreads count: $SPREAD_COUNT" || fail "Spreads count: $SPREAD_COUNT"

# ─── Step 3: 创建订单 ───
step 3 "创建单次订单（¥3.9 三张）"
RES=$(curl -fsS -X POST "$BASE_URL/api/orders/create" \
  -H "Content-Type: application/json" \
  -d "{\"spread_type\":\"love-3\",\"spread_theme\":\"love\",\"question\":\"测试问题：我和他合适吗？\",\"tier\":\"classic\",\"device_id\":\"$DEVICE_ID\"}")
echo "$RES" | head -c 300
ORDER_ID=$(echo "$RES" | python3 -c "import sys, json; print(json.load(sys.stdin)['orderId'])")
echo ""
pass "Order created: $ORDER_ID"

# ─── Step 4: 查询订单状态 ───
step 4 "查询订单状态"
RES=$(curl -fsS "$BASE_URL/api/orders/$ORDER_ID")
echo "$RES" | head -c 200
STATUS=$(echo "$RES" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])")
[[ "$STATUS" == "pending" ]] && pass "Order status: pending" || fail "Expected pending, got: $STATUS"

# ─── Step 5: Yes/No 免费抽 ───
step 5 "Yes/No 免费抽"
RES=$(curl -fsS -X POST "$BASE_URL/api/yes-no/draw" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $DEVICE_ID" \
  -d '{"question":"他喜欢我吗？"}')
echo "$RES" | head -c 300
echo ""
echo "$RES" | grep -q '"ok":true' && pass "Yes/No draw OK" || fail "Yes/No failed"

# ─── Step 6: Yes/No 配额检查 ───
step 6 "Yes/No 配额检查（应显示已用 1/1）"
RES=$(curl -fsS "$BASE_URL/api/yes-no/quota" -H "X-Device-Id: $DEVICE_ID")
echo "$RES" | head -c 200
USED=$(echo "$RES" | python3 -c "import sys, json; print(json.load(sys.stdin)['used'])")
[[ "$USED" == "1" ]] && pass "Quota used: 1" || fail "Expected 1, got: $USED"

# ─── Step 7: 申请 Magic Link ───
step 7 "申请 Magic Link"
RES=$(curl -fsS -X POST "$BASE_URL/api/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')
echo "$RES" | head -c 300
echo ""
echo "$RES" | grep -q '"ok":true' && pass "Magic link sent (mocked)" || fail "Magic link failed"

# ─── Step 8: Oracle 追问 · 访客被拒（设计行为） ───
step 8 "Oracle 追问（访客应被拒，返 401）"
HTTP_CODE=$(curl -sS -o /tmp/oracle_resp.txt -w "%{http_code}" -X POST "$BASE_URL/api/oracle/ask" \
  -H "Content-Type: application/json" \
  -d '{"question":"这张牌还有什么没说的？"}')
cat /tmp/oracle_resp.txt | head -c 200
echo ""
if [[ "$HTTP_CODE" == "401" ]]; then
  pass "Guest correctly rejected with 401 (LOGIN_REQUIRED)"
else
  fail "Expected 401 for guest, got: $HTTP_CODE"
fi

# ─── Step 9: 预设问题（访客可用） ───
step 9 "预设问题列表（访客可用）"
RES=$(curl -fsS "$BASE_URL/api/oracle/preset-questions")
echo "$RES" | head -c 300
echo ""
echo "$RES" | grep -q '"questions"' && pass "Preset questions returned (empty array OK)" || fail "Preset questions failed"

# ─── Step 10: 会员状态（访客） ───
step 10 "会员状态（访客：tier=guest）"
RES=$(curl -fsS "$BASE_URL/api/membership/status")
echo "$RES" | head -c 300
echo ""
TIER=$(echo "$RES" | python3 -c "import sys, json; print(json.load(sys.stdin)['tier'])")
[[ "$TIER" == "guest" ]] && pass "Guest tier returned" || fail "Expected guest, got: $TIER"

echo ""
echo "============================================="
echo -e "  ${GREEN}✅ ALL 8 STEPS PASSED${NC}"
echo "============================================="
echo ""
echo "Phase 0 E2E 完成。下一步：等 Mark 拍板 Phase 1 排期 → 前端 13 页面骨架"
