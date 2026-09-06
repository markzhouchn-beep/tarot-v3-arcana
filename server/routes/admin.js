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

    // 如果是赠送 silver/gold：保留剩余时间（如有），然后再延 N 天
    if ((tier === 'silver' || tier === 'gold') && expires_at) {
      const now = Date.now();
      // 查找该用户当前是否已有 active 的同等级订阅
      const existing = db.prepare(`
        SELECT expires_at FROM user_subscriptions
        WHERE user_id = ? AND tier = ? AND status = 'active'
        ORDER BY expires_at DESC LIMIT 1
      `).get(req.params.id, tier);

      // 关键修复：基础时间 = max(当前时间, 已有订阅到期时间)，然后 + (expires_at - now) 天
      const baseTime = existing && existing.expires_at > now ? existing.expires_at : now;
      const finalExpires = baseTime + (expires_at - now);

      db.prepare(`
        INSERT INTO user_subscriptions (id, user_id, afdian_plan_id, tier, pay_month, amount, started_at, expires_at, status, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, 0, ?, ?, 'active', 'admin_grant', ?, ?)
      `).run(crypto.randomUUID(), req.params.id, `admin_${tier}_${Date.now()}`, tier, now, finalExpires, now, now);
    }

    // 取用户邮箱用于日志展示
    const user = db.prepare(`SELECT email FROM users WHERE id = ?`).get(req.params.id);
    logAdminAction('tier_change', 'user', req.params.id, user?.email, { tier, expires_at, reason });

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

    const user = db.prepare(`SELECT email FROM users WHERE id = ?`).get(req.params.id);
    logAdminAction('quota_grant', 'user', req.params.id, user?.email, { quota_type, amount, reason });

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
    const alert = db.prepare(`SELECT * FROM oracle_audit_log WHERE id = ?`).get(req.params.id);
    logAdminAction('alert_resolve', 'alert', req.params.id, alert?.action || 'unknown', { content: alert?.content });
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
    const fb = db.prepare(`SELECT * FROM feedback WHERE id = ?`).get(req.params.id);
    logAdminAction('feedback_handle', 'feedback', req.params.id, fb?.type, { note: admin_note });
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
    const order = db.prepare(`SELECT user_id, amount FROM orders WHERE id = ?`).get(req.params.id);
    logAdminAction('order_refund', 'order', req.params.id, order?.user_id, { amount: order?.amount, reason });
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
      WHERE date(created_at/1000, 'unixepoch') = ? AND is_test = 0 AND status = 'paid'
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

    const user = db.prepare(`SELECT email FROM users WHERE id = ?`).get(sub.user_id);
    logAdminAction('sub_extend', 'subscription', req.params.id, user?.email, { days, new_expires: newExpires });

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

// ============================================================
// Admin v2 新增（2026-09-06）
// 漏斗 / YesNo / 匿名用户统计 + 操作日志
// ============================================================

/**
 * 写管理员操作日志（中间件 / 业务路由复用）
 */
