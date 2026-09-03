// ============================================================
// routes/afdian-webhook.js · 爱发电 webhook（幂等）
// v3.0 · 上线修复：
// - 删除 WEBHOOK_SECRET/remark 简易验签（P0-2，与业务 remark=user_id 互斥）
// - 订阅 userId = custom_order_id || remark（P0-1 配套）
// - plan 识别走 inferSubscriptionTier UUID 映射
// ============================================================

import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { verifyWebhook, verifyWebhookRSA, inferSubscriptionTier } from '../lib/afdian.js';
import { activateSubscription } from './membership.js';
import { triggerAIReading } from './orders.js';
import { grantFirstPaidRewardForOrder } from '../lib/invite.js';

const router = Router();

/**
  * POST /api/afdian/webhook
  */
router.post('/webhook', async (req, res) => {
  const startTime = Date.now();

  try {
  const payload = req.body;

  // 0. 提取 order
  let order = null;
  let rawParams = null;

  if (payload?.data?.order) {
  order = payload.data.order;
  rawParams = JSON.stringify(payload.data);
  } else if (typeof payload?.params === 'string') {
  try {
  const parsed = JSON.parse(payload.params);
  order = parsed.order || parsed.data?.order || parsed;
  rawParams = payload.params;
  } catch (e) {
  console.error('[afdian-webhook] params JSON 解析失败:', e.message);
  }
  } else if (payload?.params?.order) {
  order = payload.params.order;
  rawParams = JSON.stringify(payload.params);
  }

  // 0a. 测试连接
  if (!payload?.sign || !order) {
  console.log('[afdian-webhook] 测试连接请求，返 200');
  return res.json({ ec: 200, em: 'test_connection_ok' });
  }

  // 1. 签名验证（RSA 优先，否则 MD5）
  let signatureValid = false;
  const ts = payload.ts;
  const userId = payload.user_id;

  if (process.env.AFDIAN_WEBHOOK_PUBLIC_KEY) {
  signatureValid = verifyWebhookRSA(payload);
  } else {
  console.warn('[afdian-webhook] ⚠️ 未配置 webhook 公钥，用 MD5 fallback（生产建议配 RSA）');
  signatureValid = verifyWebhook({
  user_id: userId,
  ts,
  params: rawParams,
  sign: payload.sign,
  });
  }
  if (!signatureValid) {
  console.error('[afdian-webhook] ❌ 签名验证失败');
  return res.status(401).json({ ec: 401, em: 'invalid_signature' });
  }

  // ❌ 已删除：production + WEBHOOK_SECRET 校验 remark
  // remark 在订阅场景承载 user_id，不能当共享密钥

  const {
  out_trade_no,
  custom_order_id,
  product_type,
  total_amount,
  status,
  plan_id,
  sku_id,
  pay_month,
  remark,
  } = order;

  // 2. 幂等检查
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  const existing = db.prepare(`
  SELECT * FROM webhook_idempotency
  WHERE out_trade_no = ? AND custom_order_id = ? AND product_type = ?
  `).get(out_trade_no, custom_order_id || remark || '', product_type);

  if (existing?.processed) {
  console.log(`[afdian-webhook] 幂等命中: ${out_trade_no}`);
  return res.json({ ec: 200, em: 'duplicate_ignored' });
  }

  // 3. 写入幂等表
  const idempotencyCustomId = custom_order_id || remark || '';
  db.prepare(`
  INSERT OR IGNORE INTO webhook_idempotency (id, out_trade_no, custom_order_id, product_type, payload_hash)
  VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), out_trade_no, idempotencyCustomId, product_type, payloadHash);

  // 4. 只处理已支付 status=2
  if (status !== 2) {
  console.log(`[afdian-webhook] status=${status} 非已支付，跳过`);
  return res.json({ ec: 200, em: 'not_paid_yet' });
  }

  // 5. 业务处理
  // 注意：activateSubscription 内部是同步 DB 写；AI 触发放事务外
  if (product_type === 0) {
  // 订阅：userId 优先 custom_order_id，其次 remark（支付 URL 塞的是 remark）
  const subUserId = custom_order_id || remark;
  if (!subUserId) {
  console.error('[afdian-webhook] 订阅缺少 userId（custom_order_id / remark 皆空）', {
  out_trade_no,
  plan_id,
  });
  return res.status(400).json({ ec: 400, em: 'missing_user_id' });
  }

  const inferred = inferSubscriptionTier(plan_id);
  if (!inferred) {
  console.error(`[afdian-webhook] 无法识别的 plan_id: ${plan_id}（请检查 .env 中 AFDIAN_PLAN_*）`);
  // 不标 processed=1，便于修映射后重放；但 INSERT 已发生，重放需改 processed 或删行
  return res.status(400).json({ ec: 400, em: 'unknown_plan_id', plan_id });
  }

  try {
  await activateSubscription({
  userId: subUserId,
  planId: plan_id,
  outTradeNo: out_trade_no,
  amount: total_amount,
  payMonth: pay_month || inferred.payMonth,
  });
  } catch (err) {
  console.error('[afdian-webhook] activateSubscription 失败:', err);
  return res.status(500).json({ ec: 500, em: err.message });
  }
  } else if (product_type === 1) {
  // 商品：必须有 order_id
  const orderId = custom_order_id;
  if (!orderId) {
  console.error('[afdian-webhook] 商品单缺少 custom_order_id', { out_trade_no });
  return res.status(400).json({ ec: 400, em: 'missing_order_id' });
  }
  handleProductOrder({
  order_id: orderId,
  sku_id,
  out_trade_no,
  total_amount,
  });
  } else {
  console.warn(`[afdian-webhook] 未知 product_type=${product_type}`);
  }

  // 6. 标记已处理
  db.prepare(`
  UPDATE webhook_idempotency
  SET processed = 1, processed_at = ?
  WHERE out_trade_no = ? AND custom_order_id = ? AND product_type = ?
  `).run(Date.now(), out_trade_no, idempotencyCustomId, product_type);

  console.log(
  `[afdian-webhook] ✅ 处理完成: out_trade_no=${out_trade_no}, type=${product_type}, ${Date.now() - startTime}ms`
  );
  res.json({ ec: 200, em: '' });
  } catch (err) {
  console.error('[afdian-webhook] ❌ 异常:', err);
  res.status(500).json({ ec: 500, em: err.message });
  }
});

/**
  * 商品订单：标 paid + 触发 AI
  */
function handleProductOrder({ order_id, sku_id, out_trade_no, total_amount }) {
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(order_id);
  if (!order) {
  console.error(`[afdian-webhook] 订单不存在: ${order_id}`);
  return;
  }
  if (order.status === 'paid' || order.status === 'interpreted') {
  console.log(`[afdian-webhook] 订单 ${order_id} 已是 ${order.status}，跳过`);
  return;
  }

  db.prepare(`
  UPDATE orders
  SET status = 'paid', paid_at = ?, afdian_out_trade_no = ?, paid_amount = ?, updated_at = ?
  WHERE id = ?
  `).run(Date.now(), out_trade_no, total_amount != null ? parseFloat(total_amount) : null, Date.now(), order_id);

  console.log(`[afdian-webhook] ✅ 订单 ${order_id} 已标 paid，触发 AI 解读`);

  try {
  grantFirstPaidRewardForOrder(order.user_id);
  } catch (e) {
  console.error(`[afdian-webhook] first-paid reward failed for ${order_id}:`, e);
  }

  triggerAIReading(order_id).catch((err) => {
  console.error(`[afdian-webhook] triggerAIReading failed for ${order_id}:`, err);
  });
}

export default router;
