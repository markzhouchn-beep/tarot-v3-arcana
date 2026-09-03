// server/lib/magic-code.js
// 验证码工具：生成 / 哈希 / 验证 / 限流
// 创建：2026-09-03（v3.0.1 C 方案）

const crypto = require('crypto');
const bcrypt = require('bcrypt');

const CODE_TTL_MIN = 10;             // 决策点 2：10 分钟有效
const MAX_ATTEMPTS = 5;              // 单条码最多试 5 次
const HOURLY_LIMIT = 5;              // 决策点 3：单邮箱 1 小时最多发 5 次
const HASH_ROUNDS = 10;              // bcrypt rounds（码短可用低 rounds）

/** 生成 6 位数字码 */
function generateCode() {
  // crypto.randomInt 避免 Math.random 的偏置
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** 检查单邮箱 1 小时内发送次数（防刷） */
function checkRateLimit(db, email) {
  const hourAgo = Math.floor(Date.now() / 1000) - 3600;
  const count = db.prepare(`
    SELECT COUNT(*) as n FROM magic_codes
    WHERE email = ? AND created_at > ?
  `).get(email.toLowerCase(), hourAgo).n;

  if (count >= HOURLY_LIMIT) {
    const err = new Error(`发送过于频繁，请 1 小时后再试（已用 ${count}/${HOURLY_LIMIT}）`);
    err.statusCode = 429;
    throw err;
  }
}

/** 创建新码（入库 + 限流检查） */
async function createCode(db, { email, type, ip }) {
  const normalized = email.toLowerCase().trim();
  checkRateLimit(db, normalized, ip);

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, HASH_ROUNDS);
  const expiresAt = Math.floor(Date.now() / 1000) + CODE_TTL_MIN * 60;

  db.prepare(`
    INSERT INTO magic_codes (email, code_hash, type, expires_at, ip)
    VALUES (?, ?, ?, ?, ?)
  `).run(normalized, codeHash, type, expiresAt, ip || null);

  return { code, expiresAt };   // 明文码只返一次（发邮件用）
}

/** 验证码（内部抛 400/429） */
async function verifyCode(db, { email, code, type }) {
  const normalized = email.toLowerCase().trim();

  const row = db.prepare(`
    SELECT * FROM magic_codes
    WHERE email = ?
      AND type = ?
      AND used_at IS NULL
      AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(normalized, type, Math.floor(Date.now() / 1000));

  if (!row) {
    const err = new Error('验证码无效或已过期，请重新发送');
    err.statusCode = 400;
    throw err;
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    db.prepare(`UPDATE magic_codes SET used_at = ? WHERE id = ?`)
      .run(Math.floor(Date.now() / 1000), row.id);
    const err = new Error('尝试次数过多，验证码已失效，请重新发送');
    err.statusCode = 429;
    throw err;
  }

  const ok = await bcrypt.compare(code, row.code_hash);

  if (!ok) {
    db.prepare(`UPDATE magic_codes SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
    const err = new Error('验证码错误');
    err.statusCode = 400;
    throw err;
  }

  db.prepare(`UPDATE magic_codes SET used_at = ? WHERE id = ?`)
    .run(Math.floor(Date.now() / 1000), row.id);

  return true;
}

/** 清空某邮箱所有未用码（重置密码成功后调用） */
function invalidateAll(db, email) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE magic_codes SET used_at = ?
    WHERE email = ? AND used_at IS NULL
  `).run(now, email.toLowerCase().trim());
}

module.exports = {
  generateCode,
  createCode,
  verifyCode,
  invalidateAll,
  CODE_TTL_MIN,
  HOURLY_LIMIT,
};