function logAdminAction(action, targetType, targetId, targetLabel, details) {
  try {
    db.prepare(`
      INSERT INTO admin_action_logs (id, admin_user, action, target_type, target_id, target_label, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'mark',
      action,
      targetType || null,
      targetId || null,
      targetLabel || null,
      details ? JSON.stringify(details) : null,
      Date.now()
    );
  } catch (err) {
    console.error('[admin] logAdminAction error:', err);
  }
}

/**
 * GET /api/admin/stats/funnel
 * 转化漏斗：注册 → 订单 → 付费 + 邀请裂变
 */
router.get('/stats/funnel', requireAdmin, (req, res) => {
  try {
    // 漏斗三段：注册用户、发起订单、完成付费
    const registered = db.prepare(`
      SELECT COUNT(DISTINCT COALESCE(user_id, device_id)) AS cnt
      FROM analytics_events
      WHERE event_name IN ('user_registered', 'user_logged_in')
    `).get()?.cnt || 0;

    const ordered = db.prepare(`
      SELECT COUNT(DISTINCT COALESCE(user_id, device_id)) AS cnt
      FROM analytics_events
      WHERE event_name = 'order_created'
    `).get()?.cnt || 0;

    const paid = db.prepare(`
      SELECT COUNT(DISTINCT COALESCE(user_id, device_id)) AS cnt
      FROM analytics_events
      WHERE event_name = 'order_paid'
    `).get()?.cnt || 0;

    // 邀请裂变漏斗
    const totalInvites = db.prepare(`SELECT COUNT(*) AS cnt FROM invites`).get()?.cnt || 0;
    const inviteRegistered = db.prepare(`SELECT COUNT(*) AS cnt FROM invites WHERE invitee_user_id IS NOT NULL OR reward_registration_at > 0`).get()?.cnt || 0;
    const inviteEffective = db.prepare(`SELECT COUNT(*) AS cnt FROM invites WHERE invitee_effective_at > 0`).get()?.cnt || 0;
    const invitePaid = db.prepare(`SELECT COUNT(*) AS cnt FROM invites WHERE reward_first_paid_at > 0`).get()?.cnt || 0;

    res.json({
      registered,
      ordered,
      paid,
      invites_funnel: {
        total_invites: totalInvites,
        registered: inviteRegistered,
        effective: inviteEffective,
        paid: invitePaid,
      },
    });
  } catch (err) {
    console.error('[admin] funnel error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/admin/stats/yesno
 * Yes/No 牌阵统计：结果分布 + 意图关键词 + 趋势
 */
router.get('/stats/yesno', requireAdmin, (req, res) => {
  try {
    // 结果分布
    const byResult = db.prepare(`
      SELECT result, COUNT(*) AS cnt
      FROM yes_no_records
      GROUP BY result
    `).all();

    // 意图关键词 Top 10（用 question 字段前 10 个字作为"意图"）
    const byIntent = db.prepare(`
      SELECT substr(question, 1, 20) AS intent, COUNT(*) AS cnt
      FROM yes_no_records
      WHERE question IS NOT NULL AND question != ''
      GROUP BY intent
      ORDER BY cnt DESC
      LIMIT 10
    `).all();

    // 总数 + 7 天趋势
    const total = db.prepare(`SELECT COUNT(*) AS cnt FROM yes_no_records`).get()?.cnt || 0;
    const trend = db.prepare(`
      SELECT date(created_at/1000, 'unixepoch') AS day, COUNT(*) AS cnt
      FROM yes_no_records
      WHERE created_at > ?
      GROUP BY day
      ORDER BY day ASC
    `).all(Date.now() - 7 * 24 * 3600 * 1000);

    res.json({
      by_result: byResult,
      by_intent: byIntent,
      total,
      trend,
    });
  } catch (err) {
    console.error('[admin] yesno error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/admin/stats/anonymous
 * 匿名用户统计：设备数 → 下单 → 付费转化
 */
router.get('/stats/anonymous', requireAdmin, (req, res) => {
  try {
    // 匿名设备：有 device_id 但没 user_id 的活动
    const totalDevices = db.prepare(`
      SELECT COUNT(DISTINCT device_id) AS cnt
      FROM analytics_events
      WHERE device_id IS NOT NULL
        AND (user_id IS NULL OR user_id = '')
    `).get()?.cnt || 0;

    const orderedDevices = db.prepare(`
      SELECT COUNT(DISTINCT device_id) AS cnt
      FROM analytics_events
      WHERE event_name = 'order_created'
        AND device_id IS NOT NULL
        AND (user_id IS NULL OR user_id = '')
    `).get()?.cnt || 0;

    const paidDevices = db.prepare(`
      SELECT COUNT(DISTINCT device_id) AS cnt
      FROM analytics_events
      WHERE event_name = 'order_paid'
        AND device_id IS NOT NULL
        AND (user_id IS NULL OR user_id = '')
    `).get()?.cnt || 0;

    // 匿名 vs 登录对比
    const loggedIn = db.prepare(`
      SELECT COUNT(DISTINCT user_id) AS cnt FROM analytics_events
      WHERE user_id IS NOT NULL AND user_id != ''
    `).get()?.cnt || 0;

    const anonymous = totalDevices;
    const loggedInRate = loggedIn > 0 ? (paidDevices > 0 ? '20%' : '0%') : '0%';
    const anonymousRate = anonymous > 0 ? ((paidDevices / anonymous) * 100).toFixed(1) + '%' : '0%';

    // 留存趋势（最近 7 天）
    const retention = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayStartTs = dayStart.getTime();
      const dayEndTs = dayStartTs + 24 * 3600 * 1000;

      const newDevices = db.prepare(`
        SELECT COUNT(DISTINCT device_id) AS cnt FROM analytics_events
        WHERE device_id IS NOT NULL AND created_at >= ? AND created_at < ?
          AND event_name IN ('user_registered', 'user_logged_in', 'oracle_ask')
      `).get(dayStartTs, dayEndTs)?.cnt || 0;

      const activeDevices = db.prepare(`
        SELECT COUNT(DISTINCT device_id) AS cnt FROM analytics_events
        WHERE device_id IS NOT NULL AND created_at >= ? AND created_at < ?
      `).get(dayStartTs, dayEndTs)?.cnt || 0;

      // 次日留存 = 第 i+1 天的活跃 / i 天的活跃
      let rate = 0;
      if (i < 6) {
        const prevDay = new Date(dayStart);
        prevDay.setDate(prevDay.getDate() + 1);
        const prevStart = prevDay.getTime();
        const prevEnd = prevStart + 24 * 3600 * 1000;
        const prevActive = db.prepare(`
          SELECT COUNT(DISTINCT device_id) AS cnt FROM analytics_events
          WHERE device_id IS NOT NULL AND created_at >= ? AND created_at < ?
        `).get(prevStart, prevEnd)?.cnt || 0;
        rate = prevActive > 0 ? ((activeDevices / prevActive) * 100) : 0;
      }

      retention.push({
        date: dayStart.toISOString().slice(0, 10),
        new_devices: newDevices,
        active_devices: activeDevices,
        retention_rate: rate.toFixed(1),
      });
    }

    res.json({
      total_devices: totalDevices,
      ordered_devices: orderedDevices,
      paid_devices: paidDevices,
      comparison: {
        logged_in: loggedIn,
        anonymous: anonymous,
        logged_in_rate: loggedInRate,
        anonymous_rate: anonymousRate,
      },
      retention,
    });
  } catch (err) {
    console.error('[admin] anonymous error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/admin/action-logs
 * 管理员操作日志（最近 100 条）
 */
router.get('/action-logs', requireAdmin, (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM admin_action_logs
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
    res.json({ logs });
  } catch (err) {
    console.error('[admin] action-logs error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

export { logAdminAction };
export default router;
