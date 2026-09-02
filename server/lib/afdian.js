// ============================================================
// lib/afdian.js · 爱发电封装
// 沿用 v2.0 query-order 端点（实测 afdian.com，文档 typo）
// v3.0 扩展：product_type 判定（0=订阅 / 1=商品）
// 创建：2026-09-01
// ============================================================

import crypto from 'node:crypto';
import { config } from './config.js';

/**
 * 生成爱发电签名（OpenAPI + Webhook 通用）
 * v3.0 修正：爱发电官方签名算法是 md5(token + "params" + params + "ts" + ts + "user_id" + user_id)
 * ⚠️ 不是 sha256，不是 afdian-ts-sorted 格式
 */
export function signPayload(params, ts, userId, token) {
  const t = token || config.AFDIAN_TOKEN;
  const u = userId || config.AFDIAN_USER_ID;
  const text = `${t}params${params}ts${ts}user_id${u}`;
  return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * 校验 webhook 签名
 * v3.0 webhook payload 顶层有 user_id / params / ts / sign
 */
export function verifyWebhook(payload) {
  if (!payload) return false;
  const userId = payload.user_id || config.AFDIAN_USER_ID;
  const ts = payload.ts;
  const params = payload.params;
  const sign = payload.sign;
  if (!ts || !params || !sign) return false;
  const expected = signPayload(params, ts, userId);
  return expected === sign;
}

/**
 * 调爱发电 query-order 接口查订单
 * ⚠️ v3.0.1 修正（Mark 002 00:12 完整规则）：
 *   1. endpoint：ifdian.net/api/open/query-order（v2 写成 afdian.com 是 typo）
 *   2. 返回结构：data.list[]（订单在 list 数组里，不是 data.order）
 *   3. status: 2 = 已支付 / 3 = 已退款 / 其他 = 未支付
 */
export async function queryOrder({ outTradeNo, page = 1, perPage = 50 } = {}) {
  if (!config.AFDIAN_TOKEN || !config.AFDIAN_USER_ID) {
    console.warn('[afdian] AFDIAN_TOKEN / AFDIAN_USER_ID 未配置，返回空');
    return { list: [], totalCount: 0, totalPage: 0 };
  }

  // inner params（业务参数），转 JSON 字符串作为外层 params 字段值
  const innerParams = { page, per_page: Math.min(perPage, 100) };
  if (outTradeNo) innerParams.out_trade_no = outTradeNo;
  const paramsStr = JSON.stringify(innerParams);

  const ts = Math.floor(Date.now() / 1000).toString();
  const sign = signPayload(paramsStr, ts, config.AFDIAN_USER_ID);

  const body = {
    user_id: config.AFDIAN_USER_ID,
    params: paramsStr,
    ts,
    sign,
  };

  try {
    const res = await fetch('https://ifdian.net/api/open/query-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.ec !== 200) {
      console.error(`[afdian] query-order ec=${json.ec}: ${json.em}`);
      return { list: [], totalCount: 0, totalPage: 0, error: json.em };
    }
    // ✅ 正确结构：data.list[]
    return {
      list: json.data?.list || [],
      totalCount: json.data?.total_count || 0,
      totalPage: json.data?.total_page || 0,
    };
  } catch (err) {
    console.error('[afdian] query-order 异常:', err.message);
    return { list: [], totalCount: 0, totalPage: 0, error: err.message };
  }
}

/**
 * ping 接口（调试用：验证 token + 签名是否正确）
 */
export async function pingAfdian() {
  if (!config.AFDIAN_TOKEN || !config.AFDIAN_USER_ID) {
    return { ok: false, error: 'AFDIAN_TOKEN / AFDIAN_USER_ID 未配置' };
  }
  const paramsStr = JSON.stringify({ a: 333 });
  const ts = Math.floor(Date.now() / 1000).toString();
  const sign = signPayload(paramsStr, ts, config.AFDIAN_USER_ID);
  try {
    const res = await fetch('https://ifdian.net/api/open/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: config.AFDIAN_USER_ID,
        params: paramsStr,
        ts,
        sign,
      }),
    });
    const json = await res.json();
    return { ok: json.ec === 200, ec: json.ec, em: json.em };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 生成订阅方案支付 URL
 * @param {string} planId - silver_monthly / gold_yearly 等
 * @param {string} customOrderId - user_id（订阅场景）
 * @returns {string|null}
 */
export function buildSubscriptionPayUrl(planId, customOrderId) {
  if (!planId) return null;
  // 真实格式（Mark 提供 2026-09-02 01:38）：
  // https://ifdian.net/order/create?plan_id=...&product_type=0&remark=...&affiliate_code=&fr=afcom
  const remark = customOrderId ? `&remark=${encodeURIComponent(customOrderId)}` : '&remark=';
  return `https://ifdian.net/order/create?plan_id=${planId}&product_type=0${remark}&affiliate_code=&fr=afcom`;
}

/**
 * 生成商品方案支付 URL
 * @param {string} skuId
 * @param {string} customOrderId - order_id（单次场景）
 * @returns {string|null}
 */
export function buildProductPayUrl(skuId, customOrderId) {
  if (!skuId) return null;
  return `https://afdian.com/item/${skuId}?custom_order_id=${encodeURIComponent(customOrderId)}`;
}

/**
 * 判断 plan_id 对应的订阅类型（银月 / 金月）
 */
export function inferSubscriptionTier(planId) {
  if (!planId) return null;
  if (planId.includes('silver')) return { tier: 'silver', payMonth: planId.includes('yearly') ? 12 : 1 };
  if (planId.includes('gold')) return { tier: 'gold', payMonth: planId.includes('yearly') ? 12 : 1 };
  return null;
}

export default {
  signPayload,
  verifyWebhook,
  queryOrder,
  buildSubscriptionPayUrl,
  buildProductPayUrl,
  inferSubscriptionTier,
};

/**
 * v3.0.1：RSA + SHA256 校验 webhook 签名（2025-07 后爱发电新规则）
 * ⚠️ 需要从爱发电开发者后台下载公钥：
 *   https://afdian.com/dashboard/dev → Webhook → 公钥
 * 配置方式（任选其一）：
 *   1) .env: AFDIAN_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
 *   2) 文件: server/lib/afdian-webhook.pub
 */
import fs from 'node:fs';
import path from 'node:path';

const PUB_KEY_FILE = path.join(process.cwd(), 'lib', 'afdian-webhook.pub');

export function verifyWebhookRSA(payload) {
  try {
    const order = payload?.data?.order;
    if (!order || !order.sign) return false;

    const { out_trade_no, user_id, plan_id, total_amount, sign } = order;
    // 爱发电规则：拼接 out_trade_no + user_id + plan_id + total_amount
    const signStr = `${out_trade_no}${user_id}${plan_id || ''}${total_amount}`;

    // 优先环境变量，否则读文件
    let pubKey = process.env.AFDIAN_WEBHOOK_PUBLIC_KEY;
    if (!pubKey && fs.existsSync(PUB_KEY_FILE)) {
      pubKey = fs.readFileSync(PUB_KEY_FILE, 'utf-8');
    }

    if (!pubKey) {
      console.warn('[afdian] webhook 公钥未配置（AFDIAN_WEBHOOK_PUBLIC_KEY 或 server/lib/afdian-webhook.pub）');
      return false;  // 没配就直接拒签（不放过任何）
    }

    const verifier = crypto.createVerify('SHA256');
    verifier.update(signStr);
    return verifier.verify(pubKey, sign, 'base64');
  } catch (err) {
    console.error('[afdian] webhook RSA 验签异常:', err.message);
    return false;
  }
}
