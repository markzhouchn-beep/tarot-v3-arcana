// ============================================================
// middleware/quota-guard.js · 配额闸门
// Phase 3 充实完整逻辑
// 创建：2026-09-01
// ============================================================

import { getQuotaToday, consumeReadingQuota, checkCooldown, QUOTA_LIMITS } from '../lib/quota.js';

/**
 * 配额闸门（追问用）
 * 检查用户配额 → 足够则扣减 → 不够则返 402
 */
export function oracleQuotaGuard(req, res, next) {
  const userId = req.user?.id;
  const tier = req.user?.tier || 'guest';

  // 访客：拒绝自由提问
  if (!userId || tier === 'guest') {
    return res.status(401).json({
      error: 'LOGIN_REQUIRED',
      message: '请先登录或使用预设问题',
    });
  }

  const { reading_id } = req.body || {};

  // 单报告追问：先扣 reading_question_quota，再用日配额
  if (reading_id) {
    const source = consumeReadingQuota(reading_id, userId, tier);
    if (source === 'exhausted') {
      return res.status(402).json({
        error: 'QUOTA_EXHAUSTED',
        message: '今日配额已用完，升级会员获得更多次数',
        remaining: 0,
      });
    }
    req.quotaSource = source;
  } else {
    // 独立 Oracle 页面：扣日配额
    const today = getQuotaToday(userId, tier, 'oracle_self');
    if (today.remaining <= 0) {
      return res.status(402).json({
        error: 'QUOTA_EXHAUSTED',
        message: '今日配额已用完',
        remaining: 0,
      });
    }
    // Phase 3 实际扣减
  }

  // 冷却检查
  if (reading_id) {
    const cd = checkCooldown(reading_id, tier);
    req.cooldownWarning = cd.need_cooldown ? '你的探索已经很深入了...' : null;
  }

  next();
}

export default { oracleQuotaGuard };
