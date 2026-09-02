import * as m from './lib/afdian.js';
import 'dotenv/config';

for (let page = 1; page <= 5; page++) {
  const params = JSON.stringify({ page, per_page: 50 });
  const ts = Math.floor(Date.now() / 1000).toString();
  const sign = m.signPayload(params, ts, process.env.AFDIAN_USER_ID, process.env.AFDIAN_TOKEN);

  const res = await fetch('https://ifdian.net/api/open/query-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: process.env.AFDIAN_USER_ID, params, ts, sign }),
  });
  const j = await res.json();
  console.log(`--- page ${page} ---`);
  console.log('  ec:', j.ec, 'em:', j.em);
  if (j.data?.orders?.length > 0) {
    console.log('  订单数:', j.data.orders.length);
    j.data.orders.forEach((o) => {
      const t = new Date(o.create_time * 1000).toISOString();
      console.log(`  - ${t} | ${o.out_trade_no} | ¥${o.total_amount} | ${o.title} | status=${o.status} | plan_id=${o.plan_id || '-'} | remark=${o.remark || '无'}`);
    });
    break;
  }
}