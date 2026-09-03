// ============================================================
// routes/yes-no.js · Yes/No 免费抽（不调 AI，牌意库拼装）
// 创建：2026-09-01
// ============================================================

import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { getQuotaToday, incrementQuota } from '../lib/quota.js';
import {
  markEffectiveAction, checkAndGrantMilestoneRewards,
} from '../lib/invite.js';
import { drawCards, inferYesNo } from '../lib/tarot-knowledge.js';

const router = Router();

/**
 * GET /api/yes-no/quota
 * Yes/No 今日配额（按 device_id 或 user_id）
 */
router.get('/quota', optionalAuth, (req, res) => {
  try {
    const tier = req.user?.tier || 'guest';
    const deviceId = req.headers['x-device-id'] || req.ip;
    const userId = req.user?.id;

    const today = new Date().toISOString().slice(0, 10);

    let used = 0;
    if (userId) {
      const row = db.prepare(`
        SELECT COUNT(*) as cnt FROM yes_no_records
        WHERE user_id = ? AND date(created_at/1000, 'unixepoch') = ?
      `).get(userId, today);
      used = row?.cnt || 0;
    } else if (deviceId) {
      const row = db.prepare(`
        SELECT COUNT(*) as cnt FROM yes_no_records
        WHERE device_id = ? AND date(created_at/1000, 'unixepoch') = ?
      `).get(deviceId, today);
      used = row?.cnt || 0;
    }

    const limitMap = { guest: 1, registered: 3, silver: 10, gold: 999 };
    const limit = limitMap[tier] || 1;

    res.json({
      used,
      limit,
      remaining: Math.max(0, limit - used),
      reset_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
  } catch (err) {
    console.error('[yes-no] quota error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/yes-no/draw
 * 抽 1 张牌（不调 AI，从牌意库拼装）
 */
router.post('/draw', optionalAuth, (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || question.length > 500) {
      return res.status(400).json({ error: 'INVALID_QUESTION' });
    }

    const deviceId = req.headers['x-device-id'] || req.ip;
    const userId = req.user?.id;

    // 配额检查
    const tier = req.user?.tier || 'guest';
    const limitMap = { guest: 1, registered: 3, silver: 10, gold: 999 };
    const limit = limitMap[tier] || 1;

    // 简化：直接查今日记录数
    const today = new Date().toISOString().slice(0, 10);
    const usedRow = userId
      ? db.prepare(`SELECT COUNT(*) as cnt FROM yes_no_records WHERE user_id = ? AND date(created_at/1000, 'unixepoch') = ?`).get(userId, today)
      : db.prepare(`SELECT COUNT(*) as cnt FROM yes_no_records WHERE device_id = ? AND date(created_at/1000, 'unixepoch') = ?`).get(deviceId, today);
    const used = usedRow?.cnt || 0;

    if (used >= limit) {
      return res.status(429).json({
        error: 'QUOTA_EXHAUSTED',
        message: '今日 Yes/No 免费次数已用完',
        remaining: 0,
      });
    }

    // 抽 1 张牌
    const cards = drawCards(1);
    const card = cards[0];
    const result = inferYesNo(card);

    // ⚠️ 关键修复：inferYesNo 返中文（是/否/不确定/视情况而定），
    // 但 resultMap 键是英文（yes/no/uncertain）→ 直接查返 undefined
    // 响应里 result/keywords/explanation 全部缺失 → 前端崩
    const RESULT_NORMALIZE = {
      '是': 'yes',
      '否': 'no',
      '不确定': 'uncertain',
      '视情况而定': 'uncertain',  // '视情况而定' 近似于 uncertain
    };
    const resultKey = RESULT_NORMALIZE[result] || 'uncertain';

    // 拼装回答（不调 AI）
    const resultMap = {
      yes: {
        result: 'yes',
        keywords: card.keywords_up?.slice(0, 3) || [],
        energy_tendency: card.energy_up || '',
        explanation: `${card.name}（${card.orientation}）的能量指向肯定。`,
        action_hint: '顺势而为，把握当下的机会。',
      },
      no: {
        result: 'no',
        keywords: card.keywords_down?.slice(0, 3) || [],
        energy_tendency: card.energy_down || '',
        explanation: `${card.name}（${card.orientation}）提示当前能量尚未成熟。`,
        action_hint: '等待合适的时机，先稳住脚步。',
      },
      uncertain: {
        result: 'uncertain',
        keywords: ['观察', '内省', '等待'],
        energy_tendency: '命运之轮仍在转动，答案尚未显现。',
        explanation: `${card.name}（${card.orientation}）提示你需要先厘清问题本身。`,
        action_hint: '建议先抽一张「今日指引」深入探索。',
      },
    };

    // 记录
    db.prepare(`
      INSERT INTO yes_no_records (id, user_id, device_id, question, card_id, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), userId, deviceId, question, card.id, result, Date.now());

    // Phase 4: 标记为有效动作（被邀请人首次 Yes/No → 触发邀请人里程碑检查）
    if (userId) {
      try {
        markEffectiveAction({ inviteeUserId: userId });
        const inviterUserId = db.prepare(`SELECT invited_by FROM users WHERE id = ?`).get(userId)?.invited_by;
        if (inviterUserId) {
          checkAndGrantMilestoneRewards(inviterUserId);
        }
      } catch (e) { /* 不阻断主流程 */ }
    }

    res.json({
      ok: true,
      card: { id: card.id, name: card.name, orientation: card.orientation },
      question,
      ...resultMap[resultKey],
      remaining: limit - used - 1,
    });
  } catch (err) {
    console.error('[yes-no] draw error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

export default router;
