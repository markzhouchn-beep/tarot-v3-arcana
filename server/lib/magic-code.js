// server/lib/magic-code.js · ESM（v3.0.1）
// 验证码工具：生成 / 哈希 / 验证 / 限流
// 创建：2026-09-04
// Review fix：原子化 attempts + checkRateLimit 去 ip 参数

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const CODE_TTL_MIN = 10;
export const MAX_ATTEMPTS = 5;
export const HOURLY_LIMIT = 5;
const HASH_ROUNDS = 10;

/** 生成 6 位数字码 */
export function generateCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** 检查单邮箱 1 小时内发送次数（防刷）— Review 修复：去掉 ip 参数 */
export function checkRateLimit(db, email) {
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

/** 创建新码 */
export async function createCode(db, { email, type }) {
  const normalized = email.toLowerCase().trim();
  checkRateLimit(db, normalized);

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, HASH_ROUNDS);
  const expiresAt = Math.floor(Date.now() / 1000) + CODE_TTL_MIN * 60;

  db.prepare(`
    INSERT INTO magic_codes (email, code_hash, type, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(normalized, codeHash, type, expiresAt);

  return { code, expiresAt };
}

/** 验证码 — Review 修复：原子化 attempts 递增（防并发竞态） */
export async function verifyCode(db, { email, code, type }) {
  const normalized = email.toLowerCase().trim();
  const now = Math.floor(Date.now() / 1000);

  const row = db.prepare(`
    SELECT * FROM magic_codes
    WHERE email = ? AND type = ?
      AND used_at IS NULL AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(normalized, type, now);

  if (!row) {
    const err = new Error('验证码无效或已过期，请重新发送');
    err.statusCode = 400;
    throw err;
  }

  const ok = await bcrypt.compare(code, row.code_hash);

  if (!ok) {
    // 原子化：防止 5 个并发请求都过 SELECT 都看到 attempts=0
    const r = db.prepare(`
      UPDATE magic_codes SET attempts = attempts + 1
      WHERE id = ? AND attempts < ?
    `).run(row.id, MAX_ATTEMPTS);

    if (r.changes === 0) {
      // 已达上限 → 标记失效
      db.prepare(`UPDATE magic_codes SET used_at = ? WHERE id = ?`).run(now, row.id);
      const err = new Error('尝试次数过多，验证码已失效，请重新发送');
      err.statusCode = 429;
      throw err;
    }

    const err = new Error('验证码错误');
    err.statusCode = 400;
    throw err;
  }

  db.prepare(`UPDATE magic_codes SET used_at = ? WHERE id = ?`).run(now, row.id);
  return true;
}

/** 清空某邮箱所有未用码 */
export function invalidateAll(db, email) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE magic_codes SET used_at = ?
    WHERE email = ? AND used_at IS NULL
  `).run(now, email.toLowerCase().trim());
}
