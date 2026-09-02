-- ============================================================
-- 星语塔罗 v3.0 · 数据库 schema
-- 13 张表 + 索引 + 幂等表
-- 创建时间：2026-09-01
-- ============================================================

-- ========== 1. 用户表 ==========
-- 沿用 v2.0 users 表结构，扩展字段（tier / invite / points / password）
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nickname VARCHAR(64),
    avatar_url VARCHAR(512),
    -- v3.0 新增
    tier VARCHAR(16) DEFAULT 'guest',          -- guest / registered / silver / gold
    password_hash VARCHAR(255),                -- bcrypt hash, nullable（Magic Link 用户无密码）
    email_verified INT DEFAULT 0,              -- 0/1
    email_verified_at BIGINT,
    failed_login_count INT DEFAULT 0,
    locked_until BIGINT,                       -- 失败 5 次锁定 15 分钟
    invite_code VARCHAR(16) UNIQUE,            -- 我的邀请码（注册时生成）
    invited_by VARCHAR(32),                    -- 谁邀请我（user_id）
    points INT DEFAULT 0,                      -- 预留字段，v3.0 不使用（V1.1 积分系统）
    -- 元数据
    last_login_at BIGINT,
    last_login_ip VARCHAR(64),
    created_at BIGINT DEFAULT (strftime('%s','now')*1000),
    updated_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code);

