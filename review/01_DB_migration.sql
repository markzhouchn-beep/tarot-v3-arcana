-- server/db/migrations/002_magic_codes.sql
-- 创建 magic_codes 表（6 位验证码）
-- 创建 temp_tokens 表（验证码 → 设密码 中间凭证）

-- ============================================================
-- 1. magic_codes 表
-- ============================================================
CREATE TABLE IF NOT EXISTS magic_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,           -- bcrypt(code) 防明文泄漏
  type TEXT NOT NULL,                -- 'login' | 'reset'
  expires_at INTEGER NOT NULL,       -- unix timestamp
  used_at INTEGER,                   -- null=未用
  attempts INTEGER DEFAULT 0,        -- 验证尝试次数（防暴力）
  ip TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_magic_email_type ON magic_codes(email, type);
CREATE INDEX IF NOT EXISTS idx_magic_expires ON magic_codes(expires_at);

-- ============================================================
-- 2. temp_tokens 表（首次验证码通过后，临时 token 用于 set-password）
-- ============================================================
CREATE TABLE IF NOT EXISTS temp_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL,             -- 'set-password'
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_temp_user ON temp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_temp_expires ON temp_tokens(expires_at);
