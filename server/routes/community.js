// ============================================================
// routes/community.js · 社区 MVP（精选追问匿名分享）
// v3.0 Phase 4 实施
// 创建：2026-09-02 14:15
//
// PD v0.8 第 11 节 Phase 4 末项：
// "社区 MVP（匿名分享精选追问 → 静态展示）"
//
// 路由：
// - GET  /api/community/featured   公开：精选追问列表（分页）
// - POST /api/community/feature/:messageId   管理员：标记精选
// - POST /api/community/unfeature/:messageId 管理员：取消精选
// - GET  /api/admin/community/messages?featured=true   管理员：管理列表
// ============================================================

import express from 'express';
import db from '../db.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { config } from '../lib/config.js';

const router = express.Router();

/**
 * GET /api/community/featured
 * 公开 API：精选追问列表（脱敏：仅截取 user content 前 100 字 + assistant 前 280 字）
 */
router.get('/featured', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20'), 50);
    const offset = parseInt(req.query.offset || '0');

    // 查精选：每个 featured 对话取一条 user + assistant 对
    const featured = db.prepare(`
      SELECT
        m.id, m.content AS user_content, m.created_at,
        a.content AS ai_content, a.depth_layer,
        m.session_id
      FROM oracle_messages m
      JOIN oracle_messages a
        ON a.session_id = m.session_id
        AND a.role = 'assistant'
        AND a.created_at > m.created_at
      WHERE m.role = 'user' AND m.featured = 1
      ORDER BY m.featured_at DESC, m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    // 脱敏：截取前 N 字
    const items = featured.map(f => ({
      id: f.id,
      session_id: f.session_id,
      question: f.user_content.length > 100
        ? f.user_content.slice(0, 100) + '…'
        : f.user_content,
      answer: f.ai_content.length > 280
        ? f.ai_content.slice(0, 280) + '…'
        : f.ai_content,
      depth_layer: f.depth_layer,
      featured_at: f.created_at,
    }));

    const total = db.prepare(`SELECT COUNT(*) AS cnt FROM oracle_messages WHERE role = 'user' AND featured = 1`).get()?.cnt || 0;

    res.json({
      ok: true,
      items,
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[community] featured error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/community/feature/:messageId
 * 管理员：标记一条追问为精选
 * 简化：用 admin password header 校验（避免引入完整 admin auth）
 */
router.post('/feature/:messageId', (req, res) => {
  try {
    const adminPwd = req.headers['x-admin-password'];
    // Phase 5 admin auth 完善，这里先用 ADMIN_PASSWORD 环境变量
    if (!process.env.ADMIN_PASSWORD || adminPwd !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' });
    }

    const { messageId } = req.params;
    const msg = db.prepare(`SELECT id, role FROM oracle_messages WHERE id = ?`).get(messageId);
    if (!msg) return res.status(404).json({ error: 'MESSAGE_NOT_FOUND' });
    if (msg.role !== 'user') {
      return res.status(400).json({ error: 'ONLY_USER_MESSAGES', message: '只能精选 user 追问' });
    }

    db.prepare(`
      UPDATE oracle_messages
      SET featured = 1, featured_at = ?
      WHERE id = ?
    `).run(Date.now(), messageId);

    res.json({ ok: true, message_id: messageId, featured: true });
  } catch (err) {
    console.error('[community] feature error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

router.post('/unfeature/:messageId', (req, res) => {
  try {
    const adminPwd = req.headers['x-admin-password'];
    if (!process.env.ADMIN_PASSWORD || adminPwd !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' });
    }
    const { messageId } = req.params;
    db.prepare(`UPDATE oracle_messages SET featured = 0, featured_at = NULL WHERE id = ?`).run(messageId);
    res.json({ ok: true, message_id: messageId, featured: false });
  } catch (err) {
    console.error('[community] unfeature error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

export default router;