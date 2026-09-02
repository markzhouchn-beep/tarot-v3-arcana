// ============================================================
// routes/auth.js · 认证（Magic Link + 邮箱密码双轨）
// 创建：2026-09-01
// ============================================================

import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { config } from '../lib/config.js';
import { sendMagicLink } from '../lib/mailer.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import {
  findInviterByCode, linkInviteAndGrantRewards,
} from '../lib/invite.js';

const router = Router();

/**
 * POST /api/auth/magic-link
 * 申请 Magic Link（登录 / 重置密码 / 验证邮箱）
 */
router.post('/magic-link', async (req, res) => {
  try {
    const { email, purpose = 'login', invite_code } = req.body || {};
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'INVALID_EMAIL' });
    }

    // 防垃圾：同 IP 1 分钟内最多 1 次（占位）
    // TODO Phase 1: 加 IP 限频

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + (purpose === 'password_reset' ? 30 * 60 * 1000 : 15 * 60 * 1000);

    db.prepare(`
      INSERT INTO magic_links (id, email, token, purpose, expires_at, ip, invite_code)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), email, token, purpose, expiresAt, req.ip, invite_code || null);

    const magicUrl = `${config.FRONTEND_URL}/auth/callback?token=${token}&purpose=${purpose}${invite_code ? `&invite_code=${encodeURIComponent(invite_code)}` : ''}`;

    const result = await sendMagicLink({ email, magicUrl, purpose });

    res.json({
      ok: true,
      // 开发模式返 URL，生产模式不返
      magic_url: config.NODE_ENV === 'development' ? magicUrl : undefined,
      mail: result,
    });
  } catch (err) {
    console.error('[auth] magic-link error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/auth/verify?token=xxx&purpose=login
 * 验证 Magic Link → 创建 session
 */
router.get('/verify', (req, res) => {
  try {
    const { token, purpose = 'login' } = req.query;

    const link = db.prepare(`
      SELECT * FROM magic_links WHERE token = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?
    `).get(token, purpose, Date.now());

    if (!link) {
      return res.status(400).json({ error: 'INVALID_OR_EXPIRED_TOKEN' });
    }

    // 标记使用
    db.prepare(`UPDATE magic_links SET used_at = ? WHERE id = ?`).run(Date.now(), link.id);

    // 查找或创建用户
    let user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(link.email);
    if (!user) {
      const userId = crypto.randomUUID();
      const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      db.prepare(`
        INSERT INTO users (id, email, tier, invite_code, email_verified, email_verified_at, created_at)
        VALUES (?, ?, 'registered', ?, 1, ?, ?)
      `).run(userId, link.email, inviteCode, Date.now(), Date.now());

      // Phase 4: 如果有邀请码（存于 magic_links 表），事务内关联邀请 + 发奖
      // 以 magic_links 记录为准（更可靠，不依赖 query string）
      const inviteCodeFromQuery = link.invite_code || req.query.invite_code;
      if (inviteCodeFromQuery) {
        const inviter = findInviterByCode(inviteCodeFromQuery);
        if (inviter) {
          const deviceId = req.headers['x-device-id'] || null;
          const ip = req.ip || null;
          linkInviteAndGrantRewards({
            inviterUserId: inviter.id,
            inviteeUserId: userId,
            inviteCode: inviteCodeFromQuery,
            inviteeEmail: link.email,
            deviceId,
            ip,
            skipSpamCheck: true,  // verify 路径已有邮箱验证，防刷不该拦
          });
        }
      }

      user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId);
    } else if (purpose === 'email_verify') {
      db.prepare(`UPDATE users SET email_verified = 1, email_verified_at = ? WHERE id = ?`).run(Date.now(), user.id);
    }

    // 创建 session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + config.SESSION_TTL_DAYS * 24 * 3600 * 1000;

    db.prepare(`
      INSERT INTO sessions (id, user_id, ip, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, user.id, req.ip, req.headers['user-agent'] || '', expiresAt);

    // Set-Cookie
    res.cookie(config.SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: config.SESSION_TTL_DAYS * 24 * 3600 * 1000,
    });

    res.json({
      ok: true,
      user: { id: user.id, email: user.email, tier: user.tier, nickname: user.nickname },
      session_id: sessionId,
    });
  } catch (err) {
    console.error('[auth] verify error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/auth/register
 * 邮箱密码注册
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, invite_code } = req.body || {};
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'INVALID_EMAIL' });
    }
    if (!password || password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: '密码至少 8 位，含数字和字母' });
    }

    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existing) {
      return res.status(409).json({ error: 'EMAIL_EXISTS', message: '该邮箱已注册' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, tier, invite_code, email_verified, created_at)
      VALUES (?, ?, ?, 'registered', ?, 0, ?)
    `).run(userId, email, passwordHash, inviteCode, Date.now());

    // Phase 4: 邮箱密码注册时事务内关联邀请 + 发奖（不依赖 verify）
    if (invite_code) {
      const inviter = findInviterByCode(invite_code);
      if (inviter) {
        const deviceId = req.headers['x-device-id'] || null;
        const ip = req.ip || null;
        const inviteResult = linkInviteAndGrantRewards({
          inviterUserId: inviter.id,
          inviteeUserId: userId,
          inviteCode: invite_code,
          inviteeEmail: email,
          deviceId,
          ip,
        });
        if (!inviteResult) {
          console.warn(`[auth] register: invite link failed (antispam or self) for ${email} code=${invite_code}`);
        }
      }
    }

    // 发验证邮件
    // TODO Phase 1: 发 Magic Link (purpose=email_verify)

    res.json({
      ok: true,
      user: { id: userId, email, tier: 'registered', email_verified: false, invite_code: inviteCode },
      message: '请查收邮件验证邮箱',
    });
  } catch (err) {
    console.error('[auth] register error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/auth/login
 * 邮箱密码登录
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'MISSING_FIELDS' });
    }

    const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    // 检查锁定
    if (user.locked_until && user.locked_until > Date.now()) {
      return res.status(423).json({
        error: 'ACCOUNT_LOCKED',
        message: `账户已锁定，请 ${Math.ceil((user.locked_until - Date.now()) / 60000)} 分钟后重试`,
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      // 错误次数 +1
      const newCount = (user.failed_login_count || 0) + 1;
      const lockedUntil = newCount >= 5 ? Date.now() + 15 * 60 * 1000 : null;
      db.prepare(`
        UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?
      `).run(newCount, lockedUntil, user.id);

      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        remaining: Math.max(0, 5 - newCount),
      });
    }

    // 成功 → 清错误次数
    db.prepare(`
      UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, last_login_ip = ? WHERE id = ?
    `).run(Date.now(), req.ip, user.id);

    // 创建 session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + config.SESSION_TTL_DAYS * 24 * 3600 * 1000;

    db.prepare(`
      INSERT INTO sessions (id, user_id, ip, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, user.id, req.ip, req.headers['user-agent'] || '', expiresAt);

    res.cookie(config.SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: config.SESSION_TTL_DAYS * 24 * 3600 * 1000,
    });

    res.json({
      ok: true,
      user: { id: user.id, email: user.email, tier: user.tier, nickname: user.nickname, invite_code: user.invite_code },
      session_id: sessionId,
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  const sessionId = req.cookies?.[config.SESSION_COOKIE_NAME];
  if (sessionId) {
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
  }
  res.clearCookie(config.SESSION_COOKIE_NAME);
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * 当前用户信息
 */
router.get('/me', optionalAuth, (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  res.json({ user: req.user });
});

export default router;
