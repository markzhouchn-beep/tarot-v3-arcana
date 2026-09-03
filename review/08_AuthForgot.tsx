// web/src/screens/AuthForgot.tsx
// 忘记密码：邮箱 → 验证码 → 新密码（一步到位）
// 创建：2026-09-03

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { authApi } from '../lib/api';

export default function AuthForgot() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async () => {
    if (!email.includes('@')) {
      setMessage({ type: 'error', text: '请输入有效邮箱' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await authApi.sendCode(email, 'reset');
      setMessage({
        type: 'success',
        text: res.dev_code
          ? `重置码已发送（开发模式：${res.dev_code}）`
          : `重置码已发送至 ${email}`,
      });
      setStep('reset');
      setResendIn(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const codeStr = code.join('');
    if (codeStr.length !== 6) {
      setMessage({ type: 'error', text: '请输入完整 6 位验证码' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: '新密码至少 8 位' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await authApi.resetPassword(email, codeStr, newPassword);
      setMessage({ type: 'success', text: res.message });
      setTimeout(() => navigate('/auth'), 1500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (idx: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(0, 1);
    const next = [...code];
    next[idx] = digit;
    setCode(next);
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  return (
    <Layout size="sm">
      <ScreenHeader back={step === 'email' ? '/auth' : undefined} title="重置密码" />

      <div className="text-center mb-2xl mt-lg">
        <h1 className="text-2xl text-gradient-gold mb-md">✦ 忘了密码？</h1>
        <p className="text-sm text-fg-secondary font-body italic">
          用邮箱接收重置码，立即设新密码
        </p>
      </div>

      {step === 'email' && (
        <>
          <label className="caps block mb-xs text-fg-faint">邮箱</label>
          <input
            type="email"
            className="input mb-md"
            placeholder="你注册时用的邮箱"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
          <Button onClick={sendCode} loading={loading} fullWidth size="lg">
            发送重置码
          </Button>
        </>
      )}

      {step === 'reset' && (
        <>
          <p className="text-sm text-fg-secondary mb-md">
            重置码已发到 <strong className="text-primary">{email}</strong>
          </p>

          <label className="caps block mb-sm text-fg-faint">6 位验证码</label>
          <div className="flex gap-xs justify-center mb-md">
            {code.map((c, i) => (
              <input
                key={i}
                ref={el => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={c}
                onChange={e => handleCodeChange(i, e.target.value)}
                className="input text-center text-2xl font-bold"
                style={{ width: '44px', height: '52px' }}
              />
            ))}
          </div>

          <label className="caps block mb-xs text-fg-faint mt-md">新密码</label>
          <input
            type="password"
            className="input mb-md"
            placeholder="至少 8 位，含数字和字母"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />

          <Button onClick={handleReset} loading={loading} fullWidth size="lg">
            重置密码
          </Button>

          <div className="mt-md text-center">
            <button
              onClick={sendCode}
              disabled={resendIn > 0 || loading}
              className={`text-xs ${resendIn > 0 ? 'text-fg-faint' : 'text-primary hover:text-primary-light'}`}
            >
              {resendIn > 0 ? `${resendIn}s 后重新发送` : '重新发送重置码'}
            </button>
          </div>
        </>
      )}

      {message && (
        <div
          className={`text-sm px-md py-sm mt-md border ${
            message.type === 'success'
              ? 'border-success/30 bg-success/5 text-success'
              : 'border-secondary/30 bg-secondary/5 text-secondary'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-xl text-center">
        <button
          onClick={() => navigate('/auth')}
          className="text-xs text-fg-faint hover:text-fg-secondary"
        >
          ← 返回登录
        </button>
      </div>
    </Layout>
  );
}
