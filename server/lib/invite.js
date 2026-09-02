// ============================================================
// lib/invite.js · 邀请系统核心逻辑
// v3.0 Phase 4 实施
// 创建：2026-09-02 14:15
//
// 职责：
// 1. 查找邀请人（按 invite_code）
// 2. 创建/更新邀请记录（invites 表）
// 3. 防刷检查（设备/IP/有效动作）
// 4. 三类奖励发放：
//    - 注册奖励：邀请人 +3 次追问；被邀请人 +1 次三张免费
//    - 首次付费奖励：邀请人 +¥3 抵扣券 + 5 次追问
//    - 满 3 人奖励：邀请人 +1 次十张牌 + 10 次追问
//
// PD 参考：v0.8 第 2.4 节 + 第 6.2 节
// ============================================================

import db from '../db.js';
import crypto from 'crypto';
import { config } from './config.js';

// ============================================================
// 常量（PD v0.8 第 2.4 节）
// ============================================================
export const REWARDS = {
  REGISTRATION: {
    INVITER: { type: 'registration_ask', value: '3_ask', desc: '+3 次追问' },
    INVITEE: { type: 'invitee_three_spread', value: '1_three_spread', desc: '+1 次三张免费' },
  },
  FIRST_PAID: {
    INVITER: [
      { type: 'paid_coupon', value: 'coupon_3', desc: '+¥3 单次抵扣券' },
      { type: 'paid_ask', value: '5_ask', desc: '+5 次追问' },
    ],
  },
  MILESTONE_3: {
    INVITER: [
      { type: 'milestone_ten', value: '1_ten_spread', desc: '+1 次免费十张牌解读' },
      { type: 'milestone_ask', value: '10_ask', desc: '+10 次追问' },
    ],
  },
};

// 防刷常量（PD v0.8 第 2.4 节 · Review 建议）
export const ANTISPAM = {
  ONE_DEVICE_ONE_INVITE: true,    // 同一设备只能被邀请一次
  IP_24H_MAX_REGISTRATIONS: 3,    // 同一 IP 24h 最多 3 个注册
};

// ============================================================
// 工具函数
// ============================================================

/**
 * 生成 8 位邀请码（去歧义字符 0O1IL）
 */
export function generateInviteCode() {
  // 4 字节 → 8 hex 字符，但 0/O/1/I/L 易混淆，改用 base32
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 字符，去掉 0/1/I/L/O
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < bytes.length; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code.slice(0, 8);
}

/**
 * 通过 invite_code 查找邀请人
 */
export function findInviterByCode(inviteCode) {
  if (!inviteCode) return null;
  const inviter = db.prepare(`
    SELECT id, email, nickname, tier, invite_code
    FROM users WHERE invite_code = ?
  `).get(inviteCode);
  return inviter || null;
}

// ============================================================
// 防刷机制（PD v0.8 第 2.4 节）
// ============================================================

/**
 * 检查同一设备是否已被邀请过
 */
export function isDeviceInvited(deviceId) {
  if (!deviceId) return false;
  const row = db.prepare(`
    SELECT id FROM invites WHERE device_id = ?
    LIMIT 1
  `).get(deviceId);
  return !!row;
}

/**
 * 检查同一 IP 24h 内注册数
 */
export function getIp24hRegistrationCount(ip) {
  if (!ip) return 0;
  const since = Date.now() - 24 * 3600 * 1000;
  const row = db.prepare(`
    SELECT COUNT(*) AS cnt FROM invites
    WHERE ip = ? AND created_at > ?
  `).get(ip, since);
  return row?.cnt || 0;
}

/**
 * 检查是否构成 spam
 */
export function checkAntiSpam({ deviceId, ip }) {
  if (ANTISPAM.ONE_DEVICE_ONE_INVITE && isDeviceInvited(deviceId)) {
    return { ok: false, reason: 'device_already_invited', message: '该设备已被邀请过' };
  }
  const ipCount = getIp24hRegistrationCount(ip);
  if (ipCount >= ANTISPAM.IP_24H_MAX_REGISTRATIONS) {
    return { ok: false, reason: 'ip_rate_limited', message: '同一 IP 24h 内邀请过多' };
  }
  return { ok: true };
}