-- ========== 2. Magic Link 表 ==========
-- 沿用 v2.0，扩展 purpose 字段
CREATE TABLE IF NOT EXISTS magic_links (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(128) UNIQUE NOT NULL,        -- URL-safe base64, 32 字节随机
    purpose VARCHAR(32) DEFAULT 'login',       -- login / password_reset / email_verify
    expires_at BIGINT NOT NULL,                -- now + 15min (login) / 30min (reset) / 24h (verify)
    used_at BIGINT,                            -- 一次性使用标记
    ip VARCHAR(64),                            -- 防刷：同 IP 限频
    invite_code VARCHAR(32),                   -- Phase 4: 关联邀请（魔法链接发时绑定、verify 时取）
    created_at BIGINT DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX IF NOT EXISTS idx_magic_token ON magic_links(token);
CREATE INDEX IF NOT EXISTS idx_magic_email ON magic_links(email, created_at DESC);

-- ========== 3. Session 表 ==========
-- v3.0 从内存改为 DB（重启不丢）
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,                -- session token (32 字节 hex)
    user_id VARCHAR(32) NOT NULL,
    ip VARCHAR(64),
    user_agent VARCHAR(512),
    expires_at BIGINT NOT NULL,                -- now + 30 天
    created_at BIGINT DEFAULT (strftime('%s','now')*1000),
    last_used_at BIGINT DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX IF NOT EXISTS idx_session_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_expires ON sessions(expires_at);

-- ========== 4. 用户订阅表 ==========
-- v3.0 核心新增
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    afdian_plan_id VARCHAR(64) NOT NULL,       -- silver_monthly / gold_yearly 等
    tier VARCHAR(16) NOT NULL,                  -- silver / gold
    pay_month INT NOT NULL,                     -- 1/3/12
    amount DECIMAL(8,2),
    started_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    status VARCHAR(16) DEFAULT 'active',        -- active / expired / cancelled
    afdian_out_trade_no VARCHAR(64),
    renewal_reminded INT DEFAULT 0,             -- 是否已发续费提醒 (0/1/2/3 分别对应 7天/3天/1天)
    created_at BIGINT DEFAULT (strftime('%s','now')*1000),
    updated_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subs_expires ON user_subscriptions(expires_at, status);
CREATE INDEX IF NOT EXISTS idx_subs_trade ON user_subscriptions(afdian_out_trade_no);

-- ========== 5. 单次订单表 ==========
-- 沿用 v2.0 思路，扩展字段
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32),                        -- nullable（访客可下单）
    tier VARCHAR(16),                           -- lite / classic / deep / single_spread
    spread_type VARCHAR(32),                    -- 牌阵 ID (love-3 / celtic-10 等)
    spread_theme VARCHAR(16),                   -- love / career / money / self
    question TEXT,
    cards_json TEXT,                            -- 抽到的牌 JSON
    amount DECIMAL(8,2),
    status VARCHAR(16) DEFAULT 'pending',       -- pending / paid / interpreted / expired
    afdian_out_trade_no VARCHAR(64),
    afdian_sku_id VARCHAR(64),
    paid_at BIGINT,
    interpreted_at BIGINT,
    is_test INT DEFAULT 0,                      -- 测试订单隔离（device_id 前缀 test-）
    device_id VARCHAR(64),                      -- 设备 ID（防刷 + 测试隔离）
    created_at BIGINT DEFAULT (strftime('%s','now')*1000),
    updated_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_test ON orders(is_test, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_trade ON orders(afdian_out_trade_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);

-- ========== 6. 解读报告表 ==========
CREATE TABLE IF NOT EXISTS readings (
    id VARCHAR(32) PRIMARY KEY,
    order_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32),
    access_token VARCHAR(64) UNIQUE NOT NULL,    -- 分享链接用
    question TEXT,
    cards_json TEXT NOT NULL,
    spread_type VARCHAR(32),
    interpretation TEXT NOT NULL,
    interpretation_length INT,                  -- 字数统计
    question_count INT DEFAULT 0,               -- 追问次数
    is_resolved INT DEFAULT 0,                  -- 用户标记已解决
    created_at BIGINT DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX IF NOT EXISTS idx_readings_user ON readings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_order ON readings(order_id);

-- ========== 7. 追问会话表 ==========
CREATE TABLE IF NOT EXISTS oracle_sessions (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32),                        -- nullable（访客匿名）
    reading_id VARCHAR(32),                     -- nullable（独立 Oracle 可不绑报告）
    spread_type VARCHAR(32),
    title VARCHAR(128),                         -- 自动生成（首条消息摘要）
    message_count INT DEFAULT 0,
    status VARCHAR(16) DEFAULT 'active',        -- active / closed
    created_at BIGINT DEFAULT (strftime('%s','now')*1000),
    last_message_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_session_user ON oracle_sessions(user_id, last_message_at DESC);

-- ========== 8. 追问消息表 ==========
CREATE TABLE IF NOT EXISTS oracle_messages (
    id VARCHAR(32) PRIMARY KEY,
    session_id VARCHAR(32) NOT NULL,
    role VARCHAR(16) NOT NULL,                  -- user / assistant
    content TEXT NOT NULL,
    depth_layer INT,                            -- 1 / 2 / 3（仅 assistant）
    preset_question_id VARCHAR(32),             -- 如果是预设问题
    tokens_used INT DEFAULT 0,
    is_resolved INT DEFAULT 0,                  -- 用户标记
    featured INT DEFAULT 0,                     -- Phase 4 社区：精选标记
    featured_at BIGINT,                         -- 精选时间
    created_at BIGINT DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX IF NOT EXISTS idx_msg_session ON oracle_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_created ON oracle_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_featured ON oracle_messages(featured, featured_at DESC) WHERE featured = 1;

-- ========== 9. 用户配额追踪表 ==========
-- 按日配额：oracle_self / preset_question / free_draw
CREATE TABLE IF NOT EXISTS user_quotas (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    quota_date DATE NOT NULL,                   -- YYYY-MM-DD
    quota_type VARCHAR(32) NOT NULL,            -- free_draw / oracle_free / oracle_self / preset_question
    used INT DEFAULT 0,
    limit_value INT NOT NULL,
    created_at BIGINT DEFAULT (strftime('%s','now')*1000),
    UNIQUE(user_id, quota_date, quota_type)
);
CREATE INDEX IF NOT EXISTS idx_quota_date ON user_quotas(quota_date);

-- ========== 10. 报告追问配额表（单次付费的报告附追问）==========
CREATE TABLE IF NOT EXISTS reading_question_quota (
    reading_id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32),
    total_quota INT NOT NULL DEFAULT 0,
    used INT DEFAULT 0,
    source VARCHAR(32),                         -- single_payment / invite_reward / member_bonus
    expires_at BIGINT                           -- 单次付费报告的追问配额有效期（90 天）
);

-- ========== 11. 邀请记录表 ==========
CREATE TABLE IF NOT EXISTS invites (
    id VARCHAR(32) PRIMARY KEY,
    inviter_user_id VARCHAR(32) NOT NULL,
    invitee_user_id VARCHAR(32),
    invite_code VARCHAR(16) NOT NULL,
    invitee_email VARCHAR(255),
    status VARCHAR(16) DEFAULT 'pending',       -- pending / registered / effective / paid / rewarded
    -- v3.0 Phase 4 扩展：防刷与奖励追踪
    device_id VARCHAR(64),                       -- 被邀请设备ID（防一设备多邀请）
    ip VARCHAR(45),                              -- 被邀请 IP（防 24h 多注册）
    invitee_effective_at BIGINT,                 -- 被邀请人完成有效动作时间（Yes/No 或单张）
    reward_registration_at BIGINT,               -- 注册奖励发放时间（+3 追问）
    reward_first_paid_at BIGINT,                 -- 首次付费奖励时间（¥3 + 5 追问）
    reward_milestone_at BIGINT,                  -- 邀请满 3 人奖励时间（+1 十张 + 10 追问）
    reward_granted INT DEFAULT 0,                -- 总奖励次数（保留兼容）
    created_at BIGINT DEFAULT (strftime('%s','now')*1000),
    completed_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_invite_code ON invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_invite_inviter ON invites(inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_invite_device ON invites(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invite_ip ON invites(ip, created_at) WHERE ip IS NOT NULL;

-- ========== 11.1 邀请奖励发放记录（每条奖励一行） ==========
CREATE TABLE IF NOT EXISTS invite_rewards (
    id VARCHAR(32) PRIMARY KEY,
    invite_id VARCHAR(32) NOT NULL,              -- 关联 invites.id
    user_id VARCHAR(32) NOT NULL,                -- 获奖用户（邀请人或被邀请人）
    reward_type VARCHAR(32) NOT NULL,            -- registration_ask / paid_coupon / paid_ask / milestone_ten / milestone_ask
    reward_value VARCHAR(64),                    -- '3_ask' / 'coupon_3' / '5_ask' / '1_ten_spread' / '10_ask'
    source VARCHAR(32),                          -- invite_registration / invite_first_paid / invite_milestone_3
    granted_at BIGINT DEFAULT (strftime('%s','now')*1000),
    expires_at BIGINT                            -- 有效期（NULL = 永久）
);
CREATE INDEX IF NOT EXISTS idx_reward_user ON invite_rewards(user_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_invite ON invite_rewards(invite_id);

-- ========== 12. 预设问题库表 ==========
CREATE TABLE IF NOT EXISTS preset_questions (
    id VARCHAR(32) PRIMARY KEY,
    category VARCHAR(32) NOT NULL,              -- single_card / two_cards / action / review
    text TEXT NOT NULL,
    description TEXT,                          -- 鼠标 hover 显示
    applicable_spreads TEXT,                   -- JSON 数组，null = 全部
    tier_required VARCHAR(16) DEFAULT 'guest',
    display_order INT DEFAULT 0,
    is_active INT DEFAULT 1,
    usage_count INT DEFAULT 0,
    created_at BIGINT DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX IF NOT EXISTS idx_preset_active ON preset_questions(is_active, display_order);

-- ========== 13. Yes/No 免费抽记录表 ==========
CREATE TABLE IF NOT EXISTS yes_no_records (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32),                        -- nullable（访客）
    device_id VARCHAR(64),                      -- 设备 ID（防刷）
    question TEXT,
    card_id VARCHAR(32),
    result VARCHAR(16),                         -- yes / no / uncertain
    created_at BIGINT DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX IF NOT EXISTS idx_yesno_user_date ON yes_no_records(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_yesno_device_date ON yes_no_records(device_id, created_at);

-- ========== 14. 敏感词审计日志表 ==========
CREATE TABLE IF NOT EXISTS oracle_audit_log (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32),
    session_id VARCHAR(32),
    content TEXT,
    flagged_keywords TEXT,                      -- JSON 数组
    action VARCHAR(16),                         -- warn / block / manual_review / urgent_referral
    reviewed_by VARCHAR(32),
    reviewed_at BIGINT,
    created_at BIGINT DEFAULT (strftime('%s','now')*1000)
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON oracle_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON oracle_audit_log(action, reviewed_at);

-- ========== 15. 支付幂等表（v0.8 新增 · 解决 v2.0 漏单）==========
CREATE TABLE IF NOT EXISTS webhook_idempotency (
    id VARCHAR(32) PRIMARY KEY,
    out_trade_no VARCHAR(64) NOT NULL,
    custom_order_id VARCHAR(64) NOT NULL,
    product_type INT NOT NULL,                  -- 0 = 订阅 / 1 = 商品
    payload_hash VARCHAR(64) NOT NULL,          -- sha256(payload)
    received_at BIGINT DEFAULT (strftime('%s','now')*1000),
    processed INT DEFAULT 0,
    processed_at BIGINT,
    UNIQUE(out_trade_no, custom_order_id, product_type)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_received ON webhook_idempotency(received_at);

-- ============================================================
-- v3.0 schema 初始化完成
-- 13 张业务表 + 2 张系统表（sessions + webhook_idempotency）
-- ============================================================
