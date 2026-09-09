// ============================================================
// lib/paypal.js · PayPal Checkout SDK 封装
// ============================================================

import { Client, Environment } from '@paypal/paypal-server-sdk';
import { config } from './config.js';

let _client = null;

function getClient() {
  if (_client) return _client;
  if (!config.PAYPAL_CLIENT_ID || !config.PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)');
  }
  _client = new Client({
    clientCredentials: {
      clientId: config.PAYPAL_CLIENT_ID,
      clientSecret: config.PAYPAL_CLIENT_SECRET,
    },
    options: {
      environment: config.PAYPAL_MODE === 'sandbox'
        ? Environment.Sandbox
        : Environment.Live,
    },
  });
  return _client;
}

/**
 * 创建 PayPal 订单
 * @param {string} orderId     - 我们系统的订单 ID
 * @param {number} amount      - 金额（美元）
 * @param {string} description - 描述
 * @returns {Promise<{orderId: string, approvalUrl: string}>}
 */
export async function createPaypalOrder(orderId, amount, description) {
  const client = getClient();

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: orderId,       // 用于 webhook 识别
        description,
        amount: {
          currency_code: 'USD',
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

  const response = await client.orders.create({ body });
  const paypalOrder = response.result;

  // 找到 approval URL
  const approvalLink = paypalOrder.links.find(l => l.rel === 'approve');
  if (!approvalLink) throw new Error('No approval link in PayPal response');

  return {
    paypalOrderId: paypalOrder.id,
    approvalUrl: approvalLink.href,
  };
}

/**
 * 确认（capture）PayPal 订单
 * @param {string} paypalOrderId - PayPal 订单 ID
 * @returns {Promise<{status: string, captureId: string}>}
 */
export async function capturePaypalOrder(paypalOrderId) {
  const client = getClient();

  const response = await client.orders.capture(paypalOrderId);
  const order = response.result;

  if (order.status !== 'COMPLETED') {
    throw new Error(`PayPal order not completed: ${order.status}`);
  }

  // 找到 capture ID
  const purchaseUnit = order.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  return {
    status: order.status,
    captureId: capture?.id || null,
    payerId: order.payer?.payer_id || null,
    payerEmail: order.payer?.email_address || null,
  };
}

export default { createPaypalOrder, capturePaypalOrder };
