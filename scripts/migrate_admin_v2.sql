-- ============================================================
-- Admin v2 schema 扩展
-- 应用：2026-09-06
-- 内容：
--   1. oracle_messages 加 cost_cny 列（AI 成本统计）
--   2. oracle_audit_log 加 resolved 列（敏感词告警状态）
--   3. 新增 analytics_events 表（漏斗埋点）
--   4. 新增 admin_action_logs 表（管理员操作审计）
-- ============================================================

-- 1. AI 成本：每条追问记录的成本
ALTER TABLE oracle_messages ADD COLUMN cost_cny DECIMAL(8,4) DEFAULT 0;
-- 已存在记录的 cost 估算：tokens_used * 0.0001（粗略值，仅用于历史数据展示）
UPDATE oracle_messages
SET cost_cny = COALESCE(tokens_used, 0) * 0.0001
WHERE cost_cny = 0 OR cost_cny IS NULL;
CREATE INDEX IF NOT EXISTS idx_msg_cost ON oracle_messages(cost_cny, created_at DESC);

-- 2. 敏感词告警：resolved 标志
ALTER TABLE oracle_audit_log ADD COLUMN resolved INT DEFAULT 0;
ALTER TABLE oracle_audit_log ADD COLUMN resolved_at BIGINT;
-- 已审查的算 resolved
UPDATE oracle_audit_log SET resolved = 1, resolved_at = reviewed_at WHERE reviewed_at IS NOT NULL AND reviewed_at > 0;
CREATE INDEX IF NOT EXISTS idx_audit_resolved ON oracle_audit_log(resolved, created_at DESC);

-- 3. 漏斗埋点表
CREATE TABLE IF NOT EXISTS analytics_events (
    id VARCHAR(32) PRIMARY KEY,
    event_name VARCHAR(64) NOT NULL,        -- user_registered / order_created / order_paid / invite_sent / invite_registered ...
    user_id VARCHAR(32),                    -- 登录用户
    device_id VARCHAR(64),                  -- 匿名设备
    properties TEXT,                        -- JSON 附加属性
    page_url VARCHAR(255),
    session_id VARCHAR(64),
    created_at BIGINT DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX IF NOT EXISTS idx_event_name ON analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_user ON analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_device ON analytics_events(device_id, created_at DESC);

-- 4. 管理员操作日志
CREATE TABLE IF NOT EXISTS admin_action_logs (
    id VARCHAR(32) PRIMARY KEY,
    admin_user VARCHAR(64) NOT NULL,         -- 操作者（目前是 mark）
    action VARCHAR(64) NOT NULL,             -- tier_change / quota_grant / sub_extend / order_refund / alert_resolve / feedback_handle
    target_type VARCHAR(32),                 -- user / order / subscription / feedback / alert
    target_id VARCHAR(32),
    target_label VARCHAR(255),               -- 人类可读标识（如 user email）
    details TEXT,                            -- JSON 详细信息
    ip VARCHAR(64),
    created_at BIGINT DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX IF NOT EXISTS idx_adminlog_admin ON admin_action_logs(admin_user, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adminlog_action ON admin_action_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adminlog_target ON admin_action_logs(target_type, target_id, created_at DESC);

-- ============================================================
-- Admin v2 迁移完成
-- ============================================================
