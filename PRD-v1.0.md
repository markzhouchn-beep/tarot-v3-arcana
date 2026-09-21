# 星语塔罗 ARCANA ai v3.0 · 产品需求文档 v1.0

> 版本：1.0（正式上线版）
> 更新：2026-09-21
> 作者：Mark Zhou

---

## 一、产品愿景

**一句话定位：** 一款面向华语用户的 AI 塔罗解读工具，通过有仪式感的抽牌体验 + 精准的 AI 解读 + 低门槛付费（月卡 ¥19.9 或单次 ¥1.9）实现商业化。

**核心差异化：**
- 仪式感：Draw 动画 + 牌阵视觉 + 心理占卜氛围
- AI 解读质量：MiniMax M2 模型，结构化三段式解读
- 支付门槛低：¥1.9 单次起，无强制订阅
- 本地化支付：支付宝 + PayPal 双轨，覆盖中国大陆 + 港澳台 + 海外华人

---

## 二、核心用户路径

```
首页 → 选牌阵 → Ask（提问）→ Draw（动画抽牌）→ Spread（展示牌阵 + 付费墙）→ 支付 → Reading（AI 解读）
                                                                      ↓
                                                            追问（Oracle）
```

---

## 三、支付系统 v1.0（本次核心）

### 3.1 支付方式

| 渠道 | 场景 | 货币 | 状态 |
|------|------|------|------|
| **支付宝手机网站支付** | CN/HK/MO 用户 | CNY | ✅ 已上线（正式） |
| **PayPal** | 全球用户 | 多币种 | ✅ 已上线 |
| 爱发电 | 会员订阅（原路径） | CNY | ⚠️ 维护态，新用户走支付宝 |

### 3.2 支付流程

```
用户选牌阵 → Ask 页提问 → orders/create（含 payment_method）
  ↓
Draw 动画 → Spread 页展示牌阵 + 付费墙
  ↓                    ↓                    ↓
会员/免费 → 直接 paid  AI 解读    需付费 → 显示支付按钮
                                            ↓
                              支付宝 → 跳转 alipay wap 支付页
                                    ↓ 支付完成
                              alipay return → 回到 Spread
                                    alipay notify → 后端标记 paid
                              PayPal → 跳转 PayPal 收银台
                                    ↓ 支付完成
                              PayPal return → capture → 标记 paid
```

### 3.3 支付状态机

```
pending → paid → interpreted
           ↓
       cancelled（用户取消）
       expired（超时未付，15min）
       refunded（退款，手动）
```

### 3.4 四层支付防御（防漏单）

| 层级 | 机制 | 路径 |
|------|------|------|
| L1 | 支付渠道异步回调 | 支付宝 notify / PayPal webhook |
| L2 | PayPal 浏览器回跳 | `/paypal/return` → capture |
| L3 | 用户主动查询 | Spread 页"我已支付·重新核实" |
| L4 | 定时对账 | 每小时任务，扫描 pending 订单 |

### 3.5 定价

| 牌阵 | 价格 | 追问配额 |
|------|------|---------|
| 单张 Yes/No | ¥1 | 3 次 |
| 三张牌阵 | ¥1.9 | 5 次 |
| 十张凯尔特 | ¥9.9 | 5 次 |
| 首单免费 | love-single 首次 0 | 3 次 |
| 会员月卡 | ¥19.9/月 | 每日 3 次 Yes/No + 5 次追问 |
| 会员年卡 | ¥199/年 | 每日 3 次 Yes/No + 5 次追问 + 全部高级牌阵 |

---

## 四、现有代码 Review（2026-09-21）

### 4.1 🔴 Critical（上线前必须修复）

#### CR-01：PayPal Webhook 签名验证未启用
**文件：** `server/routes/paypal.js:146-170`
**问题：** Webhook 处理函数完全跳过了 `verifyPaypalWebhook()` 验签。任何人可以伪造 `PAYMENT.CAPTURE.COMPLETED` 事件，绕过支付直接标记订单为已付款。
**触发：** `POST /api/paypal/webhook` 收到任意 payload 即可
**影响：** 极高 — 支付绕过后黑客免费获取解读
**修复：** 在 webhook 函数开头调用 `await verifyPaypalWebhook(req)`，捕获失败则返回 400

