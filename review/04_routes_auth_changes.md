# server/routes/auth.js 改动说明

## 改动 1：文件顶部追加 import

```js
const magicCode = require('../lib/magic-code');
const { codeEmail } = require('../lib/email-templates');
const { sendEmail } = require('../lib/email');   // 已有 email 发送模块
const cryptoRandomToken = () => crypto.randomBytes(32).toString('hex');
```

## 改动 2：在 router.post('/logout', ...) 之前，插入以下 4 个新 endpoint

```js
// ============================================================
// POST /api/auth/send-code · 发验证码
// body: { email, type: 'login' | 'reset' }
// ============================================================
router.post('/send-code', async (req, res) => {
  try {
    const { email, type = 'login' } = req.body || {};
    if (!email?.includes('@')) return res.status(400).json({ ok: false, message: '请输入有效邮箱' });
    if (!['login', 'reset'].includes(type)) return res.status(400).json({ ok: false, message: 'type 必须为 login 或 reset' });

    // 防枚举：reset 时若用户不存在也返 ok
    if (type === 'reset') {
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
      if (!user) return res.json({ ok: true, message: '如果该邮箱已注册，验证码已发送' });
    }

    const { code, expiresAt } = await magicCode.createCode(db, { email, type, ip: req.ip });
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
// POST /api/auth/verify-code · 验证 → 创建/查找用户 → 返 temp_token
// body: { email, code }
// ============================================================
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ ok: false, message: '邮箱和验证码必填' });

    await magicCode.verifyCode(db, { email, code, type: 'login' });

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    let isNewUser = false;
    if (!user) {
      const userId = 'u_' + crypto.randomBytes(8).toString('hex');
      const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      db.prepare(`
        INSERT INTO users (id, email, password_hash, tier, invite_code, created_at)
        VALUES (?, ?, NULL, 'registered', ?, ?)
      `).run(userId, email.toLowerCase(), inviteCode, Math.floor(Date.now() / 1000));
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      isNewUser = true;
    }

    const tempToken = cryptoRandomToken();
    const tempExpires = Math.floor(Date.now() / 1000) + 10 * 60;
    db.prepare(`INSERT INTO temp_tokens (token, user_id, purpose, expires_at) VALUES (?, ?, 'set-password', ?)`)
      .run(tempToken, user.id, tempExpires);

    res.json({
      ok: true,
      is_new_user: isNewUser,
      has_password: !!user.password_hash,
      temp_token: tempToken,
      ttl_min: 10,
      message: isNewUser ? '验证成功！请设置你的密码以完成注册' : '验证成功',
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, message: err.message });
  }
});

// ============================================================
// POST /api/auth/set-password · 写密码 + 自动登录
// body: { temp_token, password }
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
    `).get(temp_token, Math.floor(Date.now() / 1000));
    if (!row) return res.status(400).json({ ok: false, message: '临时 token 无效或已过期，请重新验证' });

    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, row.user_id);
    db.prepare(`UPDATE temp_tokens SET used_at = ? WHERE token = ?`)
      .run(Math.floor(Date.now() / 1000), temp_token);

    // 创建正式 session（60 天）
    const sessionId = cryptoRandomToken();
    const sessionExpires = Math.floor(Date.now() / 1000) + 60 * 24 * 3600;
    db.prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
      .run(sessionId, row.user_id, sessionExpires, Math.floor(Date.now() / 1000));

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
    res.setHeader('Set-Cookie',
      `arcana_session=${sessionId}; Max-Age=${60 * 24 * 3600}; Path=/; HttpOnly; Secure; SameSite=Strict`);
    res.json({ ok: true, user: publicUser(user), session_id: sessionId, message: '密码设置成功，已登录' });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ============================================================
// POST /api/auth/reset · 重置密码（不自动登录）
// body: { email, code, new_password }
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

    const passwordHash = await bcrypt.hash(new_password, 10);
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, user.id);
    magicCode.invalidateAll(db, email);

    res.json({ ok: true, message: '密码重置成功，请用新密码登录' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, message: err.message });
  }
});
```

## 决策点 4：旧路由处理

**保留** `/auth/magic-link` 不动，加一行注释标 deprecated：

```js
// ⚠️ DEPRECATED 2026-09-03：v3.0.1 C 方案上线后保留 30 天兜底，2026-10-03 删除
router.post('/magic-link', async (req, res) => { ... });
```
