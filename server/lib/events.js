// ============================================================
// lib/events.js · 埋点工具
// 创建：2026-09-06
// 用于 admin/funnel 等数据统计的埋点
// ============================================================

import db from '../db.js';
import crypto from 'node:crypto';

/**
 * 写入一个埋点事件
 * @param {string} eventName - 事件名（如 user_registered / order_created / order_paid）
 * @param {object} opts
 * @param {string} [opts.userId]
 * @param {string} [opts.deviceId]
 * @param {string} [opts.sessionId]
 * @param {string} [opts.pageUrl]
 * @param {object} [opts.properties]
 */
export function trackEvent(eventName, opts = {}) {
  try {
    db.prepare(`
      INSERT INTO analytics_events (id, event_name, user_id, device_id, session_id, page_url, properties, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      eventName,
      opts.userId || null,
      opts.deviceId || null,
      opts.sessionId || null,
      opts.pageUrl || null,
      opts.properties ? JSON.stringify(opts.properties) : null,
      Date.now()
    );
  } catch (err) {
    // 埋点失败不能影响主流程
    console.error('[events] trackEvent error:', err.message);
  }
}
