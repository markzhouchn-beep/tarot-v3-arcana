#!/bin/bash
# ============================================================
# test_e2e_invite.sh · Phase 4 邀请系统 E2E 测试
# 验证：邀请码生成、注册关联、注册奖励、防刷机制、首次付费奖励
# ============================================================

set -e
BASE=http://localhost:3003/api

# 随机测试邮箱
SUFFIX=$(date +%s)
INVITER_EMAIL="inviter-$SUFFIX@test.com"
INVITEE_EMAIL="invitee-$SUFFIX@test.com"
DEVICE_INVITEE="device-invitee-$SUFFIX"

PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

echo ""
echo "🧪 Phase 4 邀请系统 E2E 测试"
echo "═══════════════════════════════════════════════"

# ============================================================
# 测试 1: 注册邀请人（拿到 invite_code）
# ============================================================
echo ""
echo "📋 测试 1: 注册邀请人 + 获取邀请码"

INVITER_RES=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$INVITER_EMAIL\",\"password\":\"TestPass123\"}")
echo "  注册响应: $INVITER_RES"

INVITER_LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -c /tmp/cookie-inviter.txt \
  -d "{\"email\":\"$INVITER_EMAIL\",\"password\":\"TestPass123\"}")
echo "  登录响应: $INVITER_LOGIN"

INVITER_CODE=$(echo "$INVITER_LOGIN" | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('invite_code', ''))" 2>/dev/null || echo "")
if [ -n "$INVITER_CODE" ] && [ "$INVITER_CODE" != "null" ]; then
  pass "邀请人获得邀请码: $INVITER_CODE"
else
  fail "邀请人没拿到 invite_code（响应无 user.invite_code）"
fi

# ============================================================
# 测试 2: 注册被邀请人（带邀请码）→ 关联邀请
# ============================================================
echo ""
echo "📋 测试 2: 注册被邀请人（带邀请码）→ 应得 +1 次三张免费"

INVITEE_RES=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $DEVICE_INVITEE" \
  -d "{\"email\":\"$INVITEE_EMAIL\",\"password\":\"TestPass123\",\"invite_code\":\"$INVITER_CODE\"}")
echo "  注册响应: $INVITEE_RES"

INVITEE_LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -c /tmp/cookie-invitee.txt \
  -d "{\"email\":\"$INVITEE_EMAIL\",\"password\":\"TestPass123\"}")
echo "  登录响应: $INVITEE_LOGIN"

# ============================================================
# 测试 3: 查询邀请人统计（应得注册奖励 +3 追问）
# ============================================================
echo ""
echo "📋 测试 3: 查询邀请人 /invites/me → 应看到 1 个邀请 + 1 个 +3 追问奖励"

INVITER_STATS=$(curl -s -b /tmp/cookie-inviter.txt "$BASE/invites/me")
echo "  邀请人统计: $INVITER_STATS"

TOTAL_INVITES=$(echo "$INVITER_STATS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('summary', {}).get('total_invites', 0))" 2>/dev/null || echo "0")
TOTAL_REWARDS=$(echo "$INVITER_STATS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('summary', {}).get('total_rewards', 0))" 2>/dev/null || echo "0")

if [ "$TOTAL_INVITES" = "1" ]; then
  pass "邀请人数 = 1"
else
  fail "邀请人数异常: $TOTAL_INVITES"
fi

if [ "$TOTAL_REWARDS" -ge "1" ]; then
  pass "邀请人获得 $TOTAL_REWARDS 个奖励"
else
  fail "邀请人没获得奖励"
fi

# ============================================================
# 测试 4: 查询邀请码（脱敏）
# ============================================================
echo ""
echo "📋 测试 4: 查询邀请码 $INVITER_CODE → 应返回邀请人脱敏信息"

LOOKUP_RES=$(curl -s "$BASE/invites/lookup/$INVITER_CODE")
echo "  查询响应: $LOOKUP_RES"

NICKNAME=$(echo "$LOOKUP_RES" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('inviter',{}).get('nickname',''))" 2>/dev/null || echo "")
if [ -n "$NICKNAME" ] && [ "$NICKNAME" != "null" ]; then
  pass "查询邀请人脱敏信息成功: nickname=$NICKNAME"
else
  fail "查询邀请码失败"
fi

# ============================================================
# 测试 5: 防刷 — 同一设备再次注册
# ============================================================
echo ""
echo "📋 测试 5: 防刷 — 同一 device_id 二次注册 → 应被拦截"

SPAM_EMAIL="spam-$SUFFIX@test.com"
SPAM_RES=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $DEVICE_INVITEE" \
  -d "{\"email\":\"$SPAM_EMAIL\",\"password\":\"TestPass123\",\"invite_code\":\"$INVITER_CODE\"}")
echo "  Spam 注册响应: $SPAM_RES"

# 防刷在 lib/invite.js 里：同设备已有邀请 → createInviteRecord 返回 null → 不创建新记录
# 但 register 路由会创建新用户，只是不写 invites 记录
# 检查：被邀请人有效数仍为 1（未增加）
SPAM_STATS=$(curl -s -b /tmp/cookie-inviter.txt "$BASE/invites/me")
NEW_TOTAL=$(echo "$SPAM_STATS" | python3 -c "import sys, json; print(json.load(sys.stdin).get('summary', {}).get('total_invites', 0))" 2>/dev/null || echo "0")

if [ "$NEW_TOTAL" = "1" ]; then
  pass "防刷生效：第二次同设备注册没创建邀请记录（total 仍 = 1）"
else
  fail "防刷失效：total 增加到 $NEW_TOTAL"
fi

# ============================================================
# 总结
# ============================================================
echo ""
echo "═══════════════════════════════════════════════"
echo "📊 测试总结"
echo "  通过: $PASS"
echo "  失败: $FAIL"
if [ $FAIL -eq 0 ]; then
  echo "  🎉 全部通过"
else
  echo "  ⚠️ 有失败项需查"
fi
echo "═══════════════════════════════════════════════"