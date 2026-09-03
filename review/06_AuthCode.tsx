// web/src/screens/AuthCode.tsx
// 验证码登录/注册（替代 magic link）
// 创建：2026-09-03

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { authApi } from '../lib/api';

type Step = 'email' | 'code';

export default function AuthCode() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const callbackUrl = params.get('callback') || '/dashboard';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
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
      const res = await authApi.sendCode(email, 'login');
      setMessage({
        type: 'success',
        text: res.dev_code
          ? `验证码已发送（开发模式：${res.dev_code}）`
          : `验证码已发送至 ${email}，${res.ttl_min} 分钟内有效`,
      });
      setStep('code');
      setResendIn(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    const codeStr = code.join('');
    if (codeStr.length !== 6) {
      setMessage({ type: 'error', text: '请输入完整 6 位验证码' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await authApi.verifyCode(email, codeStr);
      // 跳转到 set-password 页面（带 temp_token）
      navigate(`/auth/set-password?token=${encodeURIComponent(res.temp_token)}&callback=${encodeURIComponent(callbackUrl)}`);
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

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setCode(text.split(''));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  return (
    <Layout size="sm">
      <ScreenHeader back={step === 'code' ? undefined : '/auth'} title="验证码登录" />

      <div className="text-center mb-2xl mt-lg">
        <div className="caps text-fg-faint mb-xs">— Sign in with code —</div>
        <h1 className="text-2xl text-gradient-gold mb-md">✦ ARCANA ai</h1>
      </div>

      {step === 'email' && (
        <>
          <label className="caps block mb-xs text-fg-faint">邮箱</label>
          <input
            type="email"
            className="input mb-md"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
          <Button onClick={sendCode} loading={loading} fullWidth size="lg">
            发送验证码
          </Button>
        </>
      )}

      {step === 'code' && (
        <>
          <p className="text-sm text-fg-secondary text-center mb-lg">
            验证码已发送到 <strong className="text-primary">{email}</strong>
          </p>

          <label className="caps block mb-sm text-fg-faint">输入 6 位验证码</label>
          <div className="flex gap-xs justify-center mb-lg" onPaste={handlePaste}>
            {code.map((c, i) => (
              <input
                key={i}
                ref={el => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={c}
                onChange={e => handleCodeChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="input text-center text-2xl font-bold"
                style={{ width: '48px', height: '56px' }}
              />
            ))}
          </div>

          <Button onClick={verifyCode} loading={loading} fullWidth size="lg">
            下一步
          </Button>

          <div className="mt-md text-center">
            <button
              onClick={sendCode}
              disabled={resendIn > 0 || loading}
              className={`text-xs ${resendIn > 0 ? 'text-fg-faint' : 'text-primary hover:text-primary-light'}`}
            >
              {resendIn > 0 ? `${resendIn}s 后可重新发送` : '重新发送验证码'}
            </button>
          </div>

          <div className="mt-sm text-center">
            <button
              onClick={() => { setStep('email'); setCode(['', '', '', '', '', '']); }}
              className="text-xs text-fg-faint hover:text-fg-secondary"
            >
              换邮箱
            </button>
          </div>
        </>
      )}

      {message && (
        <div
          className={`text-sm px-md py-sm mt-md border ${
            message.type === 'success'
              ? 'border-success/30 bg-success/5 text-success'
              : message.type === 'info'
                ? 'border-primary/30 bg-primary/5 text-primary'
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
          ← 返回邮箱密码登录
        </button>
      </div>
    </Layout>
  );
}