#### CR-02：PayPal capture 后写入不存在的列 `paypal_capture_id`
**文件：** `server/routes/paypal.js:116`
**问题：** `orders` 表 schema 无 `paypal_capture_id` 列，UPDATE 语句在 SQLite 静默失败（无法写入不存在的列）。PayPal 收款后 `paid_amount` 同样通过子查询写入但列也不存在。
**触发：** 用户完成 PayPal 支付，回跳时执行 capture
**影响：** 高 — PayPal 订单的 capture_id 和 paid_amount 永远无法写入数据库
**修复：** 补充 migrations：`ALTER TABLE orders ADD COLUMN paypal_capture_id VARCHAR(64)`；`ALTER TABLE orders ADD COLUMN paid_amount DECIMAL(8,2)`

#### CR-03：支付宝 `return_url` 参数格式错误
**文件：** `server/routes/orders.js:204`
**问题：** `returnUrl` 被设成多个逗号分隔 URL：`https://www.tarotbox.cn,https://tarotbox.cn,...`。支付宝规范只支持单个 URL，且逗号在 URL encode 后仍为逗号，会导致参数解析错误。
**触发：** 用户在支付宝完成支付后，支付宝取第一个 URL 作为跳转目标
**影响：** 中 — 支付宝回跳可能指向错误地址（正式站 vs 测试站）
**修复：** 只传一个 return_url，建议：`${proto}://${host}/?pay_method=alipay`，其中 host 从请求 header 动态获取

#### CR-04：爱发电 Webhook 强制 RSA 验签被 MD5 绕过
**文件：** `server/routes/afdian-webhook.js:63`
**问题：** 验签逻辑中，RSA 验证失败后 fallback 到 MD5 校验。爱发电生产环境应强制 RSA，不应降级。
**触发：** 爱发电 webhook 以 MD5 签名送达（生产环境不应如此）
**影响：** 中 — 伪造 webhook 成本降低
**修复：** 移除 MD5 fallback，在 RSA 失败时直接 reject 并记录日志

### 4.2 🟡 High（上线前应修复）

#### HI-01：IP 地理位置 API 使用 HTTP + 无缓存
**文件：** `server/lib/geo.js:70`，`web/src/lib/api.ts`
**问题：** `http://ip-api.com/json/`（HTTP，明文），可被 ISP 篡改或缓存投毒。同时前端 `detectCountry()` 也调用 ipapi.co，IP 检测结果无签名验证。
**影响：** 中 — 货币推荐可能错误，用户看到错误的支付按钮
**修复：** 切换到 HTTPS：`https://ip-api.com/json/`；或服务端统一检测，前端不再重复调用

#### HI-02：前端 Admin Basic Auth 存储在 localStorage 明文
**文件：** `web/src/lib/api.ts:238-248`
**问题：** `btoa(username:password)` 未经加密，XSS 可直接读取。
**影响：** 中 — 攻击者 XSS 后可获取 admin 权限
**修复：** 将 admin token 改为 HttpOnly Cookie，或使用后台专门 session 而非 Basic Auth

#### HI-03：追问配额中间件未实际扣减
**文件：** `server/middleware/quota-guard.js`
**问题：** 中间件只查询配额，未执行 increment。实际扣减在 `routes/oracle.js` 里，导致两个代码路径存在不一致风险。
**影响：** 中 — 如果 oracle 路由被直接调用绕过中间件，配额形同虚设
**修复：** 统一在 `oracle/ask` 路由处理配额，移除 `quota-guard.js` 中间件

#### HI-04：`crypto.randomUUID()` 未 import
**文件：** `server/lib/quota.js`
**问题：** 文件使用 `crypto.randomUUID()` 但未 `import crypto from 'node:crypto'`，运行时抛出 `ReferenceError`。
**触发：** 任何调用 `incrementQuota()` 的路径
**影响：** 中 — 配额自增功能完全不可用

