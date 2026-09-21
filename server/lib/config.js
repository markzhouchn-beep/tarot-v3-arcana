// ============================================================
// lib/config.js · 配置加载（环境变量集中管理）
// 创建：2026-09-01
// ============================================================

import 'dotenv/config';

function int(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function float(name, def) {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

function str(name, def) {
  return process.env[name] ?? def;
}

export const config = {
  // 服务
  NODE_ENV: str('NODE_ENV', 'development'),
  PORT: int('PORT', 3003),
  DOMAIN: str('DOMAIN', 'http://localhost:3003'),
  // 2026-09-21：FRONTEND_URL 支持逗号分隔多 URL（多域名），用于 CORS 白名单
  // FRONTEND_PRIMARY 取第一个，用于 redirect 目标
  FRONTEND_URL: str('FRONTEND_URL', 'http://localhost:5175'),
  FRONTEND_URL_LIST: (() => {
    const raw = str('FRONTEND_URL', 'http://localhost:5175');
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  })(),
  FRONTEND_PRIMARY: (() => {
    const raw = str('FRONTEND_URL', 'http://localhost:5175');
    return raw.split(',')[0].trim();
  })(),
  LAN_HOST: str('LAN_HOST', '192.168.0.105'),

  // 数据库
  DB_PATH: str('DB_PATH', './data/tarot_v3.db'),

  // MiniMax
  MINIMAX_API_KEY: str('MINIMAX_API_KEY', ''),
  MINIMAX_BASE_URL: str('MINIMAX_BASE_URL', 'https://api.minimaxi.com'),
  MINIMAX_MODEL: str('MINIMAX_MODEL', 'MiniMax-M2.7'),

  // 爱发电已下线（2026-09-21）— 所有 AFDIAN_* 配置已废弃

  // PayPal
  PAYPAL_CLIENT_ID: str('PAYPAL_CLIENT_ID', ''),
  PAYPAL_CLIENT_SECRET: str('PAYPAL_CLIENT_SECRET', ''),
  PAYPAL_MODE: str('PAYPAL_MODE', 'live'), // live | sandbox

  // 支付宝手机网站支付（v3.1）
  ALIPAY_APP_ID: str('ALIPAY_APP_ID', ''),
  ALIPAY_PRIVATE_KEY: str('ALIPAY_PRIVATE_KEY', ''),
  ALIPAY_PUBLIC_KEY: str('ALIPAY_PUBLIC_KEY', ''),
  ALIPAY_SANDBOX: str('ALIPAY_SANDBOX', '0'), // 1 = 沙箱（openapi.alipaydev.com），0 = 正式
  ALIPAY_NOTIFY_URL: str('ALIPAY_NOTIFY_URL', ''), // 可选，留空用 ${DOMAIN}/api/alipay/notify

  // 定价
  PRICE_SINGLE: float('PRICE_SINGLE', 1.9),
  PRICE_THREE: float('PRICE_THREE', 3.9),
  PRICE_TEN: float('PRICE_TEN', 9.9),
  PRICE_SILVER_MONTHLY: float('PRICE_SILVER_MONTHLY', 19.9),
  PRICE_SILVER_YEARLY: float('PRICE_SILVER_YEARLY', 199),
  PRICE_GOLD_MONTHLY: float('PRICE_GOLD_MONTHLY', 39.9),
  PRICE_GOLD_YEARLY: float('PRICE_GOLD_YEARLY', 399),

  // SMTP
  SMTP_HOST: str('SMTP_HOST', ''),
  SMTP_PORT: int('SMTP_PORT', 465),
  SMTP_USER: str('SMTP_USER', ''),
  SMTP_PASS: str('SMTP_PASS', ''),
  SMTP_FROM: str('SMTP_FROM', '星语塔罗 <noreply@example.com>'),

  // Session
  SESSION_SECRET: str('SESSION_SECRET', 'change-me'),
  SESSION_COOKIE_NAME: str('SESSION_COOKIE_NAME', 'arcana_session'),
  SESSION_TTL_DAYS: int('SESSION_TTL_DAYS', 30),

  // Mock
  MOCK_MODE: str('MOCK_MODE', '0'),

  // 后台
  ADMIN_USERNAME: str('ADMIN_USERNAME', 'mark'),
  ADMIN_PASSWORD_HASH: str('ADMIN_PASSWORD_HASH', ''),

  // 定时任务
  RECONCILE_INTERVAL: int('RECONCILE_INTERVAL', 60),

  // 日志
  LOG_LEVEL: str('LOG_LEVEL', 'info'),
};

export default config;
