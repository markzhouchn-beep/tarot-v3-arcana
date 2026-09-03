// ============================================================
// lib/afdian.js · 爱发电封装
// v3.0 · 上线修复：plan UUID → tier 映射（P0-1）
// ============================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

/**
  * 生成爱发电签名（OpenAPI + Webhook 通用）
  * md5(token + "params" + params + "ts" + ts + "user_id" + user_id)
  */
export function signPayload(params, ts, userId, token) {
  const t = token || config.AFDIAN_TOKEN;
  const u = userId || config.AFDIAN_USER_ID;
  const text = `${t}params${params}ts${ts}user_id${u}`;
  return crypto.createHash('md5').update(text).digest('hex');
}

/**
  * 校验 webhook 签名（MD5）
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
  * 调爱发电 query-order
  */
export async function queryOrder({ outTradeNo, page = 1, perPage = 50 } = {}) {
  if (!config.AFDIAN_TOKEN || !config.AFDIAN_USER_ID) {
  console.warn('[afdian] AFDIAN_TOKEN / AFDIAN_USER_ID 未配置，返回空');
  return { list: [], totalCount: 0, totalPage: 0 };
  }

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
  * ping（验证 token + 签名）
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
  * remark = user_id（业务必要；不要再拿 remark 做 WEBHOOK_SECRET）
  */
export function buildSubscriptionPayUrl(planId, customOrderId) {
  if (!planId) return null;
  const remark = customOrderId
  ? `&remark=${encodeURIComponent(customOrderId)}`
  : '&remark=';
  return `https://ifdian.net/order/create?plan_id=${planId}&product_type=0${remark}&affiliate_code=&fr=afcom`;
}

/**
  * 生成商品方案支付 URL
  */
export function buildProductPayUrl(skuId, customOrderId) {
  if (!skuId) return null;
  return `https://afdian.com/item/${skuId}?custom_order_id=${encodeURIComponent(customOrderId)}`;
}

/**
  * plan_id → tier（P0-1 修复）
  * 优先用 .env 里的真实 UUID 映射；兼容测试用假 id（含 silver/gold 字样）
  */
export function inferSubscriptionTier(planId) {
  if (!planId) return null;

  const map = {
  [config.AFDIAN_PLAN_SILVER_MONTHLY]: { tier: 'silver', payMonth: 1 },
  [config.AFDIAN_PLAN_SILVER_YEARLY]: { tier: 'silver', payMonth: 12 },
  [config.AFDIAN_PLAN_GOLD_MONTHLY]: { tier: 'gold', payMonth: 1 },
  [config.AFDIAN_PLAN_GOLD_YEARLY]: { tier: 'gold', payMonth: 12 },
  };

  // 过滤空字符串 key（未配置时不要匹配）
  for (const [id, info] of Object.entries(map)) {
  if (id && id === planId) return info;
  }

  // 兼容开发/测试假 plan_id
  if (planId.includes('silver')) {
  return { tier: 'silver', payMonth: planId.includes('yearly') ? 12 : 1 };
  }
  if (planId.includes('gold')) {
  return { tier: 'gold', payMonth: planId.includes('yearly') ? 12 : 1 };
  }

  return null;
}

/**
  * RSA + SHA256 校验 webhook（生产推荐）
  */
const PUB_KEY_FILE = path.join(process.cwd(), 'lib', 'afdian-webhook.pub');

export function verifyWebhookRSA(payload) {
  try {
  const order = payload?.data?.order;
  if (!order || !order.sign) return false;

  const { out_trade_no, user_id, plan_id, total_amount, sign } = order;
  const signStr = `${out_trade_no}${user_id}${plan_id || ''}${total_amount}`;

  let pubKey = process.env.AFDIAN_WEBHOOK_PUBLIC_KEY;
  if (!pubKey && fs.existsSync(PUB_KEY_FILE)) {
  pubKey = fs.readFileSync(PUB_KEY_FILE, 'utf-8');
  }

  if (!pubKey) {
  console.warn('[afdian] webhook 公钥未配置（AFDIAN_WEBHOOK_PUBLIC_KEY 或 server/lib/afdian-webhook.pub）');
  return false;
  }

  const verifier = crypto.createVerify('SHA256');
  verifier.update(signStr);
  return verifier.verify(pubKey, sign, 'base64');
  } catch (err) {
  console.error('[afdian] webhook RSA 验签异常:', err.message);
  return false;
  }
}

export default {
  signPayload,
  verifyWebhook,
  verifyWebhookRSA,
  queryOrder,
  pingAfdian,
  buildSubscriptionPayUrl,
  buildProductPayUrl,
  inferSubscriptionTier,
};
