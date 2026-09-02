// ============================================================
// lib/scheduler.js · 会员订阅定时任务
// Phase 2 会员订阅 · 过期降级 + 续费提醒
// 创建：2026-09-02
//
// 三个任务：
// 1. expireDueSubscriptions() — 每日扫描过期订阅，标记 expired + 降级 tier
// 2. sendRenewalReminders() — 每日扫描到期前 7/3/1 天订阅，发邮件
// 3. runDailyJobs() — 把上面两个包成每日执行入口（默认每天 02:00）
// ============================================================

import db from '../db.js';
import { expireDueSubscriptions } from '../routes/membership.js';
import { sendRenewalReminderEmail } from './mail.js';

// AI 成本告警阈值（可被 env 覆盖）
const AI_COST_DAILY_LIMIT = parseFloat(process.env.AI_COST_DAILY_LIMIT || '50'); // ¥50/天
const AI_USER_DAILY_LIMIT = parseInt(process.env.AI_USER_DAILY_LIMIT || '100');  // 100 次/天/用户

/**
 * AI 成本监控 + 异常用户告警（Phase 6）
 * 1. 今日 AI 成本超过阈值 → 告警
 * 2. 单用户单日调用次数超过阈值 → 告警
 */
export async function monitorAICost() {
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(today).getTime();

  // 今日总成本
  const totalCost = db.prepare(`
    SELECT COUNT(*) AS calls, COALESCE(SUM(cost_cny), 0) AS cost
    FROM oracle_messages
    WHERE created_at > ?
  `).get(todayStart);

  const alerts = [];

  if ((totalCost?.cost || 0) > AI_COST_DAILY_LIMIT) {
    alerts.push({
      level: 'critical',
      type: 'ai_cost_daily_exceeded',
      message: `今日 AI 成本 ¥${(totalCost.cost || 0).toFixed(2)} 超阈值 ¥${AI_COST_DAILY_LIMIT}`,
      data: totalCost,
    });
  }

  // 异常用户（oracle_messages 表无 user_id 列，靠 JOIN oracle_sessions）
  const abnormalUsers = db.prepare(`
    SELECT s.user_id, COUNT(*) AS calls, COALESCE(SUM(m.cost_cny), 0) AS cost
    FROM oracle_messages m
    JOIN oracle_sessions s ON s.id = m.session_id
    WHERE m.created_at > ?
    GROUP BY s.user_id
    HAVING calls > ?
  `).all(todayStart, AI_USER_DAILY_LIMIT);

  for (const u of abnormalUsers) {
    alerts.push({
      level: 'warning',
      type: 'user_abnormal_usage',
      message: `用户 ${u.user_id} 今日调用 ${u.calls} 次（阈值 ${AI_USER_DAILY_LIMIT}）`,
      data: u,
    });
  }

  if (alerts.length > 0) {
    console.warn(`[scheduler] 🚨 AI 监控告警：${alerts.length} 条`);
    for (const a of alerts) {
      console.warn(`  [${a.level}] ${a.message}`);
    }
    // TODO Phase 6 部署后：接入钉钉/邮件/企业微信告警
  }

  return { total_cost: totalCost?.cost || 0, total_calls: totalCost?.calls || 0, alerts };
}

/**
 * 发送续费提醒邮件（7 / 3 / 1 天）
 * 写 renewal_reminded 字段防重复
 */
export async function sendRenewalReminders() {
  const now = Date.now();
  const oneDay = 24 * 3600 * 1000;

  // 三个时间点：7 / 3 / 1 天后到期
  // renewal_reminded: 0=未提醒 / 1=已发 7 天 / 2=已发 3 天 / 3=已发 1 天
  const checkpoints = [
    { days: 7, min: 6 * oneDay, max: 8 * oneDay, minFlag: 0 },
    { days: 3, min: 2 * oneDay, max: 4 * oneDay, minFlag: 1 },
    { days: 1, min: 0, max: 2 * oneDay, minFlag: 2 },
  ];

  let sent = 0;

  for (const cp of checkpoints) {
    // 找出到期时间在 (now+min, now+max] 范围内，且 reminder 状态 < 该档位 的订阅
    const subs = db.prepare(`
      SELECT s.*, u.email AS user_email, u.nickname AS user_nickname
      FROM user_subscriptions s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'active'
        AND s.expires_at > ?
        AND s.expires_at <= ?
        AND (s.renewal_reminded IS NULL OR s.renewal_reminded < ?)
    `).all(now + cp.min, now + cp.max, cp.minFlag);

    for (const sub of subs) {
      if (!sub.user_email) continue; // 没邮箱不发

      const result = await sendRenewalReminderEmail({
        userEmail: sub.user_email,
        userNickname: sub.user_nickname,
        tier: sub.tier,
        expiresAt: sub.expires_at,
        daysLeft: cp.days,
      });

      if (result.ok) {
        // 标记 reminder 状态（升级到当前档位）
        const newFlag = cp.minFlag + 1;
        db.prepare(`UPDATE user_subscriptions SET renewal_reminded = ? WHERE id = ?`).run(newFlag, sub.id);
        sent++;
      }
    }
  }

  return { sent };
}

/**
 * 每日任务入口
 */
export function runDailyJobs() {
  console.log('[scheduler] 🕐 运行每日任务...');
  const expireResult = expireDueSubscriptions();
  console.log(`[scheduler] 过期降级: ${expireResult.expired} 个订阅`);

  sendRenewalReminders()
    .then((r) => console.log(`[scheduler] 续费提醒: ${r.sent} 封邮件`))
    .catch((err) => console.error('[scheduler] 续费提醒失败:', err));

  // Phase 6: AI 成本监控
  monitorAICost()
    .then((r) => console.log(`[scheduler] AI 监控: ¥${r.total_cost.toFixed(2)} / ${r.total_calls} calls / ${r.alerts.length} alerts`))
    .catch((err) => console.error('[scheduler] AI 监控失败:', err));
}

/**
 * 计算到下一个指定时点的毫秒数
 * @param {number} targetHour - 本地时区小时（0-23）
 * @param {number} targetMinute - 分钟（0-59）
 */
function msUntilNext(targetHour, targetMinute) {
  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    targetHour,
    targetMinute,
    0,
    0,
  );
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

/**
 * 启动每日准点定时任务（每天 02:00 准点触发）
 * 使用 self-reschedule 模式：setTimeout 到下一个 02:00 → 跑任务 → 重新计时
 * 避免 setInterval 24h 造成的时间漂移
 */
export function startDailyScheduler() {
  if (process.env.NODE_ENV === 'test') return;

  // 启动 5s 后跑一次启动检查（避免阻塞启动）
  setTimeout(() => {
    try {
      runDailyJobs();
    } catch (err) {
      console.error('[scheduler] 启动时跑任务失败:', err);
    }
  }, 5000);

  const scheduleNext = () => {
    const ms = msUntilNext(2, 0); // 每天 02:00 准点
    console.log(`[scheduler] 下次任务：${new Date(Date.now() + ms).toLocaleString('zh-CN')}`);
    setTimeout(() => {
      try {
        runDailyJobs();
      } catch (err) {
        console.error('[scheduler] 定时任务失败:', err);
      } finally {
        scheduleNext(); // 重新调度
      }
    }, ms);
  };
  scheduleNext();

  console.log('[scheduler] ✅ 已启动（启动时跑一次 + 每日 02:00 准点）');
}

export default { runDailyJobs, sendRenewalReminders, startDailyScheduler, monitorAICost };
