// ============================================================
// routes/afdian-webhook.js · 爱发电 webhook 入口（带幂等表）
// v3.0 核心：解决 v2.0 漏单 + 移除 trust_paid
// 创建：2026-09-01
// ============================================================

import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { verifyWebhook, verifyWebhookRSA, inferSubscriptionTier } from '../lib/afdian.js';
import { withExclusiveTransaction } from '../db.js';
import { activateSubscription } from './membership.js';
import { triggerAIReading } from './orders.js';
import { grantFirstPaidRewardForOrder } from '../lib/invite.js';

const router = Router();

/**
 * POST /api/afdian/webhook
 * 主入口
 */
router.post('/webhook', async (req, res) => {
  const startTime = Date.now();

  try {
    const payload = req.body;

    // 爱发电 webhook 实际格式（2026-09-02 修）：
    // 顶层字段：{ ec, em, sign, ts, user_id, params }
    // params 是 JSON 字符串，里面含 order 信息
    // 适配两种格式：嵌套 data.order (v3.0.1 错误格式) 与 顶层 params JSON (爱发电真实)

    // 0. 提取 order 字段
    let order = null;
    let rawParams = null;

    if (payload?.data?.order) {
      // 嵌套格式（v3.0.1 错误，但保留兼容）
      order = payload.data.order;
      rawParams = JSON.stringify(payload.data);
    } else if (typeof payload?.params === 'string') {
      // 爱发电真实格式：params 是 JSON 字符串
      try {
        const parsed = JSON.parse(payload.params);
        order = parsed.order || parsed.data?.order || parsed;
        rawParams = payload.params;
      } catch (e) {
        console.error('[afdian-webhook] params JSON 解析失败:', e.message);
      }
    } else if (payload?.params?.order) {
      // 备用：params 是对象
      order = payload.params.order;
      rawParams = JSON.stringify(payload.params);
    }

    // 0a. 测试连接请求（无 sign 或无 order）返 200 验证通过
    if (!payload?.sign || !order) {
      console.log('[afdian-webhook] 测试连接请求，返 200');
      return res.json({ ec: 200, em: 'test_connection_ok' });
    }

    // 1. 签名验证
    let signatureValid = false;
    const ts = payload.ts;
    const userId = payload.user_id;

    if (process.env.AFDIAN_WEBHOOK_PUBLIC_KEY) {
      signatureValid = verifyWebhookRSA(payload);
    } else {
      console.warn('[afdian-webhook] ⚠️ 未配置 webhook 公钥，用老 md5 fallback（上线前必配）');
      signatureValid = verifyWebhook({ user_id: userId, ts, params: rawParams, sign: payload.sign });
    }
    if (!signatureValid) {
      console.error('[afdian-webhook] ❌ 签名验证失败');
      return res.status(401).json({ ec: 401, em: 'invalid_signature' });
    }

    // 1a. 简易验签（防住 MD5 密钥泄漏后的二次攻击）
    // 在爱发电后台 → 商品订单 → 备注里填 WEBHOOK_SECRET（仅 Mark 知道）
    // 生产环境必须配置；开发环境跳过
    if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_SECRET) {
      const remark = order?.remark || payload?.remark;
      if (remark !== process.env.WEBHOOK_SECRET) {
        console.error('[afdian-webhook] ❌ remark 验证失败（简易验签）');
        return res.status(403).json({ ec: 403, em: 'invalid_secret' });
      }
    }

    const { out_trade_no, custom_order_id, product_type, total_amount, status, plan_id, sku_id, pay_month } = order;

    // 2. 幂等检查
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    const existing = db.prepare(`
      SELECT * FROM webhook_idempotency
      WHERE out_trade_no = ? AND custom_order_id = ? AND product_type = ?
    `).get(out_trade_no, custom_order_id, product_type);

    if (existing?.processed) {
      console.log(`[afdian-webhook] 幂等命中: ${out_trade_no}`);
      return res.json({ ec: 200, em: 'duplicate_ignored' });
    }

    // 3. 写入幂等表（INSERT OR IGNORE 处理并发）
    db.prepare(`
      INSERT OR IGNORE INTO webhook_idempotency (id, out_trade_no, custom_order_id, product_type, payload_hash)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), out_trade_no, custom_order_id, product_type, payloadHash);

    // 4. 只处理 status=2 (已支付)
    if (status !== 2) {
      console.log(`[afdian-webhook] status=${status} 非已支付，跳过`);
      return res.json({ ec: 200, em: 'not_paid_yet' });
    }

    // 5. 排他事务处理（SQLite 防 race condition）
    const tx = withExclusiveTransaction(() => {
      if (product_type === 0) {
        // 订阅方案
        handleSubscription({ custom_order_id, plan_id, out_trade_no, total_amount, pay_month });
      } else if (product_type === 1) {
        // 商品方案（单次解读）
        handleProductOrder({ order_id: custom_order_id, sku_id, out_trade_no, total_amount });
      }
    });
    tx();

    // 6. 标记幂等表已处理
    db.prepare(`
      UPDATE webhook_idempotency SET processed = 1, processed_at = ? WHERE out_trade_no = ? AND custom_order_id = ? AND product_type = ?
    `).run(Date.now(), out_trade_no, custom_order_id, product_type);

    console.log(`[afdian-webhook] ✅ 处理完成: out_trade_no=${out_trade_no}, type=${product_type}, ${Date.now() - startTime}ms`);
    res.json({ ec: 200, em: '' });
  } catch (err) {
    console.error('[afdian-webhook] ❌ 异常:', err);
    res.status(500).json({ ec: 500, em: err.message });
  }
});

/**
 * 内部：处理订阅 webhook
 */
async function handleSubscription({ custom_order_id, plan_id, out_trade_no, total_amount, pay_month }) {
  const userId = custom_order_id;
  const inferred = inferSubscriptionTier(plan_id);
  if (!inferred) {
    console.error(`[afdian-webhook] 无法识别的 plan_id: ${plan_id}`);
    return;
  }

  await activateSubscription({
    userId,
    planId: plan_id,
    outTradeNo: out_trade_no,
    amount: total_amount,
    payMonth: pay_month || inferred.payMonth,
  });
}

/**
 * 内部：处理商品订单 webhook
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
    SET status = 'paid', paid_at = ?, afdian_out_trade_no = ?, updated_at = ?
    WHERE id = ?
  `).run(Date.now(), out_trade_no, Date.now(), order_id);

  console.log(`[afdian-webhook] ✅ 订单 ${order_id} 已标 paid，触发 AI 解读`);

  // Phase 4: webhook 主路径发奖励（不等 AI 解读，避免 webhook 失败丢奖励）
  // 必须在 triggerAIReading 之前：即使 AI 解读卡住，邀请人也能拿到奖励
  try {
    grantFirstPaidRewardForOrder(order.user_id);
  } catch (e) {
    console.error(`[afdian-webhook] first-paid reward failed for ${order_id}:`, e);
    // 不阻断主流程
  }

  // 异步触发 AI 解读（不阻塞 webhook 响应）
  triggerAIReading(order_id).catch(err => {
    console.error(`[afdian-webhook] triggerAIReading failed for ${order_id}:`, err);
  });
}

export default router;
