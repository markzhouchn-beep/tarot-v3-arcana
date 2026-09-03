// ============================================================
// routes/oracle.js · Oracle 追问路由
// 创建：2026-09-02 02:00 · Phase 3 完整实现
// 9/2 v3.0 Phase 3 修复：加鉴权中间件 + 归属校验
// ============================================================

import express from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { callAI, classifyIntent } from '../lib/ai.js';
import { SYSTEM_PROMPT, buildContextPrompt, decideDepthLayer } from '../lib/prompts.js';
import { optionalAuth } from '../middleware/auth.js';

/**
 * 统一错误响应 helper
 * 格式约定：{ ok: false, error: 'CODE', message: 'USER_FRIENDLY_TEXT' }
 * CODE 列表见 ERROR_CODES，未来 v2.1 推广到全路由
 */
const ERROR_CODES = {
  LOGIN_REQUIRED: '请先登录',
  FORBIDDEN: '无权访问',
  NOT_FOUND: '资源不存在',
  BAD_REQUEST: '请求参数错误',
  QUOTA_EXHAUSTED: '追问配额已用完',
  SESSION_CLOSED: 'session 已关闭',
  CONTENT_TOO_LONG: '问题过长',
  INTERNAL: '服务器内部错误',
};

function respondError(res, status, code, extra = {}) {
  return res.status(status).json({
    ok: false,
    error: ERROR_CODES[code] || code,
    code,
    ...extra,
  });
}

const router = express.Router();

// ============================================================
// 工具函数
// ============================================================

/**
 * 安全关键词检查（与 reading 路由一致）
 */
const SAFETY_KEYWORDS = ['股票', '基金', '医疗', '诊断', '用药', '政治', '选举', '代码', '编程', 'bug', '自杀', '跳楼'];

function checkSafety(content) {
  const flagged = [];
  for (const kw of SAFETY_KEYWORDS) {
    if (content.includes(kw)) flagged.push(kw);
  }
  return flagged;
}

function getUserId(req) {
  return req.user?.id || req.session?.user_id || null;
}

function uuid() {
  return crypto.randomUUID();
}

// ============================================================
// GET /api/oracle/preset-questions
// 返回当前牌阵适用的预设问题（按类别 + display_order 排序）
// ============================================================
router.get('/preset-questions', optionalAuth, (req, res) => {
  try {
    const spreadType = req.query.spread_type || null;
    const tier = req.query.tier || 'guest';

    const tierOrder = ['guest', 'registered', 'silver', 'gold'];
    let tierIdx = tierOrder.indexOf(tier);

    // 未知 tier 兜底为 0 (guest)，避免 IN () 语法错误
    if (tierIdx < 0) {
      console.warn(`[oracle] preset-questions: unknown tier="${tier}", fallback to guest`);
      tierIdx = 0;
    }

    // 等级过滤：只显示 <= 当前等级的问题
    let sql = `
      SELECT id, category, text, description, tier_required, display_order
      FROM preset_questions
      WHERE is_active = 1
        AND tier_required IN (${tierOrder.slice(0, tierIdx + 1).map(() => '?').join(',')})
    `;
    const params = tierOrder.slice(0, tierIdx + 1);

    let rows = db.prepare(sql).all(...params);

    // 牌阵类型过滤
    if (spreadType) {
      rows = rows.filter((r) => {
        if (!r.applicable_spreads) return true;
        try {
          const applicable = JSON.parse(r.applicable_spreads);
          return !applicable || applicable.includes(spreadType) || applicable.length === 0;
        } catch {
          return true;
        }
      });
    }

    // 按 category 分组
    const grouped = {};
    rows.forEach((r) => {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push({
        id: r.id,
        text: r.text,
        description: r.description,
      });
    });

    res.json({ ok: true, questions: grouped });
  } catch (err) {
    console.error('[oracle] preset-questions error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/oracle/session
// 创建或获取当前牌阵的 Oracle 会话
// Body: { reading_id }
// ============================================================
/**
 * GET /api/oracle/sessions
 * 列出当前用户的所有 Oracle 会话（含未读/最后消息预览）
 * Bug fix 2026-09-03：前端 oracleApi.sessions() 调用此端点但之前不存在
 */
router.get('/sessions', optionalAuth, (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.json({ ok: true, sessions: [] });
    }

    const rows = db.prepare(`
      SELECT
        s.id, s.reading_id, s.spread_type, s.status,
        s.message_count, s.created_at, s.last_message_at,
        r.question,
        (SELECT m.content FROM oracle_messages m
         WHERE m.session_id = s.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
      FROM oracle_sessions s
      LEFT JOIN readings r ON r.id = s.reading_id
      WHERE s.user_id = ?
      ORDER BY COALESCE(s.last_message_at, s.created_at) DESC
      LIMIT 50
    `).all(userId);

    res.json({ ok: true, sessions: rows });
  } catch (err) {
    console.error('[oracle] sessions list error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/session', optionalAuth, (req, res) => {
  try {
    const userId = getUserId(req);
    let { reading_id, order_id } = req.body || {};

    // 兼容 order_id：自动查 reading
    if (!reading_id && order_id) {
      const r = db.prepare('SELECT id FROM readings WHERE order_id = ? ORDER BY created_at DESC LIMIT 1').get(order_id);
      if (r) reading_id = r.id;
    }

    if (!reading_id) {
      return respondError(res, 400, 'BAD_REQUEST');
    }

    // 读取牌阵信息
    const reading = db.prepare(`
      SELECT id, user_id, spread_type, question, summary
      FROM readings WHERE id = ?
    `).get(reading_id);

    if (!reading) {
      return respondError(res, 404, 'NOT_FOUND');
    }

    // 归属校验：reading 归属用户，未归属则要求当前 userId 匹配
    if (reading.user_id && reading.user_id !== userId) {
      return respondError(res, 403, 'FORBIDDEN');
    }

    // 检查现有 session
    let session = db.prepare(`
      SELECT id, message_count, status
      FROM oracle_sessions
      WHERE reading_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).get(reading_id);

    if (!session) {
      // 创建新 session
      const sessionId = uuid();
      const now = Date.now();
      db.prepare(`
        INSERT INTO oracle_sessions (id, user_id, reading_id, spread_type, status, message_count, created_at, last_message_at)
        VALUES (?, ?, ?, ?, 'active', 0, ?, ?)
      `).run(sessionId, userId, reading_id, reading.spread_type, now, now);
      session = { id: sessionId, message_count: 0, status: 'active' };

      // 初始化配额（首次追问）
      initQuotaForReading(reading_id, userId);
    }

    res.json({ ok: true, sessionId: session.id, messageCount: session.message_count });
  } catch (err) {
    console.error('[oracle] session error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// GET /api/oracle/session/:id/messages
// 拉取会话的所有消息
// ============================================================
router.get('/session/:id/messages', optionalAuth, (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // 归属校验：session 必须属于当前 user
    const session = db.prepare(`
      SELECT id, user_id FROM oracle_sessions WHERE id = ?
    `).get(id);

    if (!session) {
      return respondError(res, 404, 'NOT_FOUND');
    }
    if (session.user_id && session.user_id !== userId) {
      return respondError(res, 403, 'FORBIDDEN');
    }

    const messages = db.prepare(`
      SELECT id, role, content, depth_layer, preset_question_id, created_at, is_resolved
      FROM oracle_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(id);

    res.json({ ok: true, messages });
  } catch (err) {
    console.error('[oracle] messages error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/oracle/ask
// 发起追问（核心 API）
// Body: { session_id, content, preset_question_id? }
// ============================================================
router.post('/ask', optionalAuth, async (req, res) => {
  const start = Date.now();
  try {
    const userId = getUserId(req);
    const { session_id, content, preset_question_id } = req.body || {};

    if (!session_id || !content) {
      return respondError(res, 400, 'BAD_REQUEST');
    }
    if (content.length > 500) {
      return respondError(res, 400, 'CONTENT_TOO_LONG');
    }

    // 1. 安全检查
    const flagged = checkSafety(content);
    if (flagged.length > 0) {
      // 写审计日志
      const auditId = uuid();
      db.prepare(`
        INSERT INTO oracle_audit_log (id, user_id, session_id, content, flagged_keywords, action)
        VALUES (?, ?, ?, ?, ?, 'warn')
      `).run(auditId, userId, session_id, content, JSON.stringify(flagged));
      console.log(`[oracle] ⚠️ 安全拦截: user=${userId}, keywords=${flagged.join(',')}`);

      // 自杀相关：直接给热线
      if (flagged.includes('自杀') || flagged.includes('跳楼')) {
        return res.json({
          ok: true,
          content: '我感受到你现在的痛苦。请拨打自杀热线 400-161-9995 寻求帮助。你的生命很重要。',
          urgent_referral: true,
        });
      }

      return res.json({
        ok: true,
        content: `抱歉，这个问题超出了我能给予建议的范围（涉及 ${flagled.join('、')}）。如果你想探索感情、工作或自我成长相关的话题，我可以帮你。`,
        flagged: true,
      });
    }

    // 2. 加载 session + 牌阵
    const session = db.prepare(`SELECT * FROM oracle_sessions WHERE id = ?`).get(session_id);
    if (!session) {
      return respondError(res, 404, 'NOT_FOUND');
    }
    if (session.status !== 'active') {
      return respondError(res, 400, 'SESSION_CLOSED');
    }

    // 归属校验：session.user_id 必须匹配
    if (session.user_id && session.user_id !== userId) {
      return respondError(res, 403, 'FORBIDDEN');
    }

    // 3. 配额检查（双轨：单次付费配额 + 会员无限）
    const quotaCheck = checkAndDeductQuota(session.reading_id, userId);
    if (!quotaCheck.ok) {
      return respondError(res, 402, 'QUOTA_EXHAUSTED', {
        remaining: 0,
        requires: quotaCheck.requires,
      });
    }

    // 4. 加载历史消息
    const history = db.prepare(`
      SELECT role, content, depth_layer FROM oracle_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT 20
    `).all(session_id);

    // 5. 加载牌阵上下文（从 readings + sections）
    let spread = null;
    if (session.reading_id) {
      const reading = db.prepare(`
        SELECT id, spread_type, question, summary, sections_json, cards_json
        FROM readings WHERE id = ?
      `).get(session.reading_id);
      if (reading) {
        spread = {
          spread_type: reading.spread_type,
          question: reading.question,
          summary: reading.summary,
          sections: reading.sections_json ? JSON.parse(reading.sections_json) : [],
          cards: reading.cards_json ? JSON.parse(reading.cards_json) : [],
        };
      }
    }

    // 6. 决定深度层
    const depthLayer = decideDepthLayer(session.message_count);

    // 7. 取预设问题 category
    let presetCategory = null;
    if (preset_question_id) {
      const pq = db.prepare(`SELECT category FROM preset_questions WHERE id = ?`).get(preset_question_id);
      presetCategory = pq?.category;
    }

    // 8. 构建三层 prompt
    const currentMessage = { content, depth_layer: depthLayer, preset_category: presetCategory };
    const userPrompt = buildContextPrompt({ spread, history, currentMessage });

    // 9. 调 AI
    const aiResult = await callAI({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: depthLayer === 3 ? 1200 : 800,
    });

    // 10. 写消息
    const userMsgId = uuid();
    const aiMsgId = uuid();
    const now = Date.now();

    db.prepare(`
      INSERT INTO oracle_messages (id, session_id, role, content, depth_layer, preset_question_id, tokens_used, created_at)
      VALUES (?, ?, 'user', ?, ?, ?, 0, ?)
    `).run(userMsgId, session_id, content, depthLayer, preset_question_id, now);

    db.prepare(`
      INSERT INTO oracle_messages (id, session_id, role, content, depth_layer, tokens_used, cost_cny, created_at)
      VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?)
    `).run(aiMsgId, session_id, aiResult.content, depthLayer, aiResult.tokensUsed, aiResult.cost || 0, now);

    // 11. 更新 session
    db.prepare(`
      UPDATE oracle_sessions
      SET message_count = message_count + 2, last_message_at = ?
      WHERE id = ?
    `).run(now, session_id);

    // 12. 更新预设问题 usage_count
    if (preset_question_id) {
      db.prepare(`UPDATE preset_questions SET usage_count = usage_count + 1 WHERE id = ?`).run(preset_question_id);
    }

    const duration = Date.now() - start;
    console.log(`[oracle] ✅ session=${session_id} layer=${depthLayer} tokens=${aiResult.tokensUsed} ${duration}ms`);

    res.json({
      ok: true,
      userMessageId: userMsgId,
      aiMessageId: aiMsgId,
      content: aiResult.content,
      depthLayer,
      tokensUsed: aiResult.tokensUsed,
      remaining: quotaCheck.remaining,
    });
  } catch (err) {
    console.error('[oracle] ask error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// POST /api/oracle/message/:id/resolve
// 用户标记一个消息为"已解决"
// ============================================================
router.post('/message/:id/resolve', optionalAuth, (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    // 归属校验：消息必须属于当前 user 的 session
    const msg = db.prepare(`
      SELECT m.id, s.user_id AS session_user_id
      FROM oracle_messages m
      JOIN oracle_sessions s ON s.id = m.session_id
      WHERE m.id = ?
    `).get(id);

    if (!msg) {
      return respondError(res, 404, 'NOT_FOUND');
    }
    if (msg.session_user_id && msg.session_user_id !== userId) {
      return respondError(res, 403, 'FORBIDDEN');
    }

    db.prepare(`UPDATE oracle_messages SET is_resolved = 1 WHERE id = ?`).run(id);
    res.json({ ok: true });
  } catch (err) {
    respondError(res, 500, 'INTERNAL');
  }
});

// ============================================================
// 配额管理（双轨）
// ============================================================

/**
 * 初始化 reading 的配额
 *  - 单次付费：3 次追问（90 天有效）
 *  - 会员：无限
 *  - 邀请奖励：+1
 */
function initQuotaForReading(reading_id, userId) {
  const existing = db.prepare(`SELECT 1 FROM reading_question_quota WHERE reading_id = ?`).get(reading_id);
  if (existing) return;

  const now = Date.now();
  const expires = now + 90 * 24 * 3600 * 1000;

  // 检查用户是否会员
  let total = 3;
  let source = 'single_payment';
  if (userId) {
    const user = db.prepare(`SELECT tier FROM users WHERE id = ?`).get(userId);
    if (user && (user.tier === 'silver' || user.tier === 'gold')) {
      total = 999; // 视为无限
      source = 'member_bonus';
    }
  }

  db.prepare(`
    INSERT INTO reading_question_quota (reading_id, user_id, total_quota, used, source, expires_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(reading_id, userId, total, source, expires);
}

/**
 * 检查并扣减配额
 * 会员无限（999），单次 3 次
 */
function checkAndDeductQuota(reading_id, userId) {
  const quota = db.prepare(`
    SELECT total_quota, used, expires_at FROM reading_question_quota WHERE reading_id = ?
  `).get(reading_id);

  if (!quota) {
    return { ok: false, requires: 'init_quota' };
  }

  // 过期检查
  if (quota.expires_at && quota.expires_at < Date.now()) {
    return { ok: false, requires: 'quota_expired' };
  }

  const remaining = quota.total_quota - quota.used;
  if (remaining <= 0) {
    return { ok: false, requires: 'upgrade_member', remaining: 0 };
  }

  // 扣减
  db.prepare(`UPDATE reading_question_quota SET used = used + 1 WHERE reading_id = ?`).run(reading_id);

  return { ok: true, remaining: remaining - 1 };
}

export default router;