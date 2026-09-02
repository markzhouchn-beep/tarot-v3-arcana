// ============================================================
// routes/membership.js · 会员订阅（创建 + 状态 + 升降级）
// 创建：2026-09-01
// ============================================================

import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { config } from '../lib/config.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { buildSubscriptionPayUrl, inferSubscriptionTier } from '../lib/afdian.js';
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
 * 创建订阅订单（返爱发电支付 URL）
 */
router.post('/subscribe', requireAuth, (req, res) => {
  try {
    const { plan } = req.body || {};
    if (!plan) {
      return res.status(400).json({ error: 'MISSING_PLAN' });
    }

    const planIdMap = {
      silver_monthly: config.AFDIAN_PLAN_SILVER_MONTHLY,
      silver_yearly: config.AFDIAN_PLAN_SILVER_YEARLY,
      gold_monthly: config.AFDIAN_PLAN_GOLD_MONTHLY,
      gold_yearly: config.AFDIAN_PLAN_GOLD_YEARLY,
    };

    const planId = planIdMap[plan];
    if (!planId) {
      return res.status(400).json({ error: 'INVALID_PLAN', message: `不支持的订阅方案: ${plan}` });
    }

    const inferred = inferSubscriptionTier(plan);
    if (!inferred) {
      return res.status(400).json({ error: 'INVALID_PLAN' });
    }

    // 订阅场景 custom_order_id = user_id
    const payUrl = buildSubscriptionPayUrl(planId, req.user.id);

    res.json({
      ok: true,
      planId,
      tier: inferred.tier,
      afdianPayUrl: payUrl,
    });
  } catch (err) {
    console.error('[membership] subscribe error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * 内部：处理订阅 webhook 命中（webhook 调用）
 */
export async function activateSubscription({ userId, planId, outTradeNo, amount, payMonth }) {
  try {
    const inferred = inferSubscriptionTier(planId);
    if (!inferred) return { ok: false, error: 'unknown_plan' };

    const subId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + payMonth * 30 * 24 * 3600 * 1000;

    // 1. 重订/升级防御：先把该用户所有 active 订阅标记为 expired
    //    保留历史记录（不删除），避免 tier 与多 active 订阅冲突
    //    原 expires_at 保留作为历史到期时间，updated_at 标记被替换
    const existingActive = db.prepare(`
      SELECT id, afdian_plan_id, tier, pay_month, expires_at
      FROM user_subscriptions
      WHERE user_id = ? AND status = 'active'
      ORDER BY expires_at DESC
    `).all(userId);

    let expiredOldCount = 0;
    if (existingActive.length > 0) {
      const expireStmt = db.prepare(`
        UPDATE user_subscriptions
        SET status = 'expired', updated_at = ?
        WHERE id = ?
      `);
      for (const old of existingActive) {
        expireStmt.run(now, old.id);
        expiredOldCount++;
        console.log(`[membership] ⏳ 旧订阅过期: user=${userId}, plan=${old.afdian_plan_id}, tier=${old.tier}, 原到期=${new Date(old.expires_at).toISOString()}`);
      }
    }

    // 2. INSERT 新订阅（active）
    db.prepare(`
      INSERT INTO user_subscriptions (
        id, user_id, afdian_plan_id, tier, pay_month, amount,
        started_at, expires_at, status, afdian_out_trade_no, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `).run(subId, userId, planId, inferred.tier, payMonth, amount, now, expiresAt, outTradeNo, now, now);

    // 3. 更新用户 tier（永远是最新订阅的 tier）
    db.prepare(`UPDATE users SET tier = ? WHERE id = ?`).run(inferred.tier, userId);

    console.log(`[membership] ✅ subscription activated: user=${userId}, tier=${inferred.tier}, plan=${planId}, expires=${new Date(expiresAt).toISOString()}, 替换旧订阅=${expiredOldCount}`);

    // 4. 发订阅成功邮件（不阻塞主流程）
    const user = db.prepare(`SELECT email, nickname FROM users WHERE id = ?`).get(userId);
    if (user?.email) {
      sendSubscriptionSuccessEmail({
        userEmail: user.email,
        userNickname: user.nickname,
        tier: inferred.tier,
        expiresAt,
      }).catch((err) => console.error('[membership] 发订阅成功邮件失败:', err));
    }

    return { ok: true, subId, expiresAt, expiredOld: expiredOldCount };
  } catch (err) {
    console.error('[membership] activateSubscription error:', err);
    return { ok: false, error: err.message };
  }
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

  // 更新对应用户 tier 为 registered
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
