// server/lib/email-templates.js
// 验证码邮件模板（阿里云 SMTP）
// 创建：2026-09-03（v3.0.1 C 方案）

const BRAND = 'ARCANA ai · 星语塔罗';

function codeEmail({ code, ttlMin = 10, purpose = 'login' }) {
  const subjectMap = {
    login:  `[${BRAND}] 你的登录验证码`,
    reset:  `[${BRAND}] 重置密码验证码`,
  };

  const greeting = purpose === 'reset'
    ? '你正在重置 ARCANA ai 账户密码'
    : '你正在登录 ARCANA ai';

  return {
    subject: subjectMap[purpose] || subjectMap.login,
    html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0f;color:#e8e6df">
  <div style="text-align:center;margin-bottom:24px">
    <h1 style="color:#d4af37;font-size:24px;margin:0">✦ ${BRAND}</h1>
  </div>

  <p style="font-size:14px;color:#a8a39a">${greeting}</p>

  <div style="background:#14141a;border:1px solid #d4af37;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
    <div style="color:#a8a39a;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:8px">— 你的验证码 —</div>
    <div style="font-size:36px;letter-spacing:0.3em;color:#d4af37;font-weight:bold;font-family:'SF Mono',Menlo,monospace">${code}</div>
    <div style="color:#7a7670;font-size:11px;margin-top:12px">${ttlMin} 分钟内有效 · 切勿泄露给他人</div>
  </div>

  <p style="font-size:13px;color:#a8a39a;line-height:1.6">
    请在打开的网页中输入此验证码完成${purpose === 'reset' ? '密码重置' : '登录'}。
    如果你没有请求此验证码，请忽略本邮件。
  </p>

  <hr style="border:none;border-top:1px solid #2a2a35;margin:24px 0">

  <p style="font-size:11px;color:#7a7670;text-align:center">
    © ARCANA ai · 这是系统邮件，请勿直接回复
  </p>
</body></html>`,
    text: `${greeting}\n\n你的验证码：${code}\n${ttlMin} 分钟内有效。\n\n如非本人操作请忽略。`,
  };
}

module.exports = { codeEmail };
