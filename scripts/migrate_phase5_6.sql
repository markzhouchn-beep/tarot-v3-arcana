-- ============================================================
-- Phase 5/6 schema 扩展
-- 应用：2026-09-02
-- ============================================================

-- 用户反馈表
CREATE TABLE IF NOT EXISTS feedback (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32),
    type VARCHAR(32) NOT NULL,           -- bug / suggestion / praise / other
    content TEXT NOT NULL,
    contact VARCHAR(255),                -- 可选联系方式
    page_url VARCHAR(255),               -- 来源页面
    device_info VARCHAR(255),            -- 浏览器/设备
    status VARCHAR(16) DEFAULT 'pending', -- pending / handled / closed
    admin_note TEXT,
    handled_at BIGINT,
    created_at BIGINT DEFAULT (strftime('%s','now')*1000),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id, created_at DESC);

-- orders 表加退款字段
ALTER TABLE orders ADD COLUMN refunded_at BIGINT;
ALTER TABLE orders ADD COLUMN refund_reason TEXT;

-- oracle_audit_log 加 resolved 字段（如不存在）
-- （ALTER COLUMN 用 IF NOT EXISTS 语法 SQLite 不支持，检查后手动 add）

-- Phase 5/6 schema 扩展追加
ALTER TABLE user_subscriptions ADD COLUMN source VARCHAR(32) DEFAULT 'afdian';
