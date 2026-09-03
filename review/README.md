# C 方案 Review 包 · v3.0.1 Magic Link 改造

**目录**：`~/Desktop/tarot-app/v3/_review/v3.0.1-magic-link-redesign/`

## 1 分钟说明

**问题**：magic link 在手机上切不回浏览器 + 用户永远没密码
**方案**：6 位验证码 → 验证通过 → 强制设密码 → 登录
**找回密码**：走同一套码验证（type=reset），但落「重置密码」分支

## 4 个决策点（先看这里）

| # | 决策点 | 我的选择 | 备选 |
|---|--------|---------|------|
| **1** | 验证码位数 | 6 位数字 | 8 位字母数字 |
| **2** | 有效期 | 10 分钟 | 5 / 15 |
| **3** | 限流 | 5 次/小时 | 3 / 10 |
| **4** | 旧 `/auth/magic-link` 路由 | 保留 30 天兜底 | 立刻删 |

## 文件清单（按 review 顺序看）

```
01_DB_migration.sql          DB 新表
02_lib_magic-code.js         后端工具：生成/验证/限流
03_lib_email-templates.js    邮件 HTML 模板
04_routes_auth_changes.md    4 个新 endpoint（diff 形式）
05_lib_api_additions.md      前端 4 个新方法（diff 形式）
06_AuthCode.tsx              新页面 - 验证码登录
07_AuthSetPassword.tsx       新页面 - 强制设密码
08_AuthForgot.tsx            新页面 - 忘记密码
09_Auth_changes.md           加 2 个入口（diff 形式）
10_App_changes.md            加 3 个路由（diff 形式）
```

## 部署顺序（review 通过后我执行）

1. 跑 `01_DB_migration.sql`（含 magic_codes + temp_tokens 表）
2. 复制 `02` `03` `04` 到 server/ → rsync → PM2 reload
3. 复制 `05` `06` `07` `08` `09` `10` 到 web/src/ → build → rsync → 修权限
4. curl 跑 6 个测试场景
5. 30 天后再删 `/auth/magic-link`

## 测试矩阵（部署后我会跑）

- [ ] 新用户：邮箱 → 收码 → 输入 → 设密码 → 登录
- [ ] 老用户（有密码）：邮箱 → 收码 → 输入 → set-password → 自动登录
- [ ] 老用户（无密码）：邮箱 → 收码 → 输入 → 设密码
- [ ] 忘记密码：邮箱 → 收重置码 → 输入 + 新密码 → 重置 → 重登
- [ ] 错误码 5 次 → 验证码失效
- [ ] 限流 5 次/小时 → 第 6 次 429