/**
 * 检查有效动作（PD v0.8 第 2.4 节：被邀请人必须完成至少 1 次 Yes/No 或单张抽牌）
 */
export function checkEffectiveAction(userId) {
  if (!userId) return false;
  // 查 yes_no_records 或 orders（status=paid, spread_type=single/three/ten）
  const row = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM yes_no_records WHERE user_id = ?) AS yesno_count,
      (SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = 'paid') AS paid_orders
  `).get(userId, userId);
  return (row?.yesno_count || 0) > 0 || (row?.paid_orders || 0) > 0;
}

// ============================================================
// 邀请记录 CRUD
// ============================================================

/**
 * 创建邀请记录（不含防刷，供 magic-link verify 路径使用）
 * @returns {object|null} 邀请记录，null 表示自邀请
 */
export function createInviteRecordNoSpam({ inviterUserId, inviteeUserId, inviteCode, inviteeEmail, deviceId, ip }) {
  // 防自邀请
  if (inviterUserId === inviteeUserId) {
    console.warn(`[invite] self-invite attempt: ${inviteeUserId}`);
    return null;
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO invites (
      id, inviter_user_id, invitee_user_id, invite_code, invitee_email,
      status, device_id, ip, created_at
    ) VALUES (?, ?, ?, ?, ?, 'registered', ?, ?, ?)
  `).run(id, inviterUserId, inviteeUserId, inviteCode, inviteeEmail, deviceId, ip, Date.now());

  console.log(`[invite] record created (no-spam): inviter=${inviterUserId} invitee=${inviteeUserId} code=${inviteCode}`);
  return { id, inviterUserId, inviteeUserId, inviteCode, status: 'registered' };
}

/**
 * 创建邀请记录（被邀请人注册时，带防刷）
 * @returns {object|null} 邀请记录，null 表示无效（自邀请或防刷失败）
 */
export function createInviteRecord({ inviterUserId, inviteeUserId, inviteCode, inviteeEmail, deviceId, ip }) {
  // 防自邀请
  if (inviterUserId === inviteeUserId) {
    console.warn(`[invite] self-invite attempt: ${inviteeUserId}`);
    return null;
  }

  // 防刷
  const spam = checkAntiSpam({ deviceId, ip });
  if (!spam.ok) {
    console.warn(`[invite] antispam blocked: ${spam.reason}`);
    return null;
  }

  return createInviteRecordNoSpam({ inviterUserId, inviteeUserId, inviteCode, inviteeEmail, deviceId, ip });
}

/**
 * 事务包装：INSERT invite + UPDATE user.invited_by + 发放注册奖励
 * 保证三步要么全成功要么全失败（避免半成功数据不一致）
 *
 * @returns {object|null} { record, invitedBy } 或 null（自邀请/防刷失败）
 */
