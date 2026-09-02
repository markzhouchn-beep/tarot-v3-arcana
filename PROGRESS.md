# v3.0 进度追踪

## 2026-09-01 · v3.0 重新开发（19:27 Mark 拍板重启）

**背景**：
- 19:21 第一次 v3 删除（4 是 + 美术扎实先 → 一口气补完 → Mark 收回）
- 19:27 Mark 决定重启，明确："不是 v2 改进，但 v2 美术 / 问题 / 卡片生成可复用"

**这一波心跳范围（Phase 0 后端骨架）**：
- 后端：13 张表 + 11 路由 + 11 lib + 2 middleware + server.js + db.js
- 前端：仅 1 个健康检查页
- 文档：PD 归档 + README + KNOWN_ISSUES + PROGRESS
- E2E：test_e2e.sh 8 步

**不做**（吸取上次教训）：
- 前端 13 页面（Phase 1）
- 美术细节（Phase 1，沿用 v2.0 美术 tokens）
- 业务逻辑细节（Yes/No 牌意库具体内容、AI prompt 具体文本）— 用占位
- 阿里云部署（Mark 拍板才动）

---

## Phase 0 任务清单

| # | 任务 | 状态 |
|---|---|---|
| 1 | PD v0.8 归档 | ✅ 完成 |
| 2 | v3 工作区重建 | ✅ 完成 |
| 3 | schema.sql（13 表） | ✅ 完成 |
| 4 | db.js（SQLite 封装） | ✅ 完成 |
| 5 | server.js（Express 入口） | ✅ 完成 |
| 6 | lib/config.js | ✅ 完成 |
| 7 | lib/ai.js（MiniMax） | ✅ 完成（占位） |
| 8 | lib/safety.js | ✅ 完成（占位） |
| 9 | lib/quota.js | ✅ 完成（占位） |
| 10 | lib/afdian.js | ✅ 完成（含 mock） |
| 11 | lib/prompts.js | ✅ 完成（占位） |
| 12 | lib/tarot-knowledge.js | ✅ 完成（占位） |
| 13 | lib/mailer.js | ✅ 完成（占位） |
| 14 | middleware/auth.js | ✅ 完成 |
| 15 | middleware/quota-guard.js | ✅ 完成（占位） |
| 16 | routes/health.js | ✅ 完成 |
| 17 | routes/auth.js | ✅ 完成 |
| 18 | routes/orders.js | ✅ 完成 |
| 19 | routes/membership.js | ✅ 完成 |
| 20 | routes/oracle.js | ✅ 完成（占位） |
| 21 | routes/yes-no.js | ✅ 完成（占位） |
| 22 | routes/readings.js | ✅ 完成 |
| 23 | routes/spreads.js | ✅ 完成 |
| 24 | routes/afdian-webhook.js | ✅ 完成 |
| 25 | routes/admin.js | ✅ 完成（占位） |
| 26 | scripts/init_db.sh | ✅ 完成 |
| 27 | scripts/migrate_v2_to_v3.py | ✅ 完成 |
| 28 | scripts/test_e2e.sh | ✅ 完成 |
| 29 | 前端骨架（健康检查页） | ✅ 完成 |
| 30 | 本地启动验证 | ✅ 完成（10 步全过）|
| 31 | 阿里云部署 | ❌ 不动（最高优先级规则）|

---

## 🎉 Phase 1 第一波：前端 4 个页面骨架完成（23:14-23:20 · 6 分钟）

### 本轮交付
- `/` Hero 首页（品牌 + Yes/No + 4 主题牌阵 + 会员 + Oracle）
- `/spreads` 牌阵选择（4 主题 Tabs + 预览锁模式 + 13 牌阵渲染）
- `/yes-no` Yes/No 免费抽（device_id · 配额 · 抽牌 · 三种结果样式）
- `/auth` 登录/注册（Magic Link + 邮箱密码双轨 UI）

### 复用资产
- v2.0 完整 design tokens（颜色/字体/spacing/keyframes）
- Cormorant Garamond + Cinzel + Tangerine + Inter · Google Fonts
- 后端全面复用（API · Schema）

### 验证
- TS 0 错误 · 4 页面 HTTP 200 · Vite proxy 转发 OK
- Yes/No 闭环真实跑通 · 局域网手机可看

### 文件清单
- components/: Layout · ScreenHeader · Button · CardFace · PreviewLock（5 个）
- screens/: Hero · Spreads · YesNo · Auth（4 个）+ App.tsx 路由
- lib/api.ts · index.css · tailwind.config.js · index.html

### 下一步（等 Mark review）
- Phase 1.5：/ask /draw /spread /reading（抽牌动画 + 牌阵展示 + 解读页）
- Phase 1.6：/oracle /dashboard /membership /checkout /loading

### 文件清单（共 49 个文件）
- 后端：30 个文件（package.json + .env.example + ecosystem + db.js + server.js + 8 lib + 2 middleware + 10 routes）
- 前端：10 个文件（仅健康检查页 + API 客户端 + 主题色变量）
- 脚本：4 个（init_db / test_e2e / deploy_v3 / migrate_v2_to_v3）
- 文档：4 个（README / PROGRESS / KNOWN_ISSUES / PRODUCT_SPEC）

### 验证结果
- ✅ 数据库初始化（15 张表）
- ✅ npm install 77 依赖
- ✅ 服务启动（端口 3003，PID 12428）
- ✅ E2E 10 步全过（health / spreads / orders / yes-no / quota / magic-link / oracle 401 / preset / membership）

### 本地服务（仍在跑）
- 后端 PID 12428：http://localhost:3003
- 日志：/tmp/tarot-v3-server.log
- 验证：curl http://localhost:3003/api/health

---

## 等 Mark 拍板

- [ ] Phase 1 排期（前端 13 页面）
- [ ] v2.0 数据迁移范围（哪些用户需要迁移）
- [ ] 爱发电订阅方案后台创建（Mark 手工，4 个 plan + 3 个 sku）
