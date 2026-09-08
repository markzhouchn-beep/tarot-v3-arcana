# 星语塔罗 ARCANA v3.0 — Bug 问题报告

## 仓库地址
https://github.com/markzhouchn/tarot-v3-arcana

## 问题描述

### 问题一：YesNo 提问卡跳转异常（已修复但需验证）
**现象**：用户选"是/否"选项后，点击"获取指引"按钮，页面跳转到 `/ask/three` 但应该跳转到 `/ask/general-3`。

**涉及文件**：`client/src/pages/Ask/YesNo.tsx`

**根本原因**：跳转路径写死为 `/ask/three`，应为 `/ask/general-3`

**当前状态**：已修复，但需在生产环境验证

---

### 问题二：追问 Oracle 404 报错（已修复）
**现象**：用户完成一次抽牌后点击"追问 Oracle"，页面报错 404，API 请求失败。

**涉及文件**：
- `server/src/index.ts` — 路径 `/api/oracle/reading` vs `/api/tarot/oracle/reading`
- `client/src/utils/api.ts` — 路径 `/api/tarot/oracle/reading`
- `.env` — `DB_PATH` 使用相对路径导致 PM2 运行时路径错误

**根本原因**：
1. 服务端注册路由为 `/api/oracle/reading`
2. 客户端请求 `/api/tarot/oracle/reading`
3. 路径不匹配导致 404

**当前状态**：已修复，统一使用 `/api/oracle/reading`，`.env` 改用绝对路径

---

### 问题三：分享卡牌图不显示（已修复）
**现象**：生成塔罗分享图时，卡牌图片区域显示空白，图片加载失败。

**涉及文件**：`client/src/utils/shareCard.ts`

**根本原因**：Canvas 绘制网络图片时，图片尚未加载完成就开始绘制，导致白屏

**当前状态**：已修复，添加 `img.decode()` 等待图片解码完成

---

## 技术栈
- **前端**：React + TypeScript + Vite
- **后端**：Express + TypeScript
- **部署**：阿里云 + PM2 cluster mode
- **数据库**：SQLite

## 复现步骤（请 AI 检查）

1. 克隆仓库：`git clone https://github.com/markzhouchn/tarot-v3-arcana`
2. 安装依赖：`npm install`
3. 启动后端：`cd server && npm run dev`
4. 启动前端：`cd client && npm run dev`
5. 访问 `http://localhost:3000`

## 特别关注

请重点检查以下文件的逻辑是否正确：
1. `client/src/pages/Ask/YesNo.tsx` — YesNo 跳转逻辑
2. `server/src/index.ts` — 所有 API 路由定义
3. `client/src/utils/api.ts` — 所有 API 请求路径
4. `client/src/utils/shareCard.ts` — 图片加载逻辑
5. `.env` — 数据库路径配置

## 联系方式
项目负责人：Mark（Bo Zhou）
