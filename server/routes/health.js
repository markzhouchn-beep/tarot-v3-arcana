// ============================================================
// routes/health.js · 健康检查
// 创建：2026-09-01
// ============================================================

import { Router } from 'express';
import db from '../db.js';
import { config } from '../lib/config.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    // DB ping
    const dbOk = db.prepare('SELECT 1 as ok').get().ok === 1;

    // 关键表存在性
    const tableCheck = db.prepare(`
      SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name IN
      ('users', 'orders', 'readings', 'user_subscriptions', 'oracle_sessions')
    `).get();

    res.json({
      ok: dbOk && tableCheck.cnt >= 5,
      version: '3.0.0',
      phase: '0',
      db: dbOk ? 'ok' : 'error',
      tables: tableCheck.cnt,
      mock_mode: config.MOCK_MODE === '1',
      model: config.MINIMAX_MODEL,
      timestamp: Date.now(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