export function linkInviteAndGrantRewards({ inviterUserId, inviteeUserId, inviteCode, inviteeEmail, deviceId, ip, skipSpamCheck = false }) {
  // 先做不依赖事务的检查（防自邀请、防刷）
  if (inviterUserId === inviteeUserId) {
    console.warn(`[invite] self-invite attempt: ${inviteeUserId}`);
    return null;
  }
  if (!skipSpamCheck) {
    const spam = checkAntiSpam({ deviceId, ip });
    if (!spam.ok) {
      console.warn(`[invite] antispam blocked: ${spam.reason}`);
      return null;
    }
  } else {
    console.log(`[invite] spam check skipped (verify path)`);
  }

  // 包事务：三步原子
  const tx = db.transaction(() => {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO invites (
        id, inviter_user_id, invitee_user_id, invite_code, invitee_email,
        status, device_id, ip, created_at
      ) VALUES (?, ?, ?, ?, ?, 'registered', ?, ?, ?)
    `).run(id, inviterUserId, inviteeUserId, inviteCode, inviteeEmail, deviceId, ip, Date.now());

    db.prepare(`UPDATE users SET invited_by = ? WHERE id = ?`).run(inviterUserId, inviteeUserId);

    // 发放注册奖励（事务内）
    grantReward(id, inviterUserId, REWARDS.REGISTRATION.INVITER);
    grantReward(id, inviteeUserId, REWARDS.REGISTRATION.INVITEE);
    db.prepare(`UPDATE invites SET reward_registration_at = ? WHERE id = ?`).run(Date.now(), id);

    console.log(`[invite] linked + rewarded atomically: invite=${id} inviter=${inviterUserId} invitee=${inviteeUserId}`);
    return { id, inviterUserId, inviteeUserId, inviteCode, status: 'registered' };
  });

  return tx();
}

/**
 * 标记被邀请人完成有效动作
 */
export function markEffectiveAction({ inviteeUserId }) {
  if (!inviteeUserId) return;
  const now = Date.now();
  const result = db.prepare(`
    UPDATE invites
    SET status = 'effective', invitee_effective_at = ?
    WHERE invitee_user_id = ? AND status = 'registered'
  `).run(now, inviteeUserId);

  if (result.changes > 0) {
    console.log(`[invite] effective action: invitee=${inviteeUserId}`);
  }
}

// ============================================================
// 奖励发放
// ============================================================

/**
 * 发放奖励（通用函数）
 * @returns {string|null} 奖励 ID，null 表示已发过
 */
function grantReward(inviteId, userId, reward) {
  // 防重复：同一 invite + reward_type 只能发一次
  const existing = db.prepare(`
    SELECT id FROM invite_rewards
    WHERE invite_id = ? AND reward_type = ?
  `).get(inviteId, reward.type);
  if (existing) return null;

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO invite_rewards (
      id, invite_id, user_id, reward_type, reward_value, granted_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, inviteId, userId, reward.type, reward.value, Date.now());

  console.log(`[invite] reward granted: ${reward.type} (${reward.value}) → user=${userId}`);
  return id;
}

/**
 * 发放注册奖励（邀请人 +3 追问，被邀请人 +1 次三张免费）
 */
export function grantRegistrationRewards(inviteId, inviterUserId, inviteeUserId) {
  grantReward(inviteId, inviterUserId, REWARDS.REGISTRATION.INVITER);
  grantReward(inviteId, inviteeUserId, REWARDS.REGISTRATION.INVITEE);

  // 更新 invites.reward_registration_at
  db.prepare(`
    UPDATE invites SET reward_registration_at = ? WHERE id = ?
  `).run(Date.now(), inviteId);
}

/**
 * 为某个付费订单触发邀请人首次付费奖励（事务安全、幂等）
 * 供 webhook 和 triggerAIReading 调用：webhook 是主路径，AI 解读是备份路径
 * @returns {boolean} true 表示本次实际发了奖（false 表示已发过/不是被邀请人）
 */
export function grantFirstPaidRewardForOrder(orderUserId) {
  if (!orderUserId) return false;

  const tx = db.transaction(() => {
    const inviterUserId = db.prepare(`SELECT invited_by FROM users WHERE id = ?`).get(orderUserId)?.invited_by;
    if (!inviterUserId) return false;

    const inviteRecord = db.prepare(`
      SELECT id FROM invites WHERE invitee_user_id = ? AND reward_first_paid_at IS NULL
    `).get(orderUserId);
    if (!inviteRecord) return false; // 已发过或不是被邀请人

    // 发奖
    grantFirstPaidRewards(inviteRecord.id, inviterUserId);
    checkAndGrantMilestoneRewards(inviterUserId);
    console.log(`[invite] 🎁 first-paid reward granted: invitee=${orderUserId} → inviter=${inviterUserId}`);
    return true;
  });

  return tx();
}

/**
 * 发放首次付费奖励（邀请人 +¥3 抵扣券 + 5 次追问）
 */
export function grantFirstPaidRewards(inviteId, inviterUserId) {
  REWARDS.FIRST_PAID.INVITER.forEach(reward => {
    grantReward(inviteId, inviterUserId, reward);
  });
  db.prepare(`
    UPDATE invites SET reward_first_paid_at = ? WHERE id = ?
  `).run(Date.now(), inviteId);
}

/**
 * 检查并发放满 3 人里程碑奖励
 */
export function checkAndGrantMilestoneRewards(inviterUserId) {
  // 统计 inviter 已注册（effective 状态）的邀请数
  const count = db.prepare(`
    SELECT COUNT(*) AS cnt FROM invites
    WHERE inviter_user_id = ? AND status IN ('effective', 'paid', 'rewarded')
  `).get(inviterUserId)?.cnt || 0;

  if (count < 3) return false;

  // 检查是否已发过里程碑奖励
  const existing = db.prepare(`
    SELECT id FROM invite_rewards
    WHERE user_id = ? AND reward_type = 'milestone_ten'
  `).get(inviterUserId);
  if (existing) return false;

  // 取最近的 invite_id 写入奖励
  const latestInvite = db.prepare(`
    SELECT id FROM invites
    WHERE inviter_user_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(inviterUserId);

  REWARDS.MILESTONE_3.INVITER.forEach(reward => {
    grantReward(latestInvite.id, inviterUserId, reward);
  });
  db.prepare(`
    UPDATE invites SET reward_milestone_at = ? WHERE inviter_user_id = ?
  `).run(Date.now(), inviterUserId);

  console.log(`[invite] 🎉 milestone reached: inviter=${inviterUserId} count=${count}`);
  return true;
}

// ============================================================
// 查询接口
// ============================================================

/**
 * 获取用户的邀请统计 + 邀请记录 + 奖励列表
 */
export function getInviteStats(userId) {
  // 1. 我的邀请码
  const user = db.prepare(`SELECT invite_code FROM users WHERE id = ?`).get(userId);

  // 2. 邀请记录
  const invites = db.prepare(`
    SELECT
      i.id, i.invitee_email, i.status, i.created_at,
      i.invitee_effective_at, i.reward_registration_at,
      i.reward_first_paid_at, i.reward_milestone_at,
      u.email AS invitee_email_real, u.tier AS invitee_tier
    FROM invites i
    LEFT JOIN users u ON u.id = i.invitee_user_id
    WHERE i.inviter_user_id = ?
    ORDER BY i.created_at DESC
  `).all(userId);

  // 3. 我的奖励
  const rewards = db.prepare(`
    SELECT id, reward_type, reward_value, granted_at, expires_at
    FROM invite_rewards
    WHERE user_id = ?
    ORDER BY granted_at DESC
  `).all(userId);

  // 4. 累计统计
  const summary = {
    total_invites: invites.length,
    effective_count: invites.filter(i => i.status === 'effective' || i.status === 'paid' || i.status === 'rewarded').length,
    total_rewards: rewards.length,
    milestone_reached: invites.some(i => i.reward_milestone_at !== null),
  };

  return {
    invite_code: user?.invite_code,
    // 后端生成完整邀请链接（避免前端硬编码 origin 在本地/生产不一致）
    invite_url: user?.invite_code
      ? `${config.FRONTEND_URL}/?invite=${user.invite_code}`
      : null,
    invites,
    rewards,
    summary,
  };
}

export default {
  generateInviteCode,
  findInviterByCode,
  isDeviceInvited,
  getIp24hRegistrationCount,
  checkAntiSpam,
  checkEffectiveAction,
  createInviteRecord,
  markEffectiveAction,
  grantRegistrationRewards,
  grantFirstPaidRewards,
  checkAndGrantMilestoneRewards,
  getInviteStats,
  REWARDS,
  ANTISPAM,
};