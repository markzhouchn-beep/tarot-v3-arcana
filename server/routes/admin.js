// ============================================================
// routes/admin.js · 管理后台 API（Phase 5 + Phase 6 完整功能）
// 创建：2026-09-01
// Phase 6 扩充：2026-09-02（AI 成本、用户详情、配额调整、续费率、告警、反馈）
// ============================================================

import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// ============================================================
// Phase 6 新增：AI 成本统计
// ============================================================

/**
 * GET /api/admin/stats/ai-cost
 * AI 调用成本：今日 / 本周 / 本月 + 按层拆分 + Top 10 用户
 */
router.get('/stats/ai-cost', requireAdmin, (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    // 按日聚合（oracle_messages 无 user_id，用 session_id 间接关联）
    const daily = db.prepare(`
      SELECT date(m.created_at/1000, 'unixepoch') AS day,
             COUNT(*) AS calls,
             COALESCE(SUM(m.cost_cny), 0) AS cost
      FROM oracle_messages m
      WHERE m.created_at > ?
      GROUP BY day
      ORDER BY day DESC
      LIMIT 30
    `).all(monthStart);

    // 今日成本
    const todayCost = db.prepare(`
      SELECT COUNT(*) AS calls, COALESCE(SUM(cost_cny), 0) AS cost
      FROM oracle_messages
      WHERE date(created_at/1000, 'unixepoch') = ?
    `).get(today);

    // 本周 / 本月
    const weekCost = db.prepare(`
      SELECT COUNT(*) AS calls, COALESCE(SUM(cost_cny), 0) AS cost
      FROM oracle_messages
      WHERE created_at > ?
    `).get(weekAgo);

    const monthCost = db.prepare(`
      SELECT COUNT(*) AS calls, COALESCE(SUM(cost_cny), 0) AS cost
      FROM oracle_messages
      WHERE created_at > ?
    `).get(monthStart);

    // Top 10 高调用用户（JOIN oracle_sessions 拿 user_id）
    const topUsers = db.prepare(`
      SELECT s.user_id, COUNT(*) AS calls, COALESCE(SUM(m.cost_cny), 0) AS cost
      FROM oracle_messages m
      JOIN oracle_sessions s ON s.id = m.session_id
      WHERE m.created_at > ? AND s.user_id IS NOT NULL
      GROUP BY s.user_id
      ORDER BY cost DESC
      LIMIT 10
    `).all(monthStart);

    res.json({
      today: { calls: todayCost?.calls || 0, cost: todayCost?.cost || 0 },
      week: { calls: weekCost?.calls || 0, cost: weekCost?.cost || 0 },
      month: { calls: monthCost?.calls || 0, cost: monthCost?.cost || 0 },
      daily,
      top_users: topUsers,
    });
  } catch (err) {
    console.error('[admin] ai-cost error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ============================================================
// Phase 6 新增：用户管理
// ============================================================

/**
 * GET /api/admin/users
 * 用户列表（支持搜索 / 筛选）
 */
router.get('/users', requireAdmin, (req, res) => {
  try {
    const { search, tier, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT id, email, tier, nickname, invite_code, email_verified, created_at FROM users WHERE 1=1`;
    const params = [];
    if (search) {
      sql += ` AND (email LIKE ? OR nickname LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (tier) {
      sql += ` AND tier = ?`;
      params.push(tier);
    }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const users = db.prepare(sql).all(...params);
    const total = db.prepare(`SELECT COUNT(*) AS n FROM users`).get().n;
    res.json({ users, total });
  } catch (err) {
    console.error('[admin] users error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/admin/users/:id
 * 用户详情：基本信息 + 订单 + 订阅 + 配额 + 追问计数
 */
router.get('/users/:id', requireAdmin, (req, res) => {
  try {
    const user = db.prepare(`SELECT id, email, tier, nickname, invite_code, email_verified, created_at, invited_by FROM users WHERE id = ?`).get(req.params.id);
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' });

    const orders = db.prepare(`SELECT id, tier, spread_type, status, amount, paid_at, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`).all(req.params.id);
    const subs = db.prepare(`SELECT * FROM user_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`).all(req.params.id);
    const quotas = db.prepare(`SELECT * FROM user_quotas WHERE user_id = ?`).all(req.params.id);
    const oracleCalls = db.prepare(`
      SELECT COUNT(*) AS n, COALESCE(SUM(m.cost_cny), 0) AS cost
      FROM oracle_messages m
      JOIN oracle_sessions s ON s.id = m.session_id
      WHERE s.user_id = ?
    `).get(req.params.id);
    const inviteCount = db.prepare(`SELECT COUNT(*) AS n FROM invites WHERE inviter_user_id = ?`).get(req.params.id);

    res.json({
      user,
      orders,
      subscriptions: subs,
      quotas,
      stats: {
        oracle_calls: oracleCalls?.n || 0,
        oracle_cost: oracleCalls?.cost || 0,
        invites_sent: inviteCount?.n || 0,
      },
    });
  } catch (err) {
    console.error('[admin] user detail error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/admin/users/:id/tier
 * 手动调整等级（赠送会员 / 降级）
 */
router.post('/users/:id/tier', requireAdmin, (req, res) => {
  try {
    const { tier, expires_at, reason } = req.body || {};
    if (!tier) return res.status(400).json({ error: 'TIER_REQUIRED' });

    const validTiers = ['guest', 'registered', 'silver', 'gold'];
    if (!validTiers.includes(tier)) return res.status(400).json({ error: 'INVALID_TIER' });

    db.prepare(`UPDATE users SET tier = ? WHERE id = ?`).run(tier, req.params.id);

    // 如果是赠送 silver/gold，插入订阅表
    if ((tier === 'silver' || tier === 'gold') && expires_at) {
      db.prepare(`
        INSERT INTO user_subscriptions (id, user_id, afdian_plan_id, tier, pay_month, amount, started_at, expires_at, status, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, 'active', 'admin_grant', ?, ?)
      `).run(crypto.randomUUID(), req.params.id, `admin_${tier}_${Date.now()}`, tier, Date.now(), expires_at, Date.now(), Date.now());
    }

    console.log(`[admin] tier change: user=${req.params.id} tier=${tier} reason="${reason || ''}"`);
    res.json({ ok: true, tier, expires_at: expires_at || null });
  } catch (err) {
    console.error('[admin] tier change error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/admin/users/:id/grant-quota
 * 手动赠送配额（追问次数）
 */
router.post('/users/:id/grant-quota', requireAdmin, (req, res) => {
  try {
    const { quota_type = 'oracle_self', amount = 10, reason } = req.body || {};
    const today = new Date().toISOString().slice(0, 10);

    // 今日已有记录 → limit_value 累加
    const existing = db.prepare(`SELECT id, limit_value FROM user_quotas WHERE user_id = ? AND quota_date = ? AND quota_type = ?`).get(req.params.id, today, quota_type);

    if (existing) {
      db.prepare(`UPDATE user_quotas SET limit_value = limit_value + ? WHERE id = ?`).run(amount, existing.id);
    } else {
      db.prepare(`
        INSERT INTO user_quotas (id, user_id, quota_date, quota_type, used, limit_value, created_at)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `).run(crypto.randomUUID(), req.params.id, today, quota_type, amount, Date.now());
    }

    console.log(`[admin] quota grant: user=${req.params.id} type=${quota_type} amount=${amount} reason="${reason || ''}"`);
    res.json({ ok: true, quota_type, amount });
  } catch (err) {
    console.error('[admin] grant quota error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ============================================================
// Phase 6 新增：续费率监控（30/60/90 天）
// ============================================================

/**
 * GET /api/admin/stats/renewal
 * 续费率：30/60/90 天窗口
 */
router.get('/stats/renewal', requireAdmin, (req, res) => {
  try {
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const windows = [30, 60, 90];

    const result = windows.map((days) => {
      const start = now - days * day;
      // 该窗口内订阅到期的用户
      const expired = db.prepare(`
        SELECT COUNT(DISTINCT user_id) AS n
        FROM user_subscriptions
        WHERE expires_at > ? AND expires_at < ?
      `).get(start, now);
      // 其中续订了的
      const renewed = db.prepare(`
        SELECT COUNT(DISTINCT s1.user_id) AS n
        FROM user_subscriptions s1
        WHERE s1.expires_at > ? AND s1.expires_at < ?
          AND EXISTS (
            SELECT 1 FROM user_subscriptions s2
            WHERE s2.user_id = s1.user_id AND s2.started_at > s1.expires_at
          )
      `).get(start, now);
      const rate = expired.n > 0 ? (renewed.n / expired.n) * 100 : 0;
      return {
        window_days: days,
        expired: expired.n || 0,
        renewed: renewed.n || 0,
        renewal_rate: rate.toFixed(2),
      };
    });

    // 即将过期（7 天内）订阅
    const expiringSoon = db.prepare(`
      SELECT s.*, u.email FROM user_subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'active'
        AND s.expires_at > ?
        AND s.expires_at < ?
      ORDER BY s.expires_at ASC
      LIMIT 50
    `).all(now, now + 7 * day);

    res.json({ windows: result, expiring_soon: expiringSoon });
  } catch (err) {
    console.error('[admin] renewal error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ============================================================
// Phase 6 新增：敏感词告警
// ============================================================

/**
 * GET /api/admin/alerts/sensitive
 * 敏感词告警（oracle_audit_log 表）
 */
router.get('/alerts/sensitive', requireAdmin, (req, res) => {
  try {
    const { resolved } = req.query;
    let sql = `SELECT * FROM oracle_audit_log WHERE 1=1`;
    const params = [];
    if (resolved !== undefined) {
      sql += ` AND resolved = ?`;
      params.push(resolved === 'true' ? 1 : 0);
    }
    sql += ` ORDER BY created_at DESC LIMIT 100`;
    const alerts = db.prepare(sql).all(...params);
    res.json({ alerts });
  } catch (err) {
    console.error('[admin] alerts error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/admin/alerts/sensitive/:id/resolve
 * 标记敏感词告警已处理
 */
router.post('/alerts/sensitive/:id/resolve', requireAdmin, (req, res) => {
  try {
    db.prepare(`UPDATE oracle_audit_log SET resolved = 1, resolved_at = ? WHERE id = ?`).run(Date.now(), req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] alert resolve error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ============================================================
// Phase 6 新增：用户反馈
// ============================================================

/**
 * GET /api/admin/feedback
 * 用户反馈列表
 */
router.get('/feedback', requireAdmin, (req, res) => {
  try {
    const { status, type } = req.query;
    let sql = `SELECT f.*, u.email FROM feedback f LEFT JOIN users u ON u.id = f.user_id WHERE 1=1`;
    const params = [];
    if (status) { sql += ` AND f.status = ?`; params.push(status); }
    if (type) { sql += ` AND f.type = ?`; params.push(type); }
    sql += ` ORDER BY f.created_at DESC LIMIT 200`;
    const feedback = db.prepare(sql).all(...params);
    res.json({ feedback });
  } catch (err) {
    console.error('[admin] feedback error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/admin/feedback/:id/handle
 * 标记反馈已处理
 */
router.post('/feedback/:id/handle', requireAdmin, (req, res) => {
  try {
    const { admin_note } = req.body || {};
    db.prepare(`UPDATE feedback SET status = 'handled', admin_note = ?, handled_at = ? WHERE id = ?`).run(admin_note || '', Date.now(), req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] feedback handle error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/admin/stats/feedback
 * 反馈聚合统计
 */
router.get('/stats/feedback', requireAdmin, (req, res) => {
  try {
    const byType = db.prepare(`
      SELECT type, COUNT(*) AS n
      FROM feedback
      GROUP BY type
      ORDER BY n DESC
    `).all();
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) AS n
      FROM feedback
      GROUP BY status
    `).all();
    const recent = db.prepare(`
      SELECT COUNT(*) AS n FROM feedback
      WHERE created_at > ?
    `).get(Date.now() - 7 * 24 * 3600 * 1000);
    res.json({ by_type: byType, by_status: byStatus, last_7_days: recent?.n || 0 });
  } catch (err) {
    console.error('[admin] feedback stats error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ============================================================
// Phase 6 新增：订单详情 + reconcile
// ============================================================

/**
 * GET /api/admin/orders/:id
 * 订单详情
 */
router.get('/orders/:id', requireAdmin, (req, res) => {
  try {
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
    const user = order.user_id ? db.prepare(`SELECT id, email, tier FROM users WHERE id = ?`).get(order.user_id) : null;
    const reading = order.id ? db.prepare(`SELECT id, status, summary, created_at FROM readings WHERE order_id = ?`).all(order.id) : [];
    res.json({ order, user, readings: reading });
  } catch (err) {
    console.error('[admin] order detail error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/admin/orders/:id/refund
 * 手动退款（标 refunded）
 */
router.post('/orders/:id/refund', requireAdmin, (req, res) => {
  try {
    const { reason } = req.body || {};
    db.prepare(`UPDATE orders SET status = 'refunded', refunded_at = ?, refund_reason = ? WHERE id = ?`).run(Date.now(), reason || '', req.params.id);
    console.log(`[admin] order refund: id=${req.params.id} reason="${reason || ''}"`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] refund error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/admin/stats/overview
 * 总览：今日订单 / 营收 / 订阅 / 追问
 */
router.get('/stats/overview', requireAdmin, (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const todayStart = new Date(today).getTime();

    const ordersToday = db.prepare(`
      SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as revenue
      FROM orders
      WHERE date(created_at/1000, 'unixepoch') = ? AND is_test = 0
    `).get(today);

    const subsActive = db.prepare(`
      SELECT COUNT(*) as cnt FROM user_subscriptions WHERE status = 'active'
    `).get();

    const oracleToday = db.prepare(`
      SELECT COUNT(*) as cnt FROM oracle_messages WHERE date(created_at/1000, 'unixepoch') = ?
    `).get(today);

    const pendingOrders = db.prepare(`
      SELECT COUNT(*) as cnt FROM orders
      WHERE status = 'pending' AND created_at < ? AND is_test = 0
    `).get(Date.now() - 30 * 60 * 1000);

    res.json({
      today: today,
      orders: ordersToday.cnt || 0,
      revenue: ordersToday.revenue || 0,
      active_subs: subsActive.cnt || 0,
      oracle_calls_today: oracleToday.cnt || 0,
      pending_orders_warning: pendingOrders.cnt || 0,
    });
  } catch (err) {
    console.error('[admin] stats error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/admin/orders
 * 订单列表
 */
router.get('/orders', requireAdmin, (req, res) => {
  try {
    const { status, is_test, limit = 50, offset = 0 } = req.query;

    let sql = `SELECT * FROM orders WHERE 1=1`;
    const params = [];
    if (status) { sql += ` AND status = ?`; params.push(status); }
    if (is_test !== undefined) { sql += ` AND is_test = ?`; params.push(parseInt(is_test)); }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const orders = db.prepare(sql).all(...params);
    res.json({ orders });
  } catch (err) {
    console.error('[admin] orders error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/admin/subscriptions
 * 订阅列表
 */
router.get('/subscriptions', requireAdmin, (req, res) => {
  try {
    const { status, tier } = req.query;
    let sql = `SELECT * FROM user_subscriptions WHERE 1=1`;
    const params = [];
    if (status) { sql += ` AND status = ?`; params.push(status); }
    if (tier) { sql += ` AND tier = ?`; params.push(tier); }
    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const subs = db.prepare(sql).all(...params);
    res.json({ subscriptions: subs });
  } catch (err) {
    console.error('[admin] subs error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/admin/subscriptions/:id/extend
 * 手动续期
 */
router.post('/subscriptions/:id/extend', requireAdmin, (req, res) => {
  try {
    const { days = 30 } = req.body || {};
    const sub = db.prepare(`SELECT * FROM user_subscriptions WHERE id = ?`).get(req.params.id);
    if (!sub) return res.status(404).json({ error: 'NOT_FOUND' });

    const newExpires = Math.max(Date.now(), sub.expires_at) + days * 24 * 3600 * 1000;

    db.prepare(`
      UPDATE user_subscriptions SET expires_at = ?, status = 'active', updated_at = ? WHERE id = ?
    `).run(newExpires, Date.now(), sub.id);

    res.json({ ok: true, new_expires_at: newExpires });
  } catch (err) {
    console.error('[admin] extend error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/admin/oracle/messages?flagged=true&reviewed=false
 * 追问审查（敏感词告警）
 */
router.get('/oracle/messages', requireAdmin, (req, res) => {
  try {
    const { flagged, reviewed } = req.query;

    let sql = `
      SELECT m.*, s.user_id
      FROM oracle_messages m
      LEFT JOIN oracle_sessions s ON s.id = m.session_id
      WHERE 1=1
    `;
    const params = [];

    if (reviewed !== undefined) {
      if (reviewed === 'false') {
        sql += ` AND (m.is_resolved = 0 OR m.is_resolved IS NULL)`;
      }
    }

    sql += ` ORDER BY m.created_at DESC LIMIT 100`;
    const messages = db.prepare(sql).all(...params);

    res.json({ messages });
  } catch (err) {
    console.error('[admin] oracle messages error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

export default router;
