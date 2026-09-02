// ============================================================
// lib/quota.js · 配额管理 + 定时 reconcile
// 双轨配额：报告附赠 5 次 + 会员日配额（银月 15 / 金月 30）
// 创建：2026-09-01
// ============================================================

import db from '../db.js';
import { config } from './config.js';
import { queryOrder } from './afdian.js';

// 各等级配额限制
export const QUOTA_LIMITS = {
  // oracle_self 每日自由提问
  oracle_self: { guest: 0, registered: 5, silver: 15, gold: 30 },
  // preset_question 预设问题（访客 3/日，其他无限 = 999）
  preset_question: { guest: 3, registered: 999, silver: 999, gold: 999 },
  // free_draw Yes/No 单卡（访客 1/日，银月 3/日，金月无限）
  free_draw: { guest: 1, registered: 1, silver: 3, gold: 999 },
  // oracle_free 注册用户 AI 基础解读（占位）
  oracle_free: { guest: 0, registered: 5, silver: 15, gold: 30 },
};

// 单报告追问软上限（冷却触发）
export const PER_READING_COOLDOWN = {
  registered: 8,
  silver: 10,
  gold: 20,
  single_payment: 8,  // 单次付费报告（用尽 5 次后启用日配额）
};

/**
 * 获取用户今日配额使用情况
 * @param {string} userId
 * @param {string} tier - guest/registered/silver/gold
 * @returns {Object} - { used, limit, remaining }
 */
export function getQuotaToday(userId, tier, type = 'oracle_self') {
  const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
  const limit = QUOTA_LIMITS[type]?.[tier] ?? 0;

  const row = db.prepare(`
    SELECT used FROM user_quotas
    WHERE user_id = ? AND quota_date = ? AND quota_type = ?
  `).get(userId, today, type);

  const used = row?.used ?? 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    reset_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  };
}

/**
 * 增加配额计数
 */
export function incrementQuota(userId, type, tier) {
  const today = new Date().toISOString().slice(0, 10);
  const limit = QUOTA_LIMITS[type]?.[tier] ?? 0;

  db.prepare(`
    INSERT INTO user_quotas (id, user_id, quota_date, quota_type, used, limit_value)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(user_id, quota_date, quota_type)
    DO UPDATE SET used = used + 1
  `).run(crypto.randomUUID(), userId, today, type, limit);
}

/**
 * 报告追问配额扣减（单次付费报告附 5 次）
 * @returns {'reading'|'daily'|'exhausted'} - 扣减哪个配额
 */
export function consumeReadingQuota(readingId, userId, tier) {
  const rq = db.prepare(`
    SELECT * FROM reading_question_quota WHERE reading_id = ?
  `).get(readingId);

  if (rq && rq.used < rq.total_quota) {
    db.prepare(`
      UPDATE reading_question_quota SET used = used + 1 WHERE reading_id = ?
    `).run(readingId);
    return 'reading';
  }

  // 报告配额用尽，扣日配额
  const today = getQuotaToday(userId, tier, 'oracle_self');
  if (today.remaining > 0) {
    incrementQuota(userId, 'oracle_self', tier);
    return 'daily';
  }

  return 'exhausted';
}

/**
 * 检查追问冷却（单报告连续追问达到软上限）
 */
export function checkCooldown(readingId, tier) {
  const rq = db.prepare(`
    SELECT used FROM reading_question_quota WHERE reading_id = ?
  `).get(readingId);

  const used = rq?.used ?? 0;
  const limit = PER_READING_COOLDOWN[tier] ?? 8;
  return { need_cooldown: used >= limit, used, limit };
}

/**
 * 启动定时 reconcile 循环（每 N 秒扫描 pending 订单）
 */
let reconcileTimer = null;

export function startReconcileLoop() {
  if (reconcileTimer) return;
  const interval = (config.RECONCILE_INTERVAL || 60) * 1000;

  console.log(`[reconcile] 定时任务启动，每 ${interval / 1000}s 扫描`);
  reconcileTimer = setInterval(reconcileLoop, interval);
}

export function stopReconcileLoop() {
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }
}

async function reconcileLoop() {
  try {
    // 找出待 reconcile 的订单（排除测试订单）
    const pending = db.prepare(`
      SELECT id, afdian_out_trade_no, amount, created_at
      FROM orders
      WHERE status = 'pending'
        AND is_test = 0
        AND afdian_out_trade_no IS NOT NULL
        AND created_at > ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(Date.now() - 24 * 3600 * 1000);  // 最近 24h

    if (pending.length === 0) return;

    for (const order of pending) {
      try {
        await reconcileSingleOrder(order);
      } catch (err) {
        console.error(`[reconcile] 订单 ${order.id} 异常:`, err.message);
      }
    }
  } catch (err) {
    console.error('[reconcile] loop 异常:', err.message);
  }
}

async function reconcileSingleOrder(order) {
  // ⚠️ 此函数 Phase 0 是占位（不动真钱），由 routes/afdian-webhook.js 的幂等逻辑兜底
  // 真实实现：调 queryOrder → 命中 → 标 paid + 触发 AI 解读
  return { skipped: true, reason: 'phase_0_placeholder' };
}

export default {
  QUOTA_LIMITS,
  PER_READING_COOLDOWN,
  getQuotaToday,
  incrementQuota,
  consumeReadingQuota,
  checkCooldown,
  startReconcileLoop,
  stopReconcileLoop,
};
