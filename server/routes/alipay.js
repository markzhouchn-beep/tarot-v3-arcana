// ============================================================
// routes/alipay.js · 支付宝手机网站支付（wap）路由
// 创建：2026-09-21 · v3.1 新增
//
//   POST /api/alipay/create   创建支付订单（前端调用，返回 payUrl）
//   POST /api/alipay/notify   异步通知（支付宝 POST 回调，必须返纯文本 success）
//   GET  /api/alipay/return   同步回跳（用户在支付宝完成付款后浏览器回跳）
//   POST /api/alipay/query    主动查询订单状态（前端"我已支付"按钮）
// ============================================================

import { Router } from 'express';
import express from 'express';
import db from '../db.js';
import { config } from '../lib/config.js';
import {
  createWapPay,
  verifySign,
  queryOrder as alipayQuery,
  normalizePrivateKey,
  normalizePublicKey,
} from '../lib/alipay.js';
import { trackEvent } from '../lib/events.js';

// 延迟 import triggerAIReading 避免循环依赖
let _triggerAIReading = null;
async function triggerAIReading(orderId) {
  if (!_triggerAIReading) {
    const mod = await import('./orders.js');
    _triggerAIReading = mod.triggerAIReading;
  }
  return _triggerAIReading(orderId);
}

const router = Router();

// ===== 通知接口必须返纯文本 success/fail，不能返 JSON =====
router.post(
  '/notify',
  express.urlencoded({ extended: true, limit: '1mb' }),
  async (req, res) => {
    const params = req.body || {};
    console.log('[alipay notify] 收到异步通知:', JSON.stringify(params).slice(0, 300));

    const alipayPublicKey = normalizePublicKey(config.ALIPAY_PUBLIC_KEY);
    if (!alipayPublicKey) {
      console.error('[alipay notify] ALIPAY_PUBLIC_KEY 未配置');
      return res.send('fail');
    }

    // 1. 验签
    const ok = verifySign(params, alipayPublicKey);
    if (!ok) {
      console.warn('[alipay notify] 验签失败，可能为伪造请求');
      return res.send('fail');
    }
    console.log('[alipay notify] ✅ 验签通过');

    // 2. 关键字段
    const outTradeNo = params.out_trade_no;
    const tradeStatus = params.trade_status; // TRADE_SUCCESS | TRADE_FINISHED | TRADE_CLOSED
    const tradeNo = params.trade_no;          // 支付宝交易号
    const totalAmount = parseFloat(params.total_amount);

    if (!outTradeNo) {
      console.error('[alipay notify] 缺少 out_trade_no');
      return res.send('fail');
    }

    // 3. 查订单
    const order = db
      .prepare('SELECT id, status, amount FROM orders WHERE afdian_out_trade_no = ? OR id = ?')
      .get(outTradeNo, outTradeNo);
    if (!order) {
      console.error('[alipay notify] 未找到订单:', outTradeNo);
      return res.send('fail');
    }

    // 4. 业务处理
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      // 金额校验（容差 0.01）
      if (Math.abs(order.amount - totalAmount) > 0.01) {
        console.error(
          `[alipay notify] 金额不符：order=${order.amount}, alipay=${totalAmount}`
        );
        return res.send('fail');
      }

      if (order.status !== 'paid' && order.status !== 'interpreted') {
        db.prepare(
          `UPDATE orders
           SET status = 'paid',
               paid_amount = ?,
               paid_at = ?,
               payment_method = 'alipay',
               alipay_trade_no = ?,
               updated_at = ?
           WHERE id = ?`
        ).run(totalAmount, Date.now(), tradeNo || null, Date.now(), order.id);

        trackEvent('order_paid', {
          userId: null,
          deviceId: null,
          properties: { order_id: order.id, amount: totalAmount, source: 'alipay_notify' },
        });

        // 异步触发 AI 解读
        triggerAIReading(order.id).catch((err) =>
          console.error(`[alipay notify] AI 触发失败: ${order.id}`, err)
        );
        console.log(`[alipay notify] ✅ 订单 ${order.id} 已标记 paid`);
      } else {
        console.log(`[alipay notify] 订单 ${order.id} 已是 ${order.status}，跳过`);
      }

      return res.send('success');
    } else if (tradeStatus === 'TRADE_CLOSED') {
      // 用户主动关闭 / 超时
      if (order.status === 'pending') {
        db.prepare(`UPDATE orders SET status='cancelled', updated_at=? WHERE id=?`).run(
          Date.now(),
          order.id
        );
        console.log(`[alipay notify] 订单 ${order.id} 已关闭`);
      }
      return res.send('success');
    }

    // WAIT_BUYER_PAY 等中间状态：不处理，返回 success 让支付宝不再重试
    return res.send('success');
  }
);

