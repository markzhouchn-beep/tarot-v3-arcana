// ============================================================
// db.js · SQLite 封装
// 沿用 v2.0 better-sqlite3 模式
// 创建：2026-09-01
// ============================================================

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './lib/config.js';

const dbPath = path.resolve(process.cwd(), config.DB_PATH);

// 自动创建 data 目录
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');       // WAL 模式（并发读写）
db.pragma('foreign_keys = ON');        // 外键约束
db.pragma('busy_timeout = 5000');      // 5 秒锁等待

console.log(`[db] connected: ${dbPath}`);

// v3.1 支付宝：自动给 orders 加 alipay_trade_no 字段（如没有）
try {
  db.exec(`ALTER TABLE orders ADD COLUMN alipay_trade_no VARCHAR(64)`);
} catch (e) {
  if (!e.message.includes('duplicate column') && !e.message.includes('no such table')) {
    console.warn('[db] ALTER TABLE orders (alipay_trade_no):', e.message);
  }
}

// v3.1 支付宝：自动给 orders 加 paid_amount 字段（如没有）
try {
  db.exec(`ALTER TABLE orders ADD COLUMN paid_amount DECIMAL(8,2)`);
} catch (e) {
  if (!e.message.includes('duplicate column') && !e.message.includes('no such table')) {
    console.warn('[db] ALTER TABLE orders (paid_amount):', e.message);
  }
}

/**
 * 事务包装器（用于需要原子操作的场景）
 * @param {Function} fn - 在事务中执行的函数
 * @example
 *   const txInsert = withTransaction(() => {
 *     db.prepare('INSERT...').run();
 *     db.prepare('UPDATE...').run();
 *   });
 */
export function withTransaction(fn) {
  return db.transaction(fn);
}

/**
 * SQLite 排他事务（webhook + 轮询防 race condition）
 * v0.8 Review 建议
 */
export function withExclusiveTransaction(fn) {
  return db.transaction(fn).exclusive;
}

export default db;
