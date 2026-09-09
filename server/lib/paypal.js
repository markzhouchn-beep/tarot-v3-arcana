// ============================================================
// lib/paypal.js · PayPal REST API 封装（原生 fetch，不依赖 SDK）
// 参考：https://developer.paypal.com/docs/checkout/standard/integrate/
// ============================================================

import { config } from './config.js';

// PayPal API Base URL
const BASE = config.PAYPAL_MODE === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

// Access token 缓存（避免每次请求都重新获取）
let _accessToken = null;
let _tokenExpiry = 0; // Unix ms

/**
 * 生成 / 缓存 PayPal OAuth 2.0 Access Token
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  const now = Date.now();
  if (_accessToken && now < _tokenExpiry) {
    return _accessToken;
  }

  if (!config.PAYPAL_CLIENT_ID || !config.PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)');
  }

  const auth = Buffer.from(
    `${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal token request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  _accessToken = data.access_token;
  // 提前 5 分钟过期
  _tokenExpiry = now + (data.expires_in - 300) * 1000;

  console.log('[paypal] Access token refreshed, expires in', data.expires_in, 's');
  return _accessToken;
}

/**
 * 通用 fetch 封装（带 Bearer token）
 */
async function paypalFetch(path, options = {}) {
  const token = await getAccessToken();
  const url = `${BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return response;
}

/**
 * 创建 PayPal 订单
 * @param {string} orderId     - 我们系统的订单 ID（作为 reference_id）
 * @param {number} amount      - 金额
 * @param {string} currency    - 货币代码 CNY/TWD/HKD/USD
 * @param {string} description - 描述
 * @returns {Promise<{paypalOrderId: string, approvalUrl: string}>}
 */
export async function createPaypalOrder(orderId, amount, currency, description) {
  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: orderId, // 用于 webhook 识别
        description,
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: 'Arcana AI',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
      return_url: `${config.DOMAIN}/paypal/return`,
      cancel_url: `${config.DOMAIN}/paypal/cancel`,
    },
  };

  const response = await paypalFetch('/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`PayPal create order failed: ${response.status} ${JSON.stringify(data)}`);
  }

  // 找到 approval URL
  const approvalLink = data.links?.find(l => l.rel === 'approve');
  if (!approvalLink) {
    throw new Error(`No approval link in PayPal response: ${JSON.stringify(data)}`);
  }

  console.log(`[paypal] Order created: paypal_id=${data.id}, currency=${currency}, amount=${amount}, reference=${orderId}`);

  return {
    paypalOrderId: data.id,
    approvalUrl: approvalLink.href,
  };
}

/**
 * 确认（capture）PayPal 订单
 * @param {string} paypalOrderId - PayPal 订单 ID
 * @returns {Promise<{status: string, captureId: string}>}
 */
export async function capturePaypalOrder(paypalOrderId) {
  const response = await paypalFetch(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`PayPal capture failed: ${response.status} ${JSON.stringify(data)}`);
  }

  if (data.status !== 'COMPLETED') {
    throw new Error(`PayPal order not completed: ${data.status}`);
  }

  // 找到 capture ID
  const purchaseUnit = data.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  console.log(`[paypal] Order captured: paypal_id=${paypalOrderId}, capture_id=${capture?.id}, status=${data.status}`);

  return {
    status: data.status,
    captureId: capture?.id || null,
    payerId: data.payer?.payer_id || null,
    payerEmail: data.payer?.email_address || null,
  };
}

export default { createPaypalOrder, capturePaypalOrder };
