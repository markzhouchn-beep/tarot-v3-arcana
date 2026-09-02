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
  FRONTEND_URL: str('FRONTEND_URL', 'http://localhost:5175'),
  LAN_HOST: str('LAN_HOST', '192.168.0.105'),

  // 数据库
  DB_PATH: str('DB_PATH', './data/tarot_v3.db'),

  // MiniMax
  MINIMAX_API_KEY: str('MINIMAX_API_KEY', ''),
  MINIMAX_BASE_URL: str('MINIMAX_BASE_URL', 'https://api.minimaxi.com/anthropic'),
  MINIMAX_MODEL: str('MINIMAX_MODEL', 'MiniMax-M2.7'),

  // 爱发电
  AFDIAN_USER_ID: str('AFDIAN_USER_ID', ''),
  AFDIAN_TOKEN: str('AFDIAN_TOKEN', ''),

  // 订阅 plan_id
  AFDIAN_PLAN_SILVER_MONTHLY: str('AFDIAN_PLAN_SILVER_MONTHLY', ''),
  AFDIAN_PLAN_SILVER_YEARLY: str('AFDIAN_PLAN_SILVER_YEARLY', ''),
  AFDIAN_PLAN_GOLD_MONTHLY: str('AFDIAN_PLAN_GOLD_MONTHLY', ''),
  AFDIAN_PLAN_GOLD_YEARLY: str('AFDIAN_PLAN_GOLD_YEARLY', ''),

  // 商品 sku_id
  AFDIAN_SKU_SINGLE: str('AFDIAN_SKU_SINGLE', ''),
  AFDIAN_SKU_THREE: str('AFDIAN_SKU_THREE', ''),
  AFDIAN_SKU_TEN: str('AFDIAN_SKU_TEN', ''),

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
