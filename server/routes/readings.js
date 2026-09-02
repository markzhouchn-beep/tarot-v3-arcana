// ============================================================
// routes/readings.js · 解读详情
// 创建：2026-09-01
// ============================================================

import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/readings/:id
 * 解读详情（access_token 鉴权）
 */
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const { access_token } = req.query;

    const reading = db.prepare(`SELECT * FROM readings WHERE id = ?`).get(req.params.id);
    if (!reading) {
      return res.status(404).json({ error: 'READING_NOT_FOUND' });
    }

    // 鉴权：登录用户 OR access_token 持有者
    const isOwner = req.user?.id === reading.user_id;
    const hasToken = access_token && access_token === reading.access_token;

    if (!isOwner && !hasToken) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    // 追问配额
    const rq = db.prepare(`
      SELECT total_quota, used FROM reading_question_quota WHERE reading_id = ?
    `).get(reading.id);

    res.json({
      id: reading.id,
      question: reading.question,
      cards: JSON.parse(reading.cards_json || '[]'),
      spread_type: reading.spread_type,
      interpretation: reading.interpretation,
      interpretation_length: reading.interpretation_length,
      sections: reading.sections_json ? JSON.parse(reading.sections_json) : [],
      summary: reading.summary || '',
      question_count: reading.question_count,
      is_resolved: !!reading.is_resolved,
      created_at: reading.created_at,
      access_token: hasToken ? reading.access_token : undefined,
      question_quota: rq ? { total: rq.total_quota, used: rq.used, remaining: rq.total_quota - rq.used } : null,
    });
  } catch (err) {
    console.error('[readings] get error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/readings/:id/resolve
 * 标记解读为已解决
 */
router.post('/:id/resolve', requireAuth, (req, res) => {
  try {
    const reading = db.prepare(`SELECT * FROM readings WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
    if (!reading) {
      return res.status(404).json({ error: 'READING_NOT_FOUND' });
    }

    db.prepare(`UPDATE readings SET is_resolved = ? WHERE id = ?`).run(req.body.is_resolved ? 1 : 0, reading.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[readings] resolve error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

export default router;
