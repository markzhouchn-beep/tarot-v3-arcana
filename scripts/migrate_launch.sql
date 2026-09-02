-- ============================================================
-- scripts/migrate_launch.sql · 上线前 DB schema 补齐
-- 创建：2026-09-02 · Mark 上线清单 Phase 0.1
--
-- 幂等：每次 ALTER 用 IF NOT EXISTS 语义靠脚本过滤
-- SQLite 3.35+ 支持 `ADD COLUMN IF NOT EXISTS`；本地版本不支持，靠 sqlite3 客户端的 error tolerance 跳过
-- ============================================================

-- ========== 1. readings · 解读结构化字段 ==========
ALTER TABLE readings ADD COLUMN sections_json TEXT;
ALTER TABLE readings ADD COLUMN summary TEXT;

-- ========== 2. orders · 实付金额 + 爱发电关联 ==========
ALTER TABLE orders ADD COLUMN paid_amount DECIMAL(8,2);
ALTER TABLE orders ADD COLUMN afdian_out_trade_no TEXT;
ALTER TABLE orders ADD COLUMN afdian_sku_id TEXT;

-- ========== 3. oracle_messages · 成本字段 ==========
ALTER TABLE oracle_messages ADD COLUMN cost_cny REAL DEFAULT 0;

-- ========== 4. users · 登录 + 邀请字段 ==========
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN invite_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN failed_login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until INTEGER;

-- ========== 5. webhook_idempotency · 幂等保护 ===========
CREATE TABLE IF NOT EXISTS webhook_idempotency (
    id VARCHAR(32) PRIMARY KEY,
    out_trade_no TEXT NOT NULL,
    custom_order_id TEXT NOT NULL,
    product_type TEXT NOT NULL,
    payload_hash TEXT,
    received_at BIGINT NOT NULL,
    processed INTEGER DEFAULT 0,
    processed_at BIGINT,
    UNIQUE(out_trade_no, custom_order_id, product_type)
);

CREATE INDEX IF NOT EXISTS idx_webhook_idem_received ON webhook_idempotency(received_at);ALTER TABLE orders ADD COLUMN ai_error TEXT;