#### HI-05：Alipay 沙箱/正式切换依赖字符串比较
**文件：** `server/lib/alipay.js`
**问题：** `config.ALIPAY_SANDBOX === '1'` 用字符串比较，`.env` 未设置时为 undefined，逻辑可能误判。
**影响：** 低 — 配置错误时可能意外走沙箱
**修复：** 使用 Boolean 或默认值：`sandbox: String(config.ALIPAY_SANDBOX ?? '0') === '1'`

### 4.3 🟠 Medium（计划迭代修复）

#### ME-01：支付宝回跳路径与 Spread 状态读取存在竞态
**文件：** `web/src/screens/Spread.tsx:63-74`
**问题：** PayPal 回跳后重新拉订单（覆盖本地 state），但 Alipay return 直接回跳首页，Spread 页是无状态刷新，无兜底轮询。
**影响：** 中 — Alipay 支付完成后回到首页，用户需要重新进入 Spread 页才能解锁
**修复：** Spread 页 mounted 时检查 URL 参数 `pay_method=alipay`，触发主动 reconcile 查询

#### ME-02：AI 输出内容安全检查未实现
**文件：** `server/lib/safety.js:checkOutput()`
**问题：** Phase 1 TODO，至今为占位函数，直接返回 true。
**影响：** 中 — AI 可能输出违禁内容（医疗建议/政治/自杀等）
**修复：** 实现关键词 + 正则过滤，关键违禁词直接拒绝并重试（最多 3 次）

#### ME-03：续费提醒邮件未实现
**文件：** `server/lib/mailer.js:sendRenewalReminder()`
**问题：** Phase 2 TODO，`scheduler.js` 里调用但函数体为空。
**影响：** 低 — 会员到期无提醒，续费率下降
**修复：** 实现 nodemailer 邮件发送，Sierra/Leo 模板

#### ME-04：PayPal 退款流程未实现
**文件：** `server/routes/admin.js`
**问题：** admin 后台无退款按钮，用户联系客服后需手动操作数据库。
**影响：** 低 — 客服成本增加
**修复：** admin 页增加"退款"按钮，调用 PayPal Refund API

#### ME-05：订单列表 Dashboard 未返回 payment_method
**文件：** `server/routes/orders.js:288-312`
**问题：** `GET /api/orders` 的 SQL 未 select `payment_method`，前端 Dashboard 无法显示支付渠道。
**影响：** 低 — 用户无法区分支付宝/PayPal 订单
**修复：** SQL 增加 `payment_method` 列

### 4.4 🟢 已实现且良好

- ✅ 支付幂等表（`webhook_idempotency`）防重复回调
- ✅ bcrypt 密码加密（cost=12）
- ✅ 账户锁定（5 次/15 分钟）
- ✅ Session 数据库持久化（重启不丢）
- ✅ Fisher-Yates 洗牌算法
- ✅ `normalizePrivateKey` 支持无 PEM 头密钥（本次修复）
- ✅ Alipay returnUrl 动态协议（本次修复）
- ✅ 数据库幂等保护（webhook_idempotency 表）
- ✅ `trust-paid` 已废弃（四层防御替代）

---

## 五、PRD v1.0 功能清单

### 5.1 已上线功能

| 功能 | 模块 | 优先级 |
|------|------|--------|
| 首页 + 牌阵选择 | Frontend | P0 |
| Ask 提问页 | Frontend | P0 |
| Draw 抽牌动画 | Frontend | P0 |
| Spread 牌阵展示 + 付费墙 | Frontend | P0 |
| Reading AI 解读 | Frontend | P0 |
| 支付宝手机网站支付 | Backend | P0 |
| PayPal 支付 | Backend | P0 |
| Magic Link 登录 | Backend | P0 |
| 邮箱密码登录 | Backend | P0 |
| 6 位验证码登录 | Backend | P0 |
| 会员订阅（爱发电） | Backend | P1 |
| Yes/No 免费抽 | Frontend | P1 |
| Oracle 追问 | Frontend | P1 |
| 社区精选追问 | Frontend | P2 |
| 78 张牌意库 | Frontend | P2 |
| 邀请奖励系统 | Backend | P2 |
| Admin 后台 | Frontend | P2 |
| 定时任务（过期订阅/续费提醒） | Backend | P2 |

