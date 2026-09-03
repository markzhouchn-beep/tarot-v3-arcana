// web/src/screens/AuthSetPassword.tsx
// 验证码通过后 → 强制设密码（v3.0.1 C 方案）
// 创建：2026-09-04

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { authApi } from '../lib/api';

export default function AuthSetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tempToken = params.get('token') || '';
  const callbackUrl = params.get('callback') || '/dashboard';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (password.length < 8) { setError('密码至少 8 位'); return; }
    if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) { setError('密码须含数字和字母'); return; }
    if (password !== confirm) { setError('两次输入不一致'); return; }
    setLoading(true);
    setError(null);
    try {
      await authApi.setPassword(tempToken, password);
      navigate(callbackUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout size="sm">
      <ScreenHeader title="设置密码" />

      <div className="text-center mb-2xl mt-lg">
        <div className="caps text-fg-faint mb-xs">— One more step —</div>
        <h1 className="text-2xl text-gradient-gold mb-md">✦ 为账户设个密码</h1>
        <p className="text-sm text-fg-secondary font-body italic">
          下次直接用邮箱 + 密码登录，不用再看验证码
        </p>
      </div>

      <label className="caps block mb-xs text-fg-faint">新密码</label>
      <input
        type="password"
        className="input mb-md"
        placeholder="至少 8 位，含数字和字母"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="new-password"
        autoFocus
      />

      <label className="caps block mb-xs text-fg-faint">确认密码</label>
      <input
        type="password"
        className="input mb-md"
        placeholder="再输入一次"
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        autoComplete="new-password"
      />

      {error && (
        <div className="text-sm px-md py-sm mb-md border border-secondary/30 bg-secondary/5 text-secondary">
          {error}
        </div>
      )}

      <Button onClick={handleSubmit} loading={loading} fullWidth size="lg">
        完成 · 进入
      </Button>

      <div className="mt-xl text-center">
        <p className="text-xs text-fg-faint leading-relaxed">
          密码至少 8 位，须含数字和字母
        </p>
      </div>
    </Layout>
  );
}
