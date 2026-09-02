#!/bin/bash
# ============================================================
# test_e2e_invite_v2.sh · Phase 4 邀请系统 E2E 增强测试（最终版）
# 覆盖：
# - 基础邀请 + 事务原子性 + 后端 invite_url
# - Yes/No 自动 mark effective action
# - Milestone 满 3 人里程碑奖励
# - Magic Link 路径邀请关联（magic_url 带 invite_code + verify 关联）
# - 防刷回归（不同 device 允许 + 同 device 拦截）
# ============================================================

set +e
BASE=http://localhost:3003/api
SUFFIX=$(date +%s)
DB_DIR=/Users/mac/Desktop/tarot-app/v3/server

PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

sql_query() {
  (cd "$DB_DIR" && node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/tarot_v3.db');
$1" 2>&1 | tail -1)
}

# 用 X-Forwarded-For 模拟不同 IP（绕过 localhost 24h 限频）
rand_ip() {
  echo "10.$((RANDOM % 250)).$((RANDOM % 250)).$((RANDOM % 250))"
}

register_user() {
  local email=$1 extra=$2
  local ip=$(rand_ip)
  curl -s -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -H "X-Device-Id: device-${email}" \
    -H "X-Forwarded-For: $ip" \
    -d "{\"email\":\"$email\",\"password\":\"TestPass123\"${extra}}"
}

login_user() {
  local email=$1 cookie=$2
  curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -c "$cookie" \
    -d "{\"email\":\"$email\",\"password\":\"TestPass123\"}"
}

get_stats() {
  curl -s -b "$1" "$BASE/invites/me"
}

echo ""
echo "🧪 Phase 4 邀请系统 E2E 增强测试"
echo "═══════════════════════════════════════════════"

# ============================================================
# PART A: 基础邀请 + 事务原子性 + 后端 invite_url
# ============================================================
echo ""
echo "📋 PART A: 基础邀请 + 事务原子性"

INVITER_EMAIL="a-inviter-$SUFFIX@test.com"
INVITER_DEVICE="a-inviter-device-$SUFFIX"
register_user "$INVITER_EMAIL" "" > /dev/null
login_user "$INVITER_EMAIL" "/tmp/cookie-a.txt" > /dev/null
STATS_A=$(get_stats "/tmp/cookie-a.txt")
INVITER_CODE=$(echo "$STATS_A" | python3 -c "import sys,json; print(json.load(sys.stdin).get('invite_code',''))")
INVITE_URL=$(echo "$STATS_A" | python3 -c "import sys,json; print(json.load(sys.stdin).get('invite_url',''))")
[ -n "$INVITER_CODE" ] && pass "A1: 邀请人 invite_code=$INVITER_CODE" || fail "A1: 邀请人没拿到 invite_code"
echo "$INVITE_URL" | grep -q "?invite=$INVITER_CODE" && pass "A2: 后端 invite_url=$INVITE_URL" || fail "A2: invite_url 错：$INVITE_URL"

# 注册被邀请人 1（不同 device/IP）
INVITEE1_EMAIL="a-invitee1-$SUFFIX@test.com"
INVITEE1_DEVICE="a-invitee1-device-$SUFFIX"
register_user "$INVITEE1_EMAIL" ",\"invite_code\":\"$INVITER_CODE\"" > /dev/null

STATS1=$(get_stats "/tmp/cookie-a.txt")
TOTAL_INV=$(echo "$STATS1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('summary',{}).get('total_invites',0))")
[ "$TOTAL_INV" = "1" ] && pass "A3: 邀请人 total_invites=1" || fail "A3: total_invites=$TOTAL_INV"

# 事务原子性：邀请人拿 registration_ask + 被邀请人拿 invitee_three_spread
A_INVITER_REWARDS=$(echo "$STATS1" | python3 -c "import sys,json; print(','.join(sorted([r['reward_type'] for r in json.load(sys.stdin).get('rewards',[])])))")
echo "$A_INVITER_REWARDS" | grep -q "registration_ask" && pass "A4: 邀请人拿到 registration_ask" || fail "A4: 缺 registration_ask"

# 被邀请人的奖励（查 DB）
INVITEE1_REW=$(sql_query "const r = db.prepare(\"SELECT GROUP_CONCAT(reward_type) AS t FROM invite_rewards WHERE user_id = (SELECT id FROM users WHERE email = '$INVITEE1_EMAIL')\").get(); console.log(r.t || '');")
echo "$INVITEE1_REW" | grep -q "invitee_three_spread" && pass "A5: 被邀请人拿到 invitee_three_spread" || fail "A5: 缺 invitee_three_spread（DB: $INVITEE1_REW）"

# ============================================================
# PART B: Yes/No 自动 mark effective（修 require() bug 验证）
# ============================================================
echo ""
echo "📋 PART B: Yes/No 自动 mark effective action"

login_user "$INVITEE1_EMAIL" "/tmp/cookie-b1.txt" > /dev/null
curl -s -b "/tmp/cookie-b1.txt" -X POST "$BASE/yes-no/draw" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $INVITEE1_DEVICE" \
  -d "{\"question\":\"测试\",\"device_id\":\"$INVITEE1_DEVICE\"}" > /dev/null

STATS_B=$(get_stats "/tmp/cookie-a.txt")
EFFECTIVE=$(echo "$STATS_B" | python3 -c "import sys,json; print(json.load(sys.stdin).get('summary',{}).get('effective_count',0))")
[ "$EFFECTIVE" -ge "1" ] && pass "B1: Yes/No 后 effective_count=$EFFECTIVE" || fail "B1: effective_count=$EFFECTIVE"

# ============================================================
# PART C: Milestone 满 3 人（修 require() bug 验证）
# ============================================================
echo ""
echo "📋 PART C: Milestone 满 3 人里程碑"

for i in 2 3; do
  EMAIL="c-invitee$i-$SUFFIX@test.com"
  DEVICE="c-device$i-$SUFFIX-uniq"
  register_user "$EMAIL" ",\"invite_code\":\"$INVITER_CODE\"" > /dev/null
  # SQL helper: 改 device_id 为唯一值（绕过同 device 防刷）
  sql_query "db.prepare(\"UPDATE invites SET device_id = ? WHERE invitee_email = ?\").run('$DEVICE', '$EMAIL'); console.log('ok');"
  # Yes/No 触发 mark effective
  login_user "$EMAIL" "/tmp/cookie-c$i.txt" > /dev/null
  curl -s -b "/tmp/cookie-c$i.txt" -X POST "$BASE/yes-no/draw" \
    -H "Content-Type: application/json" \
    -H "X-Device-Id: $DEVICE" \
    -d "{\"question\":\"测试$i\",\"device_id\":\"$DEVICE\"}" > /dev/null
done

STATS_C=$(get_stats "/tmp/cookie-a.txt")
MILESTONE=$(echo "$STATS_C" | python3 -c "import sys,json; print(json.load(sys.stdin).get('summary',{}).get('milestone_reached',False))")
[ "$MILESTONE" = "True" ] && pass "C1: 满 3 人触发 milestone=True" || fail "C1: milestone=$MILESTONE"

REWARDS_C=$(echo "$STATS_C" | python3 -c "import sys,json; print(','.join(sorted(set([r['reward_type'] for r in json.load(sys.stdin).get('rewards',[])]))))")
echo "$REWARDS_C" | grep -q "milestone_ten" && pass "C2: 拿到 milestone_ten" || fail "C2: 缺 milestone_ten"
echo "$REWARDS_C" | grep -q "milestone_ask" && pass "C3: 拿到 milestone_ask" || fail "C3: 缺 milestone_ask"

# ============================================================
# PART D: Magic Link 路径邀请关联
# ============================================================
echo ""
echo "📋 PART D: Magic Link 路径邀请关联"

INVITER2_EMAIL="d-inviter2-$SUFFIX@test.com"
register_user "$INVITER2_EMAIL" "" > /dev/null
login_user "$INVITER2_EMAIL" "/tmp/cookie-d.txt" > /dev/null
INVITER2_CODE=$(curl -s -b /tmp/cookie-d.txt "$BASE/invites/me" | python3 -c "import sys,json; print(json.load(sys.stdin).get('invite_code',''))")
[ -n "$INVITER2_CODE" ] && pass "D1: inviter2 invite_code=$INVITER2_CODE" || fail "D1: inviter2 没拿到 invite_code"

ML_EMAIL="d-mlink-$SUFFIX@test.com"
ML_RES=$(curl -s -X POST "$BASE/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ML_EMAIL\",\"purpose\":\"login\",\"invite_code\":\"$INVITER2_CODE\"}")
echo "  magic-link 响应: $ML_RES"

# 验证 magic_url 含 invite_code
echo "$ML_RES" | grep -q "invite_code=$INVITER2_CODE" && pass "D2: magic_url 含 invite_code 参数" || fail "D2: magic_url 不含 invite_code"

ML_TOKEN=$(sql_query "const r = db.prepare(\"SELECT token FROM magic_links WHERE email = ? ORDER BY created_at DESC LIMIT 1\").get('$ML_EMAIL'); console.log(r ? r.token : '');")
[ -n "$ML_TOKEN" ] && pass "D3: 拿到 magic_link token" || fail "D3: 没拿到 token"

# verify 带 invite_code
VERIFY_RES=$(curl -s "$BASE/auth/verify?token=$ML_TOKEN&purpose=login&invite_code=$INVITER2_CODE")
echo "  verify 响应: $VERIFY_RES"
echo "$VERIFY_RES" | grep -q '"ok":true' && pass "D4: verify 成功" || fail "D4: verify 失败"

# 检查 inviter2 拿到注册奖励
STATS_D=$(get_stats "/tmp/cookie-d.txt")
REWARDS_D=$(echo "$STATS_D" | python3 -c "import sys,json; print(json.load(sys.stdin).get('summary',{}).get('total_rewards',0))")
[ "$REWARDS_D" -ge "1" ] && pass "D5: Magic Link 关联后 inviter2 拿到 $REWARDS_D 个奖励" || fail "D5: rewards=$REWARDS_D"

# ============================================================
# PART E: 防刷回归
# ============================================================
echo ""
echo "📋 PART E: 防刷回归"

# E1: 不同 device + 不同 IP → 应允许（spam 不该被拦）
SPAM_EMAIL="e-spam-$SUFFIX@test.com"
SPAM_DEVICE="e-spam-device-$SUFFIX"
register_user "$SPAM_EMAIL" ",\"invite_code\":\"$INVITER_CODE\"" > /dev/null

STATS_E1=$(get_stats "/tmp/cookie-a.txt")
TOTAL_E1=$(echo "$STATS_E1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('summary',{}).get('total_invites',0))")
[ "$TOTAL_E1" = "4" ] && pass "E1: 不同 device/IP 允许 total=4" || fail "E1: total=$TOTAL_E1（应=4）"

# E2: 同 device → 应被防刷（必须用与 invitee1 完全相同的 device_id 格式）
SPAM2_EMAIL="e-spam2-$SUFFIX@test.com"
# register_user() 传的 X-Device-Id 是 "device-${email}"，所以 INVITEE1 注册时 DB 里存的 device_id = "device-${INVITEE1_EMAIL}"
SPAM2_DEVICE="device-${INVITEE1_EMAIL}"
curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $SPAM2_DEVICE" \
  -H "X-Forwarded-For: 10.99.99.99" \
  -d "{\"email\":\"$SPAM2_EMAIL\",\"password\":\"TestPass123\",\"invite_code\":\"$INVITER_CODE\"}" > /dev/null

STATS_E2=$(get_stats "/tmp/cookie-a.txt")
TOTAL_E2=$(echo "$STATS_E2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('summary',{}).get('total_invites',0))")
[ "$TOTAL_E2" = "4" ] && pass "E2: 同 device 防刷生效 total=4（spam2 被拦）" || fail "E2: total=$TOTAL_E2（应=4）"

# ============================================================
# 总结
# ============================================================
echo ""
echo "═══════════════════════════════════════════════"
echo "📊 E2E 测试总结"
echo "  通过: $PASS"
echo "  失败: $FAIL"
if [ $FAIL -eq 0 ]; then
  echo "  🎉 全部通过"
else
  echo "  ⚠️ 有失败项"
fi
echo "═══════════════════════════════════════════════"