### 5.2 待实现功能

| 功能 | 模块 | 状态 |
|------|------|------|
| AI 输出安全检查 | Backend | TODO |
| 续费提醒邮件 | Backend | TODO |
| PayPal 退款 | Backend | TODO |
| PayPal Webhook 验签 | Backend | **CR-01，需修复** |
| 订单 Dashboard payment_method 字段 | Frontend | TODO |
| 分享卡片生成 | Frontend | TODO |
| 会员风控（同一设备多注册检测） | Backend | TODO |

---

## 六、技术债务

### 6.1 数据库迁移缺失

**问题：** `scripts/schema.sql` 定义了 15 张表共 50+ 列，但服务器数据库实际列数不足。部分列通过之前对话中的 `ALTER TABLE` 手动补充，未形成脚本。

**必须补充的列（服务器当前 DB 已有但 schema 未更新的）：**
- `orders.payment_method`
- `orders.paypal_order_id`
- `orders.afdian_plan_id`
- `orders.ai_error`

**必须补充的列（代码引用但 DB 缺失的）：**
- `orders.paypal_capture_id` ← **CR-02**
- `orders.paid_amount` ← **CR-02**

**行动：** 写 `scripts/migrate-paypal-columns.sql`，部署后执行。

### 6.2 前端构建产物部署流程

当前通过 `scp` 手动上传 `dist/`，无版本回滚能力。

**建议：** 接入 GitHub Actions，tag push 自动部署到测试站，main merge 自动部署到正式站。

---

## 七、测试验收标准（上线 Checkpoint）

### 支付流程（核心路径）

- [ ] 支付宝：选三张牌阵 → 提问 → 抽牌 → Spread → 点"跳转支付宝" → 支付宝支付 → 回跳 Spread → 解锁解读
- [ ] PayPal：选三张牌阵 → 提问 → 抽牌 → Spread → 点"跳转 PayPal" → PayPal 支付 → 回跳 Spread → 解锁解读
- [ ] 会员跳过支付直接进入解读
- [ ] 首单免费直接进入解读
- [ ] Spread 页刷新后仍能识别订单状态
- [ ] "我已支付·重新核实"按钮能查到支付宝已支付订单

### 安全

- [ ] PayPal webhook 收到伪造 payload 返回 400
- [ ] 支付宝 notify 验签失败不处理订单
- [ ] 无爱发电 RSA 公钥时不 fallback 到 MD5

### 功能回归

- [ ] Yes/No 免费抽正常工作
- [ ] Oracle 追问正常工作（有配额）
- [ ] 登录/注册/找回密码流程正常
- [ ] Admin 后台可查看订单列表

---

## 八、上线后监控指标

| 指标 | 目标 |
|------|------|
| 支付宝支付转化率 | > 60% |
| PayPal 支付转化率 | > 50% |
| 漏单率（72h 内未完成支付） | < 5% |
| AI 解读成功率 | > 95% |
| 平均解读生成时间 | < 30s |
| 支付宝 webhook 到达率 | 100%（配置 notify_url） |
| PayPal webhook 到达率 | 100%（配置 webhook ID） |

---

## 九、Roadmap 建议

### v1.1（支付稳定后）
- 分享卡片生成 + 社交分享
- 会员体系完善（积分、等级称号）
- 数据分析看板（admin）

### v1.2
- PayPal 退款流程
- 邮件订阅（周运势推送）
- 深度学习用户行为，优化转化

### v1.3
- 小程序版本（微信内直接支付）
- 多语言（英语、日语）
- API 开放（给第三方博主）

---

*文档版本历史：*
- v0.8 — 支付方式重构，新增支付宝 + PayPal 双轨（2026-09-07）
- v0.9 — 代码 review 初稿（2026-09-15）
- **v1.0 — 正式上线版，整合 code review 修复项，明确技术债务和测试标准（2026-09-21）**
