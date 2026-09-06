-- ============================================================
-- magic_codes 表（v3.0.1 验证码登录支持）
-- 应用：2026-09-06
-- 原因：lib/magic-code.js 查询 magic_codes 表，但 schema.sql 未建
-- 与 magic_links 区别：magic_links 是「魔法链接（一次性 token）」
--                    magic_codes 是「6 位数字验证码（带 attempts 限流）」
-- ============================================================

CREATE TABLE IF NOT EXISTS magic_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL,            -- login / reset
    expires_at BIGINT NOT NULL,           -- unix 秒
    attempts INT DEFAULT 0,
    used_at BIGINT,
    created_at BIGINT DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_magic_codes_email ON magic_codes(email, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_magic_codes_expires ON magic_codes(expires_at);

-- ============================================================
-- magic_codes 迁移完成
-- ============================================================
