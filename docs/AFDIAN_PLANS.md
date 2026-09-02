# 爱发电方案配置（v3.0 上线必做）

## 📋 任务清单（Mark 在 afdian.com/dashboard/dev 手工建）

### 单次解读商品方案（3 个）
| 档位 | 原价 | 现价 | 爱发电 plan_id | 后端常量 |
|---|---|---|---|---|
| 单张 | ¥5 | ¥1.9 | `PENDING_LITE` | `TIER_AMOUNT.lite` |
| 三张 | ¥10 | ¥3.9 | `PENDING_CLASSIC` | `TIER_AMOUNT.classic` |
| 十张 | ¥29.9 | ¥9.9 | `PENDING_DEEP` | `TIER_AMOUNT.deep` |

### 订阅方案（4 个）
| 方案 | 价格 | 周期 | 爱发电 plan_id | 后端常量 |
|---|---|---|---|---|
| 银月-月 | ¥19.9 | 30 天 | `PENDING_SILVER_M` | `MEMBERSHIP_PRICES.silver_month` |
| 银月-年 | ¥199 | 365 天 | `PENDING_SILVER_Y` | `MEMBERSHIP_PRICES.silver_year` |
| 金月-月 | ¥39.9 | 30 天 | `PENDING_GOLD_M` | `MEMBERSHIP_PRICES.gold_month` |
| 金月-年 | ¥399 | 365 天 | `PENDING_GOLD_Y` | `MEMBERSHIP_PRICES.gold_year` |

## 配置步骤

### 1. 在爱发电后台建方案
1. 登录 https://afdian.com/dashboard/dev
2. 进入「商品方案」→ 3 个单次解读（product_type=1）
3. 进入「订阅方案」→ 4 个订阅（product_type=0）
4. **记下每个方案的 plan_id**（如 `abc123def456`）

### 2. 把 plan_id 填到 .env
```bash
# .env (生产环境)
AFDIAN_PLAN_LITE=abc123def456
AFDIAN_PLAN_CLASSIC=ghi789jkl012
AFDIAN_PLAN_DEEP=mno345pqr678
AFDIAN_PLAN_SILVER_M=stu901vwx234
AFDIAN_PLAN_SILVER_Y=yz0567abc890
AFDIAN_PLAN_GOLD_M=def123ghi456
AFDIAN_PLAN_GOLD_Y=jkl789mno012
```

### 3. Webhook URL（在爱发电后台填）
```
https://tarot-v3.layershop.store/api/afdian/webhook
```

## 后端 plan_external_id 对照

`server/routes/orders.js` 和 `server/routes/afdian-webhook.js` 已按 plan_external_id 判定：

```javascript
const PLAN_MAPPING = {
  [process.env.AFDIAN_PLAN_LITE]: { tier: 'single', spread_type: 'one_card', amount: 1.9 },
  [process.env.AFDIAN_PLAN_CLASSIC]: { tier: 'single', spread_type: 'three_card', amount: 3.9 },
  [process.env.AFDIAN_PLAN_DEEP]: { tier: 'single', spread_type: 'ten_card', amount: 9.9 },
  [process.env.AFDIAN_PLAN_SILVER_M]: { tier: 'silver', duration_days: 30, amount: 19.9 },
  [process.env.AFDIAN_PLAN_SILVER_Y]: { tier: 'silver', duration_days: 365, amount: 199 },
  [process.env.AFDIAN_PLAN_GOLD_M]: { tier: 'gold', duration_days: 30, amount: 39.9 },
  [process.env.AFDIAN_PLAN_GOLD_Y]: { tier: 'gold', duration_days: 365, amount: 399 },
};
```

## 上线检查清单

- [ ] 7 个方案在爱发电后台建好
- [ ] 7 个 plan_id 填到 .env
- [ ] Webhook URL 在爱发电后台配置（`https://tarot-v3.layershop.store/api/afdian/webhook`）
- [ ] 本地用 ngrok 测试 webhook 收到 → 用 `curl -X POST .../test-afdian-webhook` 模拟
- [ ] 真实下一单测试：付 ¥1.9 → 5 分钟内收到 paid=true → 解读生成

## ⚠️ 当前状态

**Mark 还没建方案**（红线圈外：需 Mark 决策 + 登录后台操作）

代码已就绪：
- `server/routes/afdian-webhook.js` 已扩展 product_type=0/1 判定
- `server/lib/orders.js` PLAN_MAPPING 已写（用 env 查 plan_external_id）
- `webhook_idempotency` 表防 v2 漏单 bug
- `trust_paid=1` reconcile 兜底（30 分钟未付订单自动确认）