// ===== 同步回跳（用户在支付宝里付款完成，浏览器跳回） =====
router.get('/return', async (req, res) => {
  const params = req.query;
  console.log('[alipay return] 收到同步回跳:', JSON.stringify(params).slice(0, 300));

  const alipayPublicKey = normalizePublicKey(config.ALIPAY_PUBLIC_KEY);
  let verified = false;
  if (alipayPublicKey) {
    verified = verifySign({ ...params }, alipayPublicKey);
  }

  const outTradeNo = params.out_trade_no;
  // 同步回跳：不要在这里改订单状态（异步 notify 才是权威）
  if (outTradeNo) {
    const order = db
      .prepare('SELECT id FROM orders WHERE afdian_out_trade_no = ?')
      .get(outTradeNo);
    if (order) {
      const status = verified ? 'paid' : 'unknown';
      return res.redirect(`${config.FRONTEND_PRIMARY}/spread/${order.id}?pay_status=${status}`);
    }
  }

  return res.redirect(`${config.FRONTEND_PRIMARY}/?pay_status=unknown`);
});

// ===== 主动查询订单（前端"我已支付"按钮 / 兜底） =====
router.post('/query', async (req, res) => {
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'MISSING_ORDER_ID' });

    const order = db
      .prepare('SELECT id, status, amount, afdian_out_trade_no FROM orders WHERE id = ?')
      .get(orderId);
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

    if (order.status !== 'pending') {
      return res.json({ ok: true, status: order.status, fromCache: true });
    }

    if (!config.ALIPAY_APP_ID || !config.ALIPAY_PRIVATE_KEY) {
      return res.status(500).json({ error: 'ALIPAY_NOT_CONFIGURED' });
    }

    const privateKey = normalizePrivateKey(config.ALIPAY_PRIVATE_KEY);
    const result = await alipayQuery(order.afdian_out_trade_no, {
      appId: config.ALIPAY_APP_ID,
      privateKey,
      sandbox: String(config.ALIPAY_SANDBOX ?? '0') === '1',
    });

    if (!result.ok) {
      return res.status(500).json({ error: 'QUERY_FAILED', message: result.error });
    }

    if (result.tradeStatus === 'TRADE_SUCCESS' || result.tradeStatus === 'TRADE_FINISHED') {
      db.prepare(
        `UPDATE orders SET status='paid', paid_amount=?, paid_at=?, payment_method='alipay', alipay_trade_no=?, updated_at=? WHERE id=? AND status='pending'`
      ).run(
        parseFloat(result.totalAmount),
        Date.now(),
        result.tradeNo || null,
        Date.now(),
        order.id
      );
      trackEvent('order_paid', {
        userId: null,
        deviceId: null,
        properties: { order_id: order.id, amount: parseFloat(result.totalAmount), source: 'alipay_query' },
      });
      triggerAIReading(order.id).catch((err) =>
        console.error(`[alipay query] AI 触发失败: ${order.id}`, err)
      );
      return res.json({ ok: true, status: 'paid' });
    } else if (result.tradeStatus === 'TRADE_CLOSED') {
      db.prepare(`UPDATE orders SET status='cancelled', updated_at=? WHERE id=? AND status='pending'`).run(
        Date.now(),
        order.id
      );
      return res.json({ ok: true, status: 'cancelled' });
    }

    return res.json({ ok: true, status: 'pending', tradeStatus: result.tradeStatus });
  } catch (err) {
    console.error('[alipay query] error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ===== 创建支付订单（前端调） =====
router.post('/create', async (req, res) => {
  try {
    const { orderId, subject } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'MISSING_ORDER_ID' });

    const order = db
      .prepare(
        'SELECT id, status, amount, payment_method, afdian_out_trade_no FROM orders WHERE id = ?'
      )
      .get(orderId);
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'ORDER_NOT_PENDING', status: order.status });
    }

    if (!config.ALIPAY_APP_ID || !config.ALIPAY_PRIVATE_KEY) {
      return res.status(500).json({
        error: 'ALIPAY_NOT_CONFIGURED',
        message: '请在 .env 配置 ALIPAY_APP_ID 和 ALIPAY_PRIVATE_KEY',
      });
    }

    const privateKey = normalizePrivateKey(config.ALIPAY_PRIVATE_KEY);

    const notifyUrl = `${config.DOMAIN}/api/alipay/notify`;
    const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
    const host = req.headers.host || config.DOMAIN?.replace(/^https?:\/\//, '');
    const returnUrl = `${proto}://${host}/?pay_method=alipay`;

    const payUrl = createWapPay({
      outTradeNo: order.afdian_out_trade_no,
      totalAmount: order.amount,
      subject: subject || '星语塔罗 ARCANA · 解读',
      appId: config.ALIPAY_APP_ID,
      privateKey,
      notifyUrl,
      returnUrl,
      sandbox: String(config.ALIPAY_SANDBOX ?? '0') === '1',
    });

    db.prepare(
      `UPDATE orders SET payment_method='alipay', updated_at=? WHERE id=? AND status='pending'`
    ).run(Date.now(), order.id);

    trackEvent('alipay_create', {
      userId: null,
      deviceId: null,
      properties: { order_id: order.id, amount: order.amount },
    });

    res.json({ ok: true, payUrl });
  } catch (err) {
    console.error('[alipay create] error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

export default router;