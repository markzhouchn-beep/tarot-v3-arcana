# v3.0 已知问题

## Phase 0 后端骨架阶段（已知）

### 占位实现（待 Phase 1+ 充实）

| 文件 | 占位内容 | Phase |
|---|---|---|
| `lib/tarot-knowledge.js` | 仅导出空架子，78 张牌意数据待 Phase 1 由塔罗专家写 | 1 |
| `lib/prompts.js` | AI prompt 模板为占位文本，主题化牌阵 prompt 待 Phase 1 写 | 1 |
| `lib/ai.js` | MiniMax API 调用已通，但「三层深度意图分类」待 Phase 3 实现 | 3 |
| `lib/safety.js` | 敏感词检测逻辑骨架已搭，具体词表 + fallback 文案待 Phase 1 补 | 1 |
| `lib/quota.js` | 配额接口签名已定，具体扣减逻辑待 Phase 3 实现 | 3 |
| `middleware/quota-guard.js` | 中间件框架已搭，闸门逻辑待 Phase 3 接入 | 3 |
| `routes/oracle.js` | 路由 + 参数校验已通，意图分类 + 三层深度 prompt 待 Phase 3 | 3 |
| `routes/admin.js` | 路由 + 鉴权已通，Mark 后台具体功能待 Phase 5 | 5 |

### v2.0 复用的潜在风险

- **MiniMax API 端点**：`https://api.minimaxi.com/anthropic`（沿用 v2.0）。如有变更高基线，需同步。
- **爱发电 query-order 端点**：v2.0 实测是 `afdian.com`（非 .net，文档 typo），已沿用。
- **session 存内存**：v2.0 用 `global.__sessions` Map，重启失效。**v3.0 暂保持**，Phase 2 切 Redis/DB。
- **bcrypt**：v3.0 新增依赖，cost=12（~250ms/hash），需 npm install 验证。

### 待 Mark 拍板

- [ ] **爱发电后台手工创建**：4 个订阅方案（银月月/年、金月月/年）+ 3 个商品方案（单张/三张/十张）— 拿到 plan_id / sku_id 后填 .env
- [ ] **阿里云部署**：本地 Phase 0 验证通过后，Mark 拍板才动服务器（同机 vs 新机）
- [ ] **数据迁移范围**：v2.0 哪些用户/订单/解读需要迁移到 v3.0
- [ ] **Magic Link 邮件模板**：v2.0 邮件文案可直接复用，Mark 确认
- [ ] **预设问题库**：Phase 3 启动前由塔罗专家写 20-30 条

### 测试覆盖缺口

- E2E 脚本（test_e2e.sh）只覆盖 8 步核心流程：
  1. 健康检查
  2. 创建订单（待支付）
  3. 模拟 webhook 标 paid
  4. 触发 AI 解读
  5. 解读详情查询
  6. Yes/No 免费抽（占位）
  7. Oracle 追问（占位）
  8. 会员订阅 webhook

  **未覆盖**：邮件发送、配额扣减、敏感词过滤、AI 成本统计（这些 Phase 3-5 再补）。

---

## 上次 v3 失败教训（避免重蹈）

来自 `~/Desktop/tarot-app/_backup_v2.0_20260830_1343/../memory/2026-09-01.md`：

1. ❌ 一口气补美术 + P1 内容 → 范围爆炸
2. ❌ 13 个 stub 页面 + 方案 A 重写 → 应该分开两次心跳做
3. ❌ Phase 0 后端完成后没立刻让 Mark 拍 Phase 1 排期 → 一路狂奔

**v3 重启版的应对**：
- ✅ 这一波心跳**只做 Phase 0 后端骨架**，前端 1 个健康检查页就停手
- ✅ 完成后给 Mark 审核清单 + Phase 1 排期讨论点，等 Mark 拍板才进 Phase 1
- ✅ 占位实现标注清楚（Phase X 充实），不假装完整
