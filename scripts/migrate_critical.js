// 阶段一修复 · 幂等 migration 脚本（2026-09-21）
// 跳过已存在的列，逐个 ADD COLUMN

const Database = require('better-sqlite3');
const db = new Database('./data/tarot_v3.db');

const targets = [
  { table: 'orders', col: 'refunded_at', type: 'BIGINT' },
  { table: 'orders', col: 'refund_reason', type: 'TEXT' },
  { table: 'oracle_audit_log', col: 'resolved', type: 'INT DEFAULT 0' },
  { table: 'oracle_audit_log', col: 'resolved_at', type: 'BIGINT' },
];

for (const t of targets) {
  const exists = db.prepare(`SELECT 1 FROM pragma_table_info(${t.table}) WHERE name=?`).get(t.col);
  if (exists) {
    console.log(`⏭ skip ${t.table}.${t.col} (exists)`);
  } else {
    try {
      db.exec(`ALTER TABLE ${t.table} ADD COLUMN ${t.col} ${t.type}`);
      console.log(`✅ added ${t.table}.${t.col}`);
    } catch (err) {
      console.error(`❌ ${t.table}.${t.col}: ${err.message}`);
    }
  }
}

try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_audit_resolved ON oracle_audit_log(resolved, resolved_at)');
  console.log('✅ index idx_audit_resolved OK');
} catch (err) {
  console.error('❌ index error:', err.message);
}

db.close();