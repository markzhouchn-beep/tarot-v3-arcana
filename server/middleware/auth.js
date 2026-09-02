// ============================================================
// middleware/auth.js · 认证中间件
// Magic Link + 邮箱密码双轨
// 创建：2026-09-01
// ============================================================

import db from '../db.js';
import { config } from '../lib/config.js';
import bcrypt from 'bcryptjs';

/**
 * 必需登录中间件
 * 用法：router.get('/protected', requireAuth, handler)
 */
export function requireAuth(req, res, next) {
  const sessionId = req.cookies?.[config.SESSION_COOKIE_NAME]
    || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!sessionId) {
    return res.status(401).json({ error: 'LOGIN_REQUIRED', message: '请先登录' });
  }

  const session = db.prepare(`
    SELECT s.*, u.email, u.tier
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, Date.now());

  if (!session) {
    return res.status(401).json({ error: 'SESSION_EXPIRED', message: '会话已过期，请重新登录' });
  }

  // 滑动续期（每 24h 续一次）
  db.prepare(`UPDATE sessions SET last_used_at = ? WHERE id = ?`).run(Date.now(), sessionId);

  // 查完整用户信息（包含 invite_code / nickname 等）
const fullUser = db.prepare(`SELECT id, email, tier, nickname, invite_code, email_verified FROM users WHERE id = ?`).get(session.user_id);
req.user = fullUser || {
  id: session.user_id,
  email: session.email,
  tier: session.tier,
};
next();
}

/**
 * 可选登录中间件（访客 + 注册都能访问，登录后从 session 拿用户）
 */
export function optionalAuth(req, res, next) {
  const sessionId = req.cookies?.[config.SESSION_COOKIE_NAME]
    || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (sessionId) {
    const session = db.prepare(`
      SELECT s.*, u.email, u.tier
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?
    `).get(sessionId, Date.now());

    if (session) {
      // 查完整用户信息（包含 invite_code / nickname 等）
      const fullUser = db.prepare(`SELECT id, email, tier, nickname, invite_code, email_verified FROM users WHERE id = ?`).get(session.user_id);
      req.user = fullUser || {
        id: session.user_id,
        email: session.email,
        tier: session.tier,
      };
    }
  }
  next();
}

/**
 * 必需管理员中间件
 * Phase 5 完整：Basic Auth + bcrypt hash 校验
 * env: ADMIN_USERNAME=mark  ADMIN_PASSWORD_HASH=bcrypt($your_password)
 * dev fallback: env 未设则接受 mark/DevAdmin2026（仅限 dev 环境）
 */
export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="ARCANA Admin"');
    return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' });
  }

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  const colonIdx = decoded.indexOf(':');
  if (colonIdx < 0) return res.status(401).json({ error: 'ADMIN_AUTH_FAILED' });
  const user = decoded.slice(0, colonIdx);
  const pass = decoded.slice(colonIdx + 1);

  // 1. 用户名不匹配
  if (user !== config.ADMIN_USERNAME) {
    return res.status(401).json({ error: 'ADMIN_AUTH_FAILED' });
  }

  // 2. 优先用 hash 验证
  const hash = config.ADMIN_PASSWORD_HASH;
  if (hash && hash.startsWith('$2')) {
    // bcrypt hash（顶部 import，不用函数内 require）
    if (!bcrypt.compareSync(pass, hash)) {
      return res.status(401).json({ error: 'ADMIN_AUTH_FAILED' });
    }
  } else if (config.NODE_ENV !== 'production') {
    // dev fallback（仅本地 dev 用，生产环境必须设 ADMIN_PASSWORD_HASH）
    const DEV_PASSWORD = 'DevAdmin2026';
    if (pass !== DEV_PASSWORD) {
      return res.status(401).json({ error: 'ADMIN_AUTH_FAILED' });
    }
  } else {
    // 生产环境必须设 hash
    return res.status(500).json({ error: 'ADMIN_NOT_CONFIGURED', message: '生产环境必须配置 ADMIN_PASSWORD_HASH' });
  }

  req.admin = { username: user };
  next();
}

export default { requireAuth, optionalAuth, requireAdmin };
