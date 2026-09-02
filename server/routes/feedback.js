// ============================================================
// routes/feedback.js · 用户反馈 API
// 创建：2026-09-02（Phase 6）
// ============================================================

import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

const VALID_TYPES = ['bug', 'suggestion', 'praise', 'other'];

/**
 * POST /api/feedback
 * 用户提交反馈（可匿名/可登录）
 * Body: { type, content, contact?, page_url?, device_info? }
 */
router.post('/', optionalAuth, (req, res) => {
  try {
    const { type, content, contact, page_url, device_info } = req.body || {};
    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'INVALID_TYPE', valid_types: VALID_TYPES });
    }
    if (!content || content.trim().length < 5) {
      return res.status(400).json({ error: 'CONTENT_TOO_SHORT', min_length: 5 });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'CONTENT_TOO_LONG', max_length: 2000 });
    }

    const id = crypto.randomUUID();
    const userId = req.user?.id || null;

    db.prepare(`
      INSERT INTO feedback (id, user_id, type, content, contact, page_url, device_info, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(id, userId, type, content.trim(), contact || null, page_url || null, device_info || null, Date.now());

    console.log(`[feedback] new: id=${id} type=${type} user=${userId || 'anonymous'}`);
    res.json({ ok: true, id });
  } catch (err) {
    console.error('[feedback] submit error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/feedback/mine
 * 当前用户的历史反馈（登录后可用）
 */
router.get('/mine', optionalAuth, (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'LOGIN_REQUIRED' });
    const feedback = db.prepare(`
      SELECT id, type, content, status, admin_note, created_at, handled_at
      FROM feedback WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 50
    `).all(req.user.id);
    res.json({ feedback });
  } catch (err) {
    console.error('[feedback] mine error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

export default router;