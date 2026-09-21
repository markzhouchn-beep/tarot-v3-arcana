// ============================================================
// lib/alipay.js · 支付宝手机网站支付（wap）
// 创建：2026-09-21 · v3.1 新增
//
// 能力：
//   - sign()            生成 RSA2(SHA256) 签名
//   - verifySign()      验签（验支付宝回调）
//   - createWapPay()    生成手机网站支付 URL（前端跳转）
//   - queryOrder()      查询订单状态（异步通知兜底）
//
// 网关：
//   - 正式：https://openapi.alipay.com/gateway.do
//   - 沙箱：https://openapi.alipaydev.com/gateway.do
//
// 不依赖第三方 SDK，全部用 Node 内置 crypto。
// ============================================================

import crypto from 'node:crypto';

const GATEWAY_PROD = 'https://openapi.alipay.com/gateway.do';
const GATEWAY_SANDBOX = 'https://openapi.alipaydev.com/gateway.do';
const SIGN_TYPE = 'RSA2';
const CHARSET = 'UTF-8';

// ============================================================
// 1. 签名（应用私钥，PKCS#1 v1.5 with SHA-256）
// ============================================================
/**
 * 用应用私钥对排序后的参数串签名
 * @param {Object} params - 业务参数（必须已含 app_id/method/charset/sign_type/timestamp/version/biz_content）
 * @param {string} privateKey - 应用私钥 PEM（含 BEGIN PRIVATE KEY 头；支持 PKCS#1 和 PKCS#8）
 * @returns {string} base64 签名字符串
 */
export function sign(params, privateKey) {
  // 1. 过滤空值 + sign/sign_type 字段
  const filtered = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (k === 'sign' || k === 'sign_type') continue;
    filtered[k] = v;
  }
  // 2. 字典序排序
  const sortedKeys = Object.keys(filtered).sort();
  // 3. 拼接 k=v&k=v
  const signStr = sortedKeys.map((k) => `${k}=${filtered[k]}`).join('&');
  // 4. 用应用私钥签名（PKCS#1 v1.5 with SHA-256）
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signStr, CHARSET);
  const sig = signer.sign(privateKey, 'base64');
  return sig;
}

// ============================================================
// 2. 验签（用支付宝公钥验证回调 sign）
// ============================================================
/**
 * 验签支付宝异步通知 / 同步回跳
 * @param {Object} params - 支付宝回调的所有参数（含 sign）
 * @param {string} alipayPublicKey - 支付宝公钥 PEM
 * @returns {boolean} 是否验签通过
 */
export function verifySign(params, alipayPublicKey) {
  const signValue = params.sign;
  if (!signValue) return false;

  // 过滤空值 + sign/sign_type
  const filtered = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (k === 'sign' || k === 'sign_type') continue;
    filtered[k] = v;
  }
  const sortedKeys = Object.keys(filtered).sort();
  const signStr = sortedKeys.map((k) => `${k}=${filtered[k]}`).join('&');

  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signStr, CHARSET);
    return verifier.verify(alipayPublicKey, signValue, 'base64');
  } catch (err) {
    console.error('[alipay] verifySign error:', err.message);
    return false;
  }
}

// ============================================================
// 3. 构造支付跳转 URL（前端 location.href）
// ============================================================
/**
 * 创建手机网站支付订单，返回支付网关 URL
 * @param {Object} args
 * @param {string} args.outTradeNo - 商户订单号（系统唯一）
 * @param {number} args.totalAmount - 金额（元，2 位小数）
 * @param {string} args.subject - 商品标题
 * @param {string} args.appId - 支付宝 APP_ID
 * @param {string} args.privateKey - 应用私钥 PEM
 * @param {string} [args.notifyUrl] - 异步通知 URL（notify_url）
 * @param {string} [args.returnUrl] - 同步回跳 URL（return_url）
 * @param {string} [args.sandbox] - 是否沙箱环境
 * @returns {string} 完整支付 URL
 */
export function createWapPay({
  outTradeNo,
  totalAmount,
  subject,
  appId,
  privateKey,
  notifyUrl,
  returnUrl,
  sandbox = false,
}) {
  const gateway = sandbox ? GATEWAY_SANDBOX : GATEWAY_PROD;

  // 公共参数
  const common = {
    app_id: appId,
    method: 'alipay.trade.wap.pay',
    charset: CHARSET,
    sign_type: SIGN_TYPE,
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    notify_url: notifyUrl,
    return_url: returnUrl,
  };

  // 业务参数（必须 JSON 字符串）
  const bizContent = JSON.stringify({
    out_trade_no: outTradeNo,
    total_amount: Number(totalAmount).toFixed(2),
    subject,
    product_code: 'QUICK_WAP_WAY', // 手机网站支付固定值
    timeout_express: '15m',       // 15 分钟未支付自动关闭
  });

  const params = {
    ...common,
    biz_content: bizContent,
  };

  // 签名
  params.sign = sign(params, privateKey);

  // 拼 URL
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  return `${gateway}?${query}`;
}

// ============================================================
// 4. 查询订单（异步通知兜底 / 用户点击"我已支付"按钮时调）
// ============================================================
/**
 * 主动查询订单状态（POST → gateway）
 * @param {string} outTradeNo - 商户订单号
 * @param {Object} creds - { appId, privateKey, alipayPublicKey, sandbox? }
 * @returns {Promise<{ok, tradeStatus, tradeNo, totalAmount, raw}>}
 */
export async function queryOrder(outTradeNo, creds) {
  const { appId, privateKey, sandbox = false } = creds;
  const gateway = sandbox ? GATEWAY_SANDBOX : GATEWAY_PROD;

  const common = {
    app_id: appId,
    method: 'alipay.trade.query',
    charset: CHARSET,
    sign_type: SIGN_TYPE,
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
  };
  const bizContent = JSON.stringify({ out_trade_no: outTradeNo });
  const params = { ...common, biz_content: bizContent };
  params.sign = sign(params, privateKey);

  // 支付宝 query 接口只支持 POST application/x-www-form-urlencoded
  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  try {
    const res = await fetch(gateway, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=' + CHARSET },
      body,
    });
    const text = await res.text();
    const json = parseAlipayResponse(text);

    if (!json) {
      return { ok: false, error: 'PARSE_ERROR', raw: text };
    }

    return {
      ok: true,
      tradeStatus: json.tradeStatus,
      tradeNo: json.tradeNo,
      totalAmount: json.totalAmount,
      raw: json,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================
// 内部工具
// ============================================================
function formatTimestamp(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/**
 * 支付宝返回可能是 JSON 或 urlencoded 编码的 JSON
 */
function parseAlipayResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    // urlencoded：key=val&key=val&...，但值可能再 URL encode 过一层
    const out = {};
    for (const pair of text.split('&')) {
      const [k, v = ''] = pair.split('=');
      if (k) {
        try {
          out[decodeURIComponent(k)] = decodeURIComponent(v);
        } catch {
          out[k] = v;
        }
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  }
}

// ============================================================
// 5. 处理 PEM 格式（用户可能给 BEGIN RSA PRIVATE KEY 或 BEGIN PRIVATE KEY）
// ============================================================
/**
 * 兼容 PKCS#1 / PKCS#8 私钥，自动转换
 */
export function normalizePrivateKey(rawKey) {
  if (!rawKey) return rawKey;
  const trimmed = rawKey.trim();
  // 已经是 PKCS#8（PRIVATE KEY）就直接返回
  if (trimmed.includes('BEGIN PRIVATE KEY')) return trimmed;
  // PKCS#1（RSA PRIVATE KEY）需要转 PKCS#8
  if (trimmed.includes('BEGIN RSA PRIVATE KEY')) {
    try {
      const keyObj = crypto.createPrivateKey(trimmed);
      return keyObj.export({ type: 'pkcs8', format: 'pem' }).toString();
    } catch (err) {
      console.warn('[alipay] 私钥转换失败（PKCS#1→PKCS#8）:', err.message);
      return trimmed;
    }
  }
  return trimmed;
}

/**
 * 兼容支付宝公钥（一般是 PKCS#8 直接可用）
 */
export function normalizePublicKey(rawKey) {
  return rawKey ? rawKey.trim() : rawKey;
}