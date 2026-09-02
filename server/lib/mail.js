// ============================================================
// lib/mail.js · 邮件发送（阿里云 SMTP）
// Phase 2 会员订阅 · 续费提醒
// 创建：2026-09-02
// ============================================================

import nodemailer from 'nodemailer';
import { config } from './config.js';

// 单例 transporter
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    console.warn('[mail] ⚠️ SMTP 未配置，邮件不会真实发出');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT || 465,
    secure: (config.SMTP_PORT || 465) === 465, // 465=SSL, 587=STARTTLS
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  return transporter;
}

/**
 * 发送邮件（通用接口）
 * @param {string} to - 收件人邮箱
 * @param {string} subject - 主题
 * @param {string} html - HTML 正文
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mail] 📧 模拟发送 → ${to} | ${subject}`);
    return { ok: true, mock: true };
  }

  try {
    await t.sendMail({
      from: config.SMTP_FROM || config.SMTP_USER,
      to,
      subject,
      html,
    });
    console.log(`[mail] ✅ 已发送 → ${to} | ${subject}`);
    return { ok: true };
  } catch (err) {
    console.error(`[mail] ❌ 发送失败 → ${to} | ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * 续费提醒邮件（7 / 3 / 1 天）
 */
export async function sendRenewalReminderEmail({ userEmail, userNickname, tier, expiresAt, daysLeft }) {
  const tierName = tier === 'gold' ? '金月会员' : '银月会员';
  const renewUrl = `${config.FRONTEND_URL}/membership`;

  const subject = daysLeft === 1
    ? `⏰ 您的 ${tierName}明天到期，请尽快续费`
    : `⏰ 您的 ${tierName}还有 ${daysLeft} 天到期`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5e6c8; color: #2a1f1a;">
      <h1 style="color: #8b2e2e; margin: 0 0 16px;">ARCANA · 星语塔罗</h1>
      <p>亲爱的 ${userNickname || '用户'}：</p>
      <p>您的 <strong>${tierName}</strong> 还有 <strong style="color: #8b2e2e;">${daysLeft} 天</strong>到期。</p>
      <p>到期时间：<code>${new Date(expiresAt).toLocaleString('zh-CN')}</code></p>
      <p>续费后您将继续享受：</p>
      <ul>
        ${tier === 'silver' ? `
          <li>主题五张牌阵（恋人十字 / 暗恋透视 / 职业十字）</li>
          <li>每日 15 次 Oracle 自由提问</li>
          <li>解读深度 ~1500 字</li>
        ` : `
          <li>全部牌阵（含凯尔特十字 10 张 / 七脉轮 7 张）</li>
          <li>每日 30 次 Oracle 自由提问</li>
          <li>解读深度 ~4000 字</li>
        `}
      </ul>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${renewUrl}" style="background: #8b2e2e; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          立即续费
        </a>
      </p>
      <p style="color: #6b5a4f; font-size: 12px; margin-top: 30px;">
        您的历史追问记录会一直保留，重新订阅后即可继续查看。<br>
        —— ARCANA · 星语塔罗
      </p>
    </div>
  `;

  return sendMail({ to: userEmail, subject, html });
}

/**
 * 订阅成功邮件（webhook 触发后立即发送）
 */
export async function sendSubscriptionSuccessEmail({ userEmail, userNickname, tier, expiresAt }) {
  const tierName = tier === 'gold' ? '金月会员' : '银月会员';
  const subject = `✨ 欢迎成为 ${tierName}`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5e6c8; color: #2a1f1a;">
      <h1 style="color: #8b2e2e; margin: 0 0 16px;">✨ 订阅成功</h1>
      <p>亲爱的 ${userNickname || '用户'}：</p>
      <p>欢迎成为 <strong>${tierName}</strong>！</p>
      <p>到期时间：<code>${new Date(expiresAt).toLocaleString('zh-CN')}</code></p>
      <p>现在您可以：</p>
      <ul>
        <li>解锁所有 ${tier === 'silver' ? '银月' : '金月'}专属牌阵</li>
        <li>每日 ${tier === 'silver' ? '15' : '30'} 次 Oracle 自由提问</li>
        <li>享受更长更深的 AI 解读</li>
      </ul>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${config.FRONTEND_URL}/spreads" style="background: #8b2e2e; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          立即探索
        </a>
      </p>
      <p style="color: #6b5a4f; font-size: 12px;">—— ARCANA · 星语塔罗</p>
    </div>
  `;

  return sendMail({ to: userEmail, subject, html });
}

export default { sendMail, sendRenewalReminderEmail, sendSubscriptionSuccessEmail };
