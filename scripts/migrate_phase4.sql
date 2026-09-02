-- ============================================================
-- migrate_phase4.sql · Phase 4 邀请系统迁移
-- 应用日期：2026-09-02
-- 用途：扩展 invites 表 + 新建 invite_rewards 表
-- 安全：IF NOT EXISTS / IF NOT EXISTS 全部幂等
-- ============================================================

-- 1. 扩展 invites 表
ALTER TABLE invites ADD COLUMN device_id VARCHAR(64);
ALTER TABLE invites ADD COLUMN ip VARCHAR(45);
ALTER TABLE invites ADD COLUMN invitee_effective_at BIGINT;
ALTER TABLE invites ADD COLUMN reward_registration_at BIGINT;
ALTER TABLE invites ADD COLUMN reward_first_paid_at BIGINT;
ALTER TABLE invites ADD COLUMN reward_milestone_at BIGINT;

-- 2. 新增索引（防刷）
CREATE INDEX IF NOT EXISTS idx_invite_device ON invites(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invite_ip ON invites(ip, created_at) WHERE ip IS NOT NULL;

-- 3. 新建 invite_rewards 表
CREATE TABLE IF NOT EXISTS invite_rewards (
    id VARCHAR(32) PRIMARY KEY,
    invite_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    reward_type VARCHAR(32) NOT NULL,
    reward_value VARCHAR(64),
    source VARCHAR(32),
    granted_at BIGINT DEFAULT (strftime('%s','now')*1000),
    expires_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_reward_user ON invite_rewards(user_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_invite ON invite_rewards(invite_id);
-- Phase 4 追加：magic_links 加 invite_code 列
ALTER TABLE magic_links ADD COLUMN invite_code VARCHAR(32);
CREATE INDEX IF NOT EXISTS idx_magic_invite ON magic_links(invite_code) WHERE invite_code IS NOT NULL;
