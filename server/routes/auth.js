// ============================================================
// routes/auth.js · 认证（Magic Link + 邮箱密码双轨）
// 创建：2026-09-01
// ============================================================

import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { config } from '../lib/config.js';
import { sendMagicLink, sendEmail } from '../lib/mailer.js';
import * as magicCode from '../lib/magic-code.js';
import { codeEmail } from '../lib/email-templates.js';
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

// ============================================================
// POST /api/auth/send-code · 发验证码（v3.0.1）
// ============================================================
router.post('/send-code', async (req, res) => {
  try {
    const { email, type = 'login' } = req.body || {};
    if (!email?.includes('@')) return res.status(400).json({ ok: false, message: '请输入有效邮箱' });
    if (!['login', 'reset'].includes(type)) return res.status(400).json({ ok: false, message: 'type 必须为 login 或 reset' });

    if (type === 'reset') {
      const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
      if (!u) return res.json({ ok: true, message: '如果该邮箱已注册，验证码已发送' });
    }

    const { code } = await magicCode.createCode(db, { email, type });
    const tpl = codeEmail({ code, ttlMin: magicCode.CODE_TTL_MIN, purpose: type });
    const isDev = process.env.NODE_ENV !== 'production';
    console.log(`[magic-code] email=${email} type=${type} code=${code}`);

    try {
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch (e) {
      console.error('[magic-code] email send failed:', e.message);
      if (!isDev) throw e;
    }

    res.json({
      ok: true,
      message: '验证码已发送，请查收邮箱',
      ttl_min: magicCode.CODE_TTL_MIN,
      ...(isDev ? { dev_code: code } : {}),
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, message: err.message });
  }
});

// ============================================================
// POST /api/auth/verify-code · 老用户有密码直接登录，否则返 temp_token
// Review Bug 1 修复
// ============================================================
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ ok: false, message: '邮箱和验证码必填' });

    await magicCode.verifyCode(db, { email, code, type: 'login' });

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    let isNewUser = false;
    if (!user) {
      const userId = crypto.randomUUID();
      const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      db.prepare(`
        INSERT INTO users (id, email, password_hash, tier, invite_code, created_at)
        VALUES (?, ?, NULL, 'registered', ?, ?)
      `).run(userId, email.toLowerCase(), inviteCode, Date.now());
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      isNewUser = true;
    }

    // Bug 1 修复：老用户已有密码 → 直接登录
    if (user.password_hash) {
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

      return res.json({
        ok: true,
        already_logged_in: true,
        is_new_user: false,
        has_password: true,
        user: { id: user.id, email: user.email, tier: user.tier, nickname: user.nickname },
        session_id: sessionId,
        message: '登录成功',
      });
    }

    // 新用户 / 老用户无密码 → 走 set-password
    const tempToken = crypto.randomBytes(32).toString('hex');
    const tempExpires = Date.now() + 10 * 60 * 1000;
    db.prepare(`
      INSERT INTO temp_tokens (token, user_id, purpose, expires_at)
      VALUES (?, ?, 'set-password', ?)
    `).run(tempToken, user.id, tempExpires);

    res.json({
      ok: true,
      already_logged_in: false,
      is_new_user: isNewUser,
      has_password: false,
      temp_token: tempToken,
      ttl_min: 10,
      message: isNewUser ? '验证成功！请设置你的密码以完成注册' : '验证成功！请设置密码',
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, message: err.message });
  }
});

// ============================================================
// POST /api/auth/set-password · temp_token → 自动登录
// ============================================================
router.post('/set-password', async (req, res) => {
  try {
    const { temp_token, password } = req.body || {};
    if (!temp_token || !password) return res.status(400).json({ ok: false, message: '参数缺失' });
    if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      return res.status(400).json({ ok: false, message: '密码至少 8 位，须含数字和字母' });
    }

    const row = db.prepare(`
      SELECT * FROM temp_tokens
      WHERE token = ? AND purpose = 'set-password' AND used_at IS NULL AND expires_at > ?
    `).get(temp_token, Date.now());
    if (!row) return res.status(400).json({ ok: false, message: '临时 token 无效或已过期，请重新验证' });

    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, row.user_id);
    db.prepare(`UPDATE temp_tokens SET used_at = ? WHERE token = ?`).run(Date.now(), temp_token);

    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + config.SESSION_TTL_DAYS * 24 * 3600 * 1000;
    db.prepare(`
      INSERT INTO sessions (id, user_id, ip, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, row.user_id, req.ip, req.headers['user-agent'] || '', expiresAt);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);

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
      message: '密码设置成功，已登录',
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ============================================================
// POST /api/auth/reset · 验证码 + 新密码 → 重置（不自动登录）
// Review 优化：reset 后清理 temp_tokens
// ============================================================
router.post('/reset', async (req, res) => {
  try {
    const { email, code, new_password } = req.body || {};
    if (!email || !code || !new_password) return res.status(400).json({ ok: false, message: '参数缺失' });
    if (new_password.length < 8 || !/\d/.test(new_password) || !/[a-zA-Z]/.test(new_password)) {
      return res.status(400).json({ ok: false, message: '密码至少 8 位，须含数字和字母' });
    }

    await magicCode.verifyCode(db, { email, code, type: 'reset' });

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(400).json({ ok: false, message: '用户不存在' });

    const passwordHash = await bcrypt.hash(new_password, 12);
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, user.id);

    magicCode.invalidateAll(db, email);
    db.prepare(`UPDATE temp_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL`)
      .run(Date.now(), user.id);

    res.json({ ok: true, message: '密码重置成功，请用新密码登录' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, message: err.message });
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
