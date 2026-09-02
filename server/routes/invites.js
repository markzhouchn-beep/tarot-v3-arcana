// ============================================================
// routes/invites.js · 邀请系统 API
// v3.0 Phase 4 实施
// 创建：2026-09-02 14:15
//
// 路由：
// - GET  /api/invites/me         当前用户的邀请码 + 统计 + 记录 + 奖励
// - GET  /api/invites/lookup/:code   查询邀请码对应的邀请人（脱敏）
// - POST /api/invites/effective  手动标记有效动作（一般自动触发）
// ============================================================

import express from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import {
  getInviteStats, findInviterByCode,
  markEffectiveAction, checkAndGrantMilestoneRewards,
} from '../lib/invite.js';

const router = express.Router();

function getUserId(req) {
  return req.user?.id || req.session?.user_id || null;
}

/**
 * GET /api/invites/me
 * 当前用户的邀请统计 + 邀请记录 + 奖励列表
 */
router.get('/me', requireAuth, (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'LOGIN_REQUIRED' });

    const stats = getInviteStats(userId);
    res.json({ ok: true, ...stats });
  } catch (err) {
    console.error('[invites] me error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/invites/lookup/:code
 * 查询邀请码对应的邀请人信息（脱敏：仅昵称 + tier）
 * 用于注册页"你正在被 XXX 邀请"提示
 */
router.get('/lookup/:code', (req, res) => {
  try {
    const { code } = req.params;
    const inviter = findInviterByCode(code);
    if (!inviter) {
      return res.status(404).json({ ok: false, error: 'INVALID_CODE', message: '邀请码无效' });
    }
    // 脱敏：仅返回昵称和等级
    res.json({
      ok: true,
      inviter: {
        nickname: inviter.nickname || inviter.email.split('@')[0], // fallback 邮箱前缀
        tier: inviter.tier,
      },
    });
  } catch (err) {
    console.error('[invites] lookup error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/invites/effective
 * 手动触发"有效动作"标记（一般 yes-no/draw 时自动调用）
 */
router.post('/effective', requireAuth, (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'LOGIN_REQUIRED' });

    markEffectiveAction({ inviteeUserId: userId });

    // 检查被邀请人是否完成了 → 触发邀请人的里程碑检查
    const inviterUserId = db.prepare(`SELECT invited_by FROM users WHERE id = ?`).get(userId)?.invited_by;
    if (inviterUserId) {
      checkAndGrantMilestoneRewards(inviterUserId);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[invites] effective error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

export default router;