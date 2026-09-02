import db from './db.js';

const row = db.prepare("SELECT interpretation FROM readings WHERE order_id='475cf523-2b34-4086-8266-0ce7181b8b4f'").get();
const text = row.interpretation;
const lines = text.split('\n');
for (let i = 0; i < Math.min(20, lines.length); i++) {
  const line = lines[i];
  const m1 = line.match(/^(I{1,3})\.\s*(.+)$/);
  const m2 = !m1 ? line.match(/^([一二三四五六七八九十])、\s*(.+)$/) : null;
  const m3 = !m1 && !m2 ? line.match(/^#{1,3}\s*(.+)$/) : null;
  if (m1 || m2 || m3) {
    const m = m1 || m2 || m3;
    console.log(`[${i}] ${m[0].slice(0,40)}`);
    console.log(`     m[1]:`, JSON.stringify(m[1]));
    console.log(`     m[2]:`, JSON.stringify(m[2]));
  }
}