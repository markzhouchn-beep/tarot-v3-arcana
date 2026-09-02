// ============================================================
// middleware/canary.js · 小流量灰度发布
// 创建：2026-09-02（Phase 6）
// ============================================================

import { config } from '../lib/config.js';

/**
 * 灰度发布中间件
 *
 * 启用：env CANARY_PERCENTAGE=20  → 仅 20% 流量进入新代码
 *        env CANARY_USER_IDS=user1,user2  → 白名单用户始终进入
 *
 * 不匹配的请求：返 404（用户走 v2 旧版本）
 *
 * 用法：app.use('/api/v3', canaryMiddleware, v3Router)
 */
export function canaryMiddleware(req, res, next) {
  // 1. 全量开关
  const percentage = parseInt(process.env.CANARY_PERCENTAGE || '100');
  if (percentage >= 100) return next();
  if (percentage <= 0) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'v3 暂未开放' });
  }

  // 2. 白名单（运营手动指定）
  const whitelist = (process.env.CANARY_USER_IDS || '').split(',').filter(Boolean);
  const userId = req.user?.id;
  if (userId && whitelist.includes(userId)) {
    req.canary = { matched: true, reason: 'whitelist' };
    return next();
  }

  // 3. 百分比抽样（基于 userId 哈希 → 同用户始终同结果）
  const sampleKey = userId || req.ip || req.headers['x-device-id'] || crypto.randomUUID();
  const hash = simpleHash(sampleKey);
  const inCanary = (hash % 100) < percentage;

  if (inCanary) {
    req.canary = { matched: true, reason: 'percentage', percentage };
    return next();
  }

  // 4. 落选
  req.canary = { matched: false, reason: 'not_in_percentage', percentage };
  return res.status(404).json({ error: 'NOT_FOUND', message: 'v3 暂未开放' });
}

// 简单稳定哈希（同 key 同结果）
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}