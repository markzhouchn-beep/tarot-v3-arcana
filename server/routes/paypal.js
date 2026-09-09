// ============================================================
// routes/paypal.js · PayPal 支付回跳处理
// GET  /paypal/return?token=XXX  - 付款后回跳
// GET  /paypal/cancel            - 用户取消付款
// ============================================================

import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { config } from '../lib/config.js';
import { capturePaypalOrder } from '../lib/paypal.js';

const router = Router();

// PayPal Webhook 签名验证
async function verifyPaypalWebhook(req) {
  const certUrl = req.headers['paypal-cert-url'];
  const transmissionId = req.headers['paypal-transmission-id'];
  const transmissionTime = req.headers['paypal-transmission-time'];
  const transmissionSig = req.headers['paypal-transmission-sig'];
  const authAlgo = req.headers['paypal-auth-algo'] || 'SHA256withRSA';

  if (!certUrl || !transmissionId || !transmissionTime || !transmissionSig) {
    throw new Error('Missing PayPal webhook headers');
  }

  // 只接受 api.paypal.com 的证书，防止 DNS rebinding
  if (!certUrl.startsWith('https://api.paypal.com/') &&
      !certUrl.startsWith('https://api.sandbox.paypal.com/')) {
    throw new Error(`Invalid PayPal cert URL: ${certUrl}`);
  }

  // CRC32 of raw body
  const crc32Table = (() => {
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  })();

  function crc32(buf) {
    let crc = 0xffffffff;
    for (const byte of buf) {
      crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const rawBody = JSON.stringify(req.body);
  const crc = crc32(Buffer.from(rawBody));

  // PayPal 要求格式：transmissionId|transmissionTime|webhookId|crc32(body)
  const payload = `${transmissionId}|${transmissionTime}|${config.PAYPAL_WEBHOOK_ID}|${crc}`;

  // 获取 PayPal 公钥证书
  const certResponse = await fetch(certUrl);
  if (!certResponse.ok) {
    throw new Error(`Failed to fetch PayPal certificate: ${certResponse.status}`);
  }
  const certPem = await certResponse.text();

  const verify = crypto.createVerify(authAlgo.replace('with', '-'));
  verify.update(payload);
  const isValid = verify.verify(certPem, transmissionSig, 'base64');

  if (!isValid) {
    throw new Error('PayPal webhook signature verification failed');
  }
  console.log('[paypal webhook] Signature verified OK');
}

/**
 * GET /paypal/return?token=XXX
 * PayPal 付款完成后跳转回来，用 token 确认收款
 */
router.get('/return', async (req, res) => {
  const { token } = req.query; // PayPal order ID

  if (!token) {
    return res.redirect(`${config.FRONTEND_URL}/?paypal_error=no_token`);
  }

  try {
    // 1. 找到我们系统里关联这个 PayPal order ID 的订单
    const order = db.prepare(`
      SELECT id, paypal_order_id, status, tier, user_id
      FROM orders
      WHERE paypal_order_id = ?
    `).get(token);

    if (!order) {
      console.error('[paypal] 未找到关联订单, paypal_order_id:', token);
      return res.redirect(`${config.FRONTEND_URL}/?paypal_error=order_not_found`);
    }

    if (order.status === 'paid') {
      // 重复回调，直接跳结果页
      return res.redirect(`${config.FRONTEND_URL}/spread/${order.id}?from=paypal`);
    }

    // 2. 调用 PayPal capture 接口确认收款
    const captureResult = await capturePaypalOrder(token);

    // 3. 更新订单状态
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      UPDATE orders
      SET status = 'paid',
          paid_at = ?,
          paid_amount = (SELECT amount FROM orders WHERE id = ?),
          paypal_capture_id = ?
      WHERE id = ?
    `).run(now, order.id, captureResult.captureId, order.id);

    // 4. 生成解读（和 afdian webhook 同样的逻辑）
    await fulfillOrder(order.id);

    console.log(`[paypal] 收款成功: order=${order.id}, capture=${captureResult.captureId}`);

    // 5. 跳转回结果页
    res.redirect(`${config.FRONTEND_URL}/spread/${order.id}?from=paypal`);

  } catch (err) {
    console.error('[paypal] return 处理失败:', err.message);
    res.redirect(`${config.FRONTEND_URL}/?paypal_error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * GET /paypal/cancel
 * 用户在 PayPal 页面点取消
 */
router.get('/cancel', (req, res) => {
  res.redirect(`${config.FRONTEND_URL}/?paypal_cancelled=1`);
});

/**
 * POST /api/paypal/webhook
 * PayPal webhook（备选回调，不依赖浏览器回跳）
 */
router.post('/webhook', async (req, res) => {
  // 注意：PayPal webhook 签名验证需要原始 raw body（express.json() 已解析，需 server.js 配合）
  // 当前以浏览器回跳为主路径，webhook 作为兜底；签名验证在 config.PAYPAL_WEBHOOK_ID 配好后启用
  const { event_type, resource } = req.body || {};
  console.log(`[paypal webhook] ${event_type}`);

  if (event_type === 'CHECKOUT.ORDER.APPROVED') {
    // 用户 Approval 了订单但还没 capture，等 COMPLETED 事件
  }

  if (event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const refId = resource?.supplementary_data?.related_ids?.order_id;
    if (refId) {
      const order = db.prepare(`SELECT id FROM orders WHERE paypal_order_id = ? AND status != 'paid'`).get(refId);
      if (order) {
        const now = Math.floor(Date.now() / 1000);
        db.prepare(`UPDATE orders SET status='paid', paid_at=?, paypal_capture_id=? WHERE id=?`)
          .run(now, resource.id, order.id);
        await fulfillOrder(order.id);
        console.log(`[paypal webhook] 收款成功: order=${order.id}`);
      }
    }
  }

  res.json({ received: true });
});

// ============================================================
// fulfillOrder — 生成解读（复用 afdian webhook 逻辑）
// ============================================================
async function fulfillOrder(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return;

  // 调用者已处理 paid 状态写入，这里只负责生成 AI 解读
  // （afdian webhook 调用时 order.status 仍是 pending，PayPal return 时已在外面标了 paid）
  const { callAI } = await import('../lib/ai.js');
  const { buildReadingPrompt } = await import('../lib/prompts.js');

  let cards = [];
  try { cards = JSON.parse(order.cards_json || '[]'); } catch {}

  const userMsg = buildReadingPrompt({
    spreadType: order.spread_type,
    theme: order.spread_theme,
    question: order.question,
    cards,
  });

  try {
    const interpretation = await callAI(userMsg);
    const interpretedAt = Math.floor(Date.now() / 1000);
    db.prepare('UPDATE orders SET interpretation=?, interpreted_at=? WHERE id=?')
      .run(interpretation, interpretedAt, orderId);
    console.log(`[paypal] 解读生成成功: order=${orderId}`);
  } catch (err) {
    console.error(`[paypal] 解读生成失败: order=${orderId}:`, err.message);
  }
}

export default router;
