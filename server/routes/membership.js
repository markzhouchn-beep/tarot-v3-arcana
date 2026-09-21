// ============================================================
// routes/membership.js · 会员状态查询 + 升降级
// 创建：2026-09-01
// 2026-09-21：下线爱发电订阅路径，订阅改为 admin 后台手动授予
//            保留状态查询 / admin grant / 过期降级逻辑
// ============================================================

import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { config } from '../lib/config.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getQuotaToday } from '../lib/quota.js';
import { sendSubscriptionSuccessEmail } from '../lib/mail.js';

const router = Router();

/**
 * GET /api/membership/status
 * 会员状态 + 配额
 */
router.get('/status', optionalAuth, (req, res) => {
  try {
    const tier = req.user?.tier || 'guest';
    const userId = req.user?.id;

    let subscription = null;
    if (userId) {
      const sub = db.prepare(`
        SELECT * FROM user_subscriptions
        WHERE user_id = ? AND status = 'active'
        ORDER BY expires_at DESC LIMIT 1
      `).get(userId);

      if (sub) {
        subscription = {
          id: sub.id,
          tier: sub.tier,
          started_at: sub.started_at,
          expires_at: sub.expires_at,
          days_remaining: Math.max(0, Math.ceil((sub.expires_at - Date.now()) / (24 * 3600 * 1000))),
        };
      }
    }

    const quotaToday = {
      free_draw: getQuotaToday(userId || 'guest', tier, 'free_draw'),
      oracle_self: getQuotaToday(userId || 'guest', tier, 'oracle_self'),
      preset_question: getQuotaToday(userId || 'guest', tier, 'preset_question'),
    };

    res.json({
      tier,
      subscription,
      quota_today: quotaToday,
    });
  } catch (err) {
    console.error('[membership] status error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/membership/subscribe
 * 爱发电已下线（2026-09-21）。改为返回 410 Gone，提示用户会员功能正在重构。
 */
router.post('/subscribe', requireAuth, (req, res) => {
  res.status(410).json({
    error: 'SUBSCRIPTION_DISABLED',
    message: '会员订阅功能正在重构，暂未开放。如需开通会员请联系客服或关注产品更新。',
  });
});

/**
 * 内部：处理订阅 webhook 命中（已下线，保留占位）
 * 实际授予由 admin 后台 POST /api/admin/users/:id/tier 完成
 */
export async function activateSubscription({ userId, planId, outTradeNo, amount, payMonth }) {
  console.warn('[membership] activateSubscription called but afdian disabled — noop');
  return { ok: false, error: 'afdian_disabled' };
}

/**
 * 内部：扫描过期订阅（每日定时任务调用）
 */
export function expireDueSubscriptions() {
  const now = Date.now();
  const expired = db.prepare(`
    UPDATE user_subscriptions
    SET status = 'expired', updated_at = ?
    WHERE status = 'active' AND expires_at < ?
  `).run(now, now);

  if (expired.changes > 0) {
    db.prepare(`
      UPDATE users SET tier = 'registered'
      WHERE id IN (
        SELECT user_id FROM user_subscriptions
        WHERE status = 'expired' AND updated_at = ?
      )
    `).run(now);
  }

  return { expired: expired.changes };
}

export default router;