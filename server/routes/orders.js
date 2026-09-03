// ============================================================
// routes/orders.js · 单次订单（创建 + 状态查询 + reconcile）
// 创建：2026-09-01
// ============================================================

import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { config } from '../lib/config.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { buildProductPayUrl, queryOrder } from '../lib/afdian.js';
import { drawCards } from '../lib/tarot-knowledge.js';
import { callAI } from '../lib/ai.js';
import { buildReadingPrompt, READING_SYSTEM_PROMPT } from '../lib/prompts.js';
import { grantFirstPaidRewards, checkAndGrantMilestoneRewards, grantFirstPaidRewardForOrder } from '../lib/invite.js';

const router = Router();

/**
 * POST /api/orders/create
 * 创建单次订单（首单免费 / 付费）
 */
router.post('/create', optionalAuth, (req, res) => {
  try {
    const { spread_type, spread_theme, question, tier = 'classic', device_id } = req.body || {};

    // 价格映射（统一 key：'single' / 'three' / 'ten'，front 贺 v2.0 lite/classic/deep 都接受）
    const PRICE_MAP = {
      // v3.0 前端 tier 值
      single: { amount: config.PRICE_SINGLE, sku: config.AFDIAN_SKU_SINGLE, afdian_type: 'sku' },
      three: { amount: config.PRICE_THREE, sku: config.AFDIAN_SKU_THREE, afdian_type: 'sku' },
      ten: { amount: config.PRICE_TEN, sku: config.AFDIAN_SKU_TEN, afdian_type: 'sku' },
      // v2.0 兼容
      lite: { amount: config.PRICE_SINGLE, sku: config.AFDIAN_SKU_SINGLE, afdian_type: 'sku' },
      classic: { amount: config.PRICE_THREE, sku: config.AFDIAN_SKU_THREE, afdian_type: 'sku' },
      deep: { amount: config.PRICE_TEN, sku: config.AFDIAN_SKU_TEN, afdian_type: 'sku' },
    };
    const tierInfo = PRICE_MAP[tier] || PRICE_MAP.classic;
    const amount = tierInfo.amount;
    const skuId = tierInfo.sku || tierInfo.afdian_type === 'sku' ? tierInfo.sku : null;

    // 牌张数推算
    // 原则：优先用 spread_type 对应的牌阵定义里的 cards 字段；
    // 如果是 single/three/ten/lite/classic/dep 这种「价格 tier」且没指定 spread，才用 tier 推断。
    // Bug fix 2026-09-03：原 SPREAD_TYPE_MAP[tier] || spread_type 会让 5 牌 spread 被覆成 10 牌
    const TIER_TO_CARDS = { lite: 1, single: 1, classic: 3, three: 3, deep: 10, ten: 10 };
    const SPREAD_DEFINITIONS = {
      'love-single': 1, 'love-3': 3, 'love-cross-5': 5, 'love-crush-5': 5, 'love-chakra-7': 7,
      'career-single': 1, 'career-3': 3, 'career-cross-5': 5,
      'money-single': 1, 'money-3': 3,
      'self-single': 1, 'self-3': 3,
      'celtic-10': 10,
    };
    let cardsCount;
    if (spread_type && SPREAD_DEFINITIONS[spread_type]) {
      cardsCount = SPREAD_DEFINITIONS[spread_type];
    } else if (TIER_TO_CARDS[tier]) {
      cardsCount = TIER_TO_CARDS[tier];
    } else {
      cardsCount = 1;
    }
    const inferredSpreadType = SPREAD_DEFINITIONS[spread_type] ? spread_type : (TIER_TO_CARDS[tier] ? (cardsCount === 1 ? 'single' : cardsCount === 3 ? 'three' : 'ten') : 'single');

    const orderId = crypto.randomUUID();
    const outTradeNo = `arc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const isTest = device_id?.startsWith('test-') ? 1 : 0;

    // 占位：抽牌（实际生成在 payment 后）
    const cards = drawCards(cardsCount);

    // 🔥 会员检查：silver/gold 会员跳过支付，直接标记为 paid
    let isMember = false;
    let memberTier = null;
    if (req.user?.id) {
      const user = db.prepare(`SELECT tier FROM users WHERE id = ?`).get(req.user.id);
      if (user && (user.tier === 'silver' || user.tier === 'gold')) {
        isMember = true;
        memberTier = user.tier;
      }
    }

    const now = Date.now();
    const initialStatus = isMember ? 'paid' : 'pending';
    const initialPaidAmount = isMember ? 0 : 0;
    const paidAt = isMember ? now : null;

    db.prepare(`
      INSERT INTO orders (
        id, user_id, tier, spread_type, spread_theme, question, cards_json,
        amount, status, paid_amount, afdian_out_trade_no, afdian_sku_id, is_test, device_id, created_at, updated_at, paid_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      req.user?.id || null,
      tier,
      inferredSpreadType,
      spread_theme || null,
      question || '',
      JSON.stringify(cards),
      amount,
      initialStatus,
      initialPaidAmount,
      outTradeNo,
      skuId,
      isTest,
      device_id || null,
      now,
      now,
      paidAt,
    );

    // 会员：异步触发 AI 解读（不阻塞响应）
    if (isMember) {
      console.log(`[orders] ✅ 会员 (${memberTier}) 直接下单: ${orderId}, 跳过支付`);
      // 后台异步触发解读
      triggerAIReading(orderId).catch((err) => {
        console.error(`[orders] 后台 AI 触发失败: ${orderId}`, err);
      });
    }

    const payUrl = isMember ? null : (skuId ? buildProductPayUrl(skuId, orderId) : null);

    res.json({
      ok: true,
      orderId,
      outTradeNo,
      amount,
      afdianPayUrl: payUrl,
      isTest,
      isMember,
      memberTier,
    });
  } catch (err) {
    console.error('[orders] create error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/orders/:id
 * 查询订单状态
 */
router.get('/:id', (req, res) => {
  try {
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    }

    // v3.0.1：JOIN readings 表拿解读
    const reading = db.prepare(`
      SELECT id, interpretation, created_at
      FROM readings
      WHERE order_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(req.params.id);

    res.json({
      id: order.id,
      status: order.status,
      amount: order.amount,
      paid_at: order.paid_at,
      interpreted_at: order.interpreted_at,
      question: order.question,
      cards: order.cards_json ? JSON.parse(order.cards_json) : [],
      spread_type: order.spread_type,
      // v3.0.1 补充：爱发电 out_trade_no（供 reconcile 查单用）
      out_trade_no: order.afdian_out_trade_no,
      // v3.0.1 补充：爱发电付额 URL（前端跳支付页用）
      afdian_pay_url: buildProductPayUrl(order.afdian_sku_id, order.id),
      // v3.0.1 补充 reading
      reading: reading ? parseReading(reading.interpretation) : null,
      // v3.0.3 追问用：reading_id（OracleChat 需要）
      reading_id: reading?.id,
    });
  } catch (err) {
    console.error('[orders] get error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * v3.0.1 补充：订单列表（Dashboard）
 * GET /api/orders?limit=20
 * 鉴权：必须登录。强制用 req.user.id，拉自己订单（不允许跨用户查）。
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const sql = `SELECT id, question, status, amount, spread_type, cards_json, paid_amount, created_at, paid_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`;
    const params = [userId, limit];

    const rows = db.prepare(sql).all(...params);

    const orders = rows.map(r => ({
      id: r.id,
      question: r.question,
      status: r.status,
      amount: r.amount,
      spread_type: r.spread_type,
      cards_count: r.cards_json ? JSON.parse(r.cards_json).length : 0,
      created_at: r.created_at,
    }));

    res.json({ orders });
  } catch (err) {
    console.error('[orders] list error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * v3.0.1：解析 AI 解读文本（3 段结构）→ JSON
 * 预期格式：
 *   I. 当前处境
 *   [body]
 *
 *   II. 关键挑战
 *   [body]
 *
 *   III. 行动建议
 *   [body]
 */
function parseReading(text) {
  if (!text) return null;
  const sections = [];
  const lines = text.split('\n');
  const EMOJI_MAP = { 'I.': '🌙', 'II.': '⚡', 'III.': '✦' };

  let current = null;
  for (const line of lines) {
    // 格式 1：罗马数字 I. / II. / III.
    let m = line.match(/^(I{1,3})\.\s*(.+)$/);
    // 格式 2：中文数字 一、 二、 三、
    if (!m) m = line.match(/^([一二三四五六七八九十])、\s*(.+)$/);
    // 格式 3：Markdown ## 标题
    if (!m) m = line.match(/^#{1,3}\s*(.+?)$/);

    if (m) {
      if (current) sections.push(current);
      // 格式 3 没有 m[1]（只有 m[0] 全 + m[1] = 标题内容）
      const isRoman = m.length > 2 && /^(I{1,3})$/.test(m[1]);
      const title = (m.length > 2 ? m[2] : m[1]) || '';
      current = {
        emoji: isRoman ? (EMOJI_MAP[m[1] + '.'] || '✦') : '✦',
        title: title.trim(),
        body: '',
      };
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line;
    }
  }
  if (current) sections.push(current);

  // 过滤掉 body 为空的 sub-section（如“## 各位置解读”下面紧接 ### 子标题）
  const filtered = sections.filter((s) => s.body.trim().length > 0);
  // 如果过滤后为空但原 sections 非空（全是空 body），保留原样
  const finalSections = filtered.length > 0 ? filtered : sections;

  // v3.0.1 fallback：未识别任何标题 → 整段塞一段「解读内容」
  if (finalSections.length === 0 && text.trim()) {
    finalSections.push({
      emoji: '✦',
      title: '解读内容',
      body: text.trim(),
    });
  }

  return { sections: finalSections, summary: extractSummary(finalSections) };
}

/**
 * 从 sections 提取摘要（最后一段 body 前 100 字）
 */
function extractSummary(sections) {
  if (!sections || sections.length === 0) return '';
  const last = sections[sections.length - 1];
  const body = (last.body || '').trim();
  // 取首句（中文句号/问号/感叹号 + 英文标点）
  const m = body.match(/^[^。！？!?\n]{1,80}[。！？!?]/);
  if (m) return m[0];
  // fallback：首 80 字
  return body.slice(0, 80) + (body.length > 80 ? '…' : '');
}

/**
 * POST /api/orders/:id/reconcile
 * 客户端主动触发 reconcile（不跳过校验！）
 */
router.post('/:id/reconcile', async (req, res) => {
  try {
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    }
    if (order.status === 'paid' || order.status === 'interpreted') {
      // 已付款，但可能 AI 失败（ai_error 有值）
      return res.json({ ok: true, status: order.status, already: true, ai_error: order.ai_error || null });
    }
    if (!order.afdian_out_trade_no) {
      return res.status(400).json({
        ok: false,
        status: 'no_out_trade_no',
        message: '订单无爱发电 out_trade_no',
      });
    }

    // v3.0.1：真调爱发电 query-order 查单
    // ⚠️ 实测：爱发电 out_trade_no 参数查询不稳，需拉 page=1 手动过滤
    console.log(`[reconcile] 查单: out_trade_no=${order.afdian_out_trade_no}`);
    const result = await queryOrder({ page: 1, perPage: 100 });
    const list = result.list || [];

    // 优先按 out_trade_no 精确匹配，其次 custom_order_id
    const afdianOrder = list.find(
      (o) => o.out_trade_no === order.afdian_out_trade_no ||
             o.custom_order_id === order.id
    );

    if (!afdianOrder) {
      return res.json({
        ok: false,
        status: 'still_pending',
        message: `爱发电未查询到该订单（查了 ${list.length} 条，均不匹配）`,
      });
    }

    // 命中 → 检查 status=2 已支付
    const afdianStatus = afdianOrder.status;
    if (afdianStatus !== 2) {
      return res.json({
        ok: false,
        status: 'still_pending',
        message: `爱发电订单状态 = ${afdianStatus}（2=已付）`,
      });
    }

    // 防篡改：金额差异超过 0.01 报警（但仍处理：可能是优惠券）
    const paidAmount = parseFloat(afdianOrder.total_amount);
    if (Math.abs(paidAmount - order.amount) > 0.01) {
      console.warn(`[reconcile] ⚠️ 金额不匹配: order=${order.amount}, afdian=${paidAmount}`);
    }

    // 命中且已付 → 标 paid + 异步触发 AI 解读
    db.prepare(`UPDATE orders SET status = 'paid', paid_at = ?, paid_amount = ? WHERE id = ?`).run(
      Date.now(), paidAmount, order.id
    );
    triggerAIReading(order.id).catch((err) => console.error('[reconcile] trigger error:', err));

    console.log(`[reconcile] ✅ 命中: order=${order.id}, amount=${paidAmount}`);
    return res.json({
      ok: true,
      status: 'paid',
      paid_amount: paidAmount,
      afdian_order: afdianOrder,
    });
  } catch (err) {
    console.error('[orders] reconcile error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * 内部：触发 AI 解读（webhook / reconcile 命中后调用）
 * Phase 0 占位，Phase 1 充实
 */
export async function triggerAIReading(orderId) {
  try {
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
    if (!order || order.status !== 'paid') return { ok: false, reason: 'order_not_paid' };

    const cards = JSON.parse(order.cards_json || '[]');

    let content, tokensUsed, cost;
    try {
      const aiResult = await callAI({
        systemPrompt: READING_SYSTEM_PROMPT,
        userPrompt: buildReadingPrompt({
          spreadType: order.spread_type || 'single',
          theme: order.spread_theme,
          cards,
          question: order.question,
        }),
      });
      content = aiResult.content;
      tokensUsed = aiResult.tokensUsed || 0;
      cost = aiResult.cost || 0;
      if (!content || content.trim().length === 0) {
        throw new Error('AI 返回空内容');
      }
    } catch (aiErr) {
      // Phase 2.11: AI 失败 不标 interpreted，前端可点「重试」
      console.error(`[triggerAIReading] ❌ order=${orderId} AI 失败:`, aiErr.message);
      db.prepare(`UPDATE orders SET ai_error = ?, updated_at = ? WHERE id = ?`).run(
        aiErr.message?.slice(0, 500) || 'AI 失败',
        Date.now(),
        orderId,
      );
      return { ok: false, reason: 'ai_failed', error: aiErr.message };
    }

    // 解析 sections + summary（供 Oracle 追问复用）
    const parsed = parseReading(content);
    const sections = parsed?.sections || [];
    const summary = parsed?.summary || '';

    const readingId = crypto.randomUUID();
    const accessToken = crypto.randomBytes(32).toString('hex');

    db.prepare(`
      INSERT INTO readings (id, order_id, user_id, access_token, question, cards_json, spread_type, interpretation, interpretation_length, sections_json, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      readingId,
      orderId,
      order.user_id,
      accessToken,
      order.question,
      order.cards_json,
      order.spread_type,
      content,
      content.length,
      JSON.stringify(sections),
      summary,
      Date.now(),
    );

    // 单次付费报告附 5 次追问配额
    if (order.amount > 0) {
      db.prepare(`
        INSERT INTO reading_question_quota (reading_id, user_id, total_quota, used, source, expires_at)
        VALUES (?, ?, 5, 0, 'single_payment', ?)
      `).run(readingId, order.user_id, Date.now() + 90 * 24 * 3600 * 1000);
    }

    db.prepare(`UPDATE orders SET status = 'interpreted', interpreted_at = ? WHERE id = ?`).run(Date.now(), orderId);

    // Phase 4: 首次付费 → 触发邀请人奖励（webhook 是主路径；这里是 AI 解读时的备份路径）
    if (order.user_id && order.amount > 0) {
      grantFirstPaidRewardForOrder(order.user_id);
    }

    console.log(`[orders] ✅ AI reading generated for ${orderId}, tokens=${tokensUsed}`);
    return { ok: true, readingId, tokensUsed };
  } catch (err) {
    console.error('[orders] triggerAIReading error:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * POST /api/orders/:id/interpret
 * v3.0.1：前端手动调用触发 AI 解读
 */
router.post('/:id/interpret', async (req, res) => {
  try {
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    }
    if (order.status !== 'paid' && order.status !== 'interpreted') {
      return res.status(400).json({ error: 'ORDER_NOT_PAID', message: '订单未支付' });
    }
    // 已解读过则直接返
    if (order.status === 'interpreted' || order.interpreted_at) {
      return res.json({ ok: true, already: true });
    }

    // 异步触发（不阻麳响应）
    triggerAIReading(req.params.id).catch(err => {
      console.error('[orders] interpret async error:', err);
    });

    res.json({ ok: true, status: 'queued' });
  } catch (err) {
    console.error('[orders] interpret error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/orders/:id/trust-paid
 * ❌ v3.0 已删除（PD v0.8：四层防御是 webhook + 轮询 + 定时 reconcile + 手动 reconcile）
 * ❌ 不允许前端直接标 paid
 * ❌ 不允许信任兑底
 */
router.post('/:id/trust-paid', (req, res) => {
  return res.status(404).json({
    error: 'NOT_FOUND',
    message: 'trust-paid 已废弃。请使用 /api/orders/:id/reconcile（会调爱发电 query-order 核实）',
  });
});

export default router;
