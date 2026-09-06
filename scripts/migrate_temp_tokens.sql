-- ============================================================
-- temp_tokens 表（v3.0.1 验证码登录的 set-password 中转）
-- 应用：2026-09-06
-- 原因：lib/auth.js 在 verify-code 成功后写 temp_tokens，
--       set-password 路由读它来建立 session。但 schema.sql 未建。
-- 用途：验证码登录 / 密码重置 中转 token
-- ============================================================

CREATE TABLE IF NOT EXISTS temp_tokens (
    token VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    purpose VARCHAR(32) NOT NULL,            -- set-password / reset-password
    expires_at BIGINT NOT NULL,
    used_at BIGINT,
    created_at BIGINT DEFAULT (strftime('%s','now')*1000)
);

CREATE INDEX IF NOT EXISTS idx_temp_tokens_user ON temp_tokens(user_id, purpose, used_at);
CREATE INDEX IF NOT EXISTS idx_temp_tokens_expires ON temp_tokens(expires_at);

-- ============================================================
-- temp_tokens 迁移完成
-- ============================================================
