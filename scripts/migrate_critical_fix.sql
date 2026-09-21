-- ============================================================
-- migrate_critical_fix.sql · 阶段一修复（2026-09-21）
-- 修复：
--   1. 建 admin_action_logs 表（admin.js 审计日志）
--   2. orders 表补 paypal_capture_id / paid_amount / refunded_at / refund_reason
--   3. oracle_audit_log 表列名修正（resolved/resolved_at 字段补齐）
-- ============================================================

-- 1. admin_action_logs 表
CREATE TABLE IF NOT EXISTS admin_action_logs (
    id VARCHAR(32) PRIMARY KEY,
    admin_user VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(32),
    target_id VARCHAR(64),
    target_email VARCHAR(255),
    detail TEXT,
    created_at BIGINT DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX IF NOT EXISTS idx_admin_log_admin ON admin_action_logs(admin_user, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_log_target ON admin_action_logs(target_type, target_id);

-- 2. orders 表补列
-- 注意：SQLite ALTER TABLE 不支持 IF NOT EXISTS（列），需要查 schema 后跳过已存在列
-- 用 PRAGMA 验证列存在性后 ALTER

-- paypal_capture_id
ALTER TABLE orders ADD COLUMN paypal_capture_id VARCHAR(64);

-- paid_amount
ALTER TABLE orders ADD COLUMN paid_amount DECIMAL(8,2);

-- refunded_at + refund_reason（退款功能用）
ALTER TABLE orders ADD COLUMN refunded_at BIGINT;
ALTER TABLE orders ADD COLUMN refund_reason TEXT;

-- 3. oracle_audit_log 表补 resolved / resolved_at 列（admin.js 使用）
ALTER TABLE oracle_audit_log ADD COLUMN resolved INT DEFAULT 0;
ALTER TABLE oracle_audit_log ADD COLUMN resolved_at BIGINT;
CREATE INDEX IF NOT EXISTS idx_audit_resolved ON oracle_audit_log(resolved, resolved_at);

-- 验证
SELECT 'admin_action_logs' as tbl, count(*) as cnt FROM admin_action_logs
UNION ALL
SELECT 'paypal_capture_id check', count(*) FROM pragma_table_info('orders') WHERE name='paypal_capture_id'
UNION ALL
SELECT 'paid_amount check', count(*) FROM pragma_table_info('orders') WHERE name='paid_amount'
UNION ALL
SELECT 'refunded_at check', count(*) FROM pragma_table_info('orders') WHERE name='refunded_at'
UNION ALL
SELECT 'refund_reason check', count(*) FROM pragma_table_info('orders') WHERE name='refund_reason'
UNION ALL
SELECT 'audit resolved check', count(*) FROM pragma_table_info('oracle_audit_log') WHERE name='resolved';