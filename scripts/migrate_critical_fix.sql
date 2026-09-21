-- ============================================================
-- migrate_critical_fix.sql · 阶段一修复（2026-09-21，幂等版）
-- 修复：
--   1. orders 表补 refunded_at / refund_reason
--   2. oracle_audit_log 表补 resolved / resolved_at 列
-- ============================================================

-- 1. orders 表补退款列
ALTER TABLE orders ADD COLUMN refunded_at BIGINT;
ALTER TABLE orders ADD COLUMN refund_reason TEXT;

-- 2. oracle_audit_log 表补 resolved / resolved_at 列
ALTER TABLE oracle_audit_log ADD COLUMN resolved INT DEFAULT 0;
ALTER TABLE oracle_audit_log ADD COLUMN resolved_at BIGINT;
CREATE INDEX IF NOT EXISTS idx_audit_resolved ON oracle_audit_log(resolved, resolved_at);