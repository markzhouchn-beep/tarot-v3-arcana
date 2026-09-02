// 手动 reconcile 工具：把小号爱发电的订单手动注入 v3.0 DB
// 用法：node scripts/manual_reconcile.mjs <user_uuid> <plan_id> <order_no> <amount>

import * as db from './db.js';
import { activateSubscription } from './routes/membership.js';
import 'dotenv/config';

const [userId, planId, outTradeNo, amountStr] = process.argv.slice(2);

if (!userId || !planId || !outTradeNo || !amountStr) {
  console.error('用法: node manual_reconcile.mjs <user_uuid> <plan_id:AFDIAN_PLAN_xxx> <out_trade_no> <amount>');
  process.exit(1);
}

const amount = parseFloat(amountStr);
const payMonth = planId.includes('yearly') ? 12 : 1;

console.log(`🔧 手动 reconcile:`);
console.log(`  user: ${userId}`);
console.log(`  plan: ${planId}`);
console.log(`  out_trade_no: ${outTradeNo}`);
console.log(`  amount: ¥${amount}`);
console.log(`  pay_month: ${payMonth}`);
console.log('');

const result = await activateSubscription({
  userId,
  planId,
  outTradeNo,
  amount,
  payMonth,
});

if (result.ok) {
  console.log(`✅ 订阅激活成功`);
  console.log(`  sub_id: ${result.subId}`);
  console.log(`  expires_at: ${new Date(result.expiresAt).toISOString()}`);
  console.log(`  旧订阅过期数: ${result.expiredOld || 0}`);
} else {
  console.error(`❌ 失败: ${result.error}`);
  process.exit(1);
}