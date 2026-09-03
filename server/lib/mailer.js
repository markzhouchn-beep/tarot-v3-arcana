// ============================================================
// lib/mailer.js · 邮件发送（阿里云邮件推送）
// 沿用 v2.0 nodemailer 配置
// 创建：2026-09-01
// ============================================================

import nodemailer from 'nodemailer';
import { config } from './config.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.SMTP_HOST || !config.SMTP_USER) {
    console.warn('[mailer] SMTP 未配置，邮件将不会真实发送');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });
  console.log('[mailer] SMTP 初始化完成:', config.SMTP_HOST);
  return transporter;
}

/**
 * 发送 Magic Link 邮件
 */
export async function sendMagicLink({ email, magicUrl, purpose = 'login' }) {
  const t = getTransporter();
  const subjectMap = {
    login: '星语塔罗 · 登录链接',
    password_reset: '星语塔罗 · 重置密码',
    email_verify: '星语塔罗 · 验证邮箱',
  };
  const subject = subjectMap[purpose] || subjectMap.login;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #8B2E2E; font-family: 'Cormorant Garamond', serif;">星语塔罗</h2>
      <p>点击下方按钮${purpose === 'password_reset' ? '重置密码' : purpose === 'email_verify' ? '验证邮箱' : '登录'}：</p>
      <p style="margin: 32px 0;">
        <a href="${magicUrl}" style="background: #8B2E2E; color: #F5E6C8; padding: 12px 24px; text-decoration: none; border-radius: 2px; font-family: 'Cinzel', serif; letter-spacing: 0.1em;">
          ${purpose === 'password_reset' ? '重置密码' : purpose === 'email_verify' ? '验证邮箱' : '点击登录'}
        </a>
      </p>
      <p style="color: #6B5A4F; font-size: 12px;">${purpose === 'password_reset' ? '30 分钟' : '15 分钟'}内有效，逾期请重新申请。</p>
      <p style="color: #6B5A4F; font-size: 12px;">如果按钮无法点击，请复制链接：<br><a href="${magicUrl}">${magicUrl}</a></p>
    </div>
  `;

  if (!t) {
    console.log(`[mailer] [MOCK] ${subject} → ${email}: ${magicUrl}`);
    return { ok: true, mocked: true };
  }

  try {
    await t.sendMail({
      from: config.SMTP_FROM,
      to: email,
      subject,
      html,
    });
    console.log(`[mailer] sent: ${subject} → ${email}`);
    return { ok: true };
  } catch (err) {
    console.error(`[mailer] send failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * 发送订阅续费提醒
 * Phase 2 实现
 */
export async function sendRenewalReminder({ email, tier, daysLeft }) {
  // TODO Phase 2
  console.log(`[mailer] [TODO] sendRenewalReminder: ${email} (${tier}, ${daysLeft}d)`);
  return { ok: true, todo: true };
}

/**
 * 通用邮件发送（v3.0.1 C 方案新增）
 * body: { to, subject, html, text }
 */
export async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] [MOCK] ${subject} → ${to}`);
    return { ok: true, mocked: true };
  }
  try {
    await t.sendMail({
      from: config.SMTP_FROM,
      to, subject, html, text,
    });
    console.log(`[mailer] sent: ${subject} → ${to}`);
    return { ok: true };
  } catch (err) {
    console.error(`[mailer] send failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

export default { sendMagicLink, sendRenewalReminder, sendEmail };
