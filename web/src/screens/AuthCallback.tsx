// ============================================================
// screens/AuthCallback.tsx · 魔法链接回调页
// 处理 /auth/callback?token=***&purpose=login[&invite=ABC]
// 调 authApi.verify → 设 cookie → 跳转 dashboard
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { authApi } from '../lib/api';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const purpose = params.get('purpose') || 'login';
  const inviteCode = params.get('invite') || undefined;

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('链接无效：缺少验证令牌');
      return;
    }

    let cancelled = false;
    authApi.verify(token, purpose, inviteCode)
      .then((res: any) => {
        if (cancelled) return;
        if (res.ok || res.user) {
          setStatus('success');
          setTimeout(() => navigate('/dashboard'), 800);
        } else {
          setStatus('error');
          setErrorMsg(res.message || '验证失败');
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(err.message || '验证请求失败，请重试');
      });

    return () => { cancelled = true; };
  }, [token, purpose, inviteCode, navigate]);

  return (
    <Layout size="sm">
      <div className="text-center py-3xl">
        {status === 'verifying' && (
          <>
            <div className="relative w-20 h-20 mx-auto mb-lg">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
              <div className="absolute inset-4 rounded-full bg-primary/60" />
            </div>
            <h3 className="font-display text-2xl text-gradient-gold mb-sm">正在验证</h3>
            <p className="text-xs text-fg-secondary font-body italic">
              魔法链接验证中 · 即将进入秘境
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-5xl mb-md">✦</div>
            <h3 className="font-display text-2xl text-gradient-gold mb-sm">验证成功</h3>
            <p className="text-xs text-fg-secondary font-body italic">
              正在前往你的秘境...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-md text-secondary">✦</div>
            <h3 className="font-display text-2xl text-secondary mb-sm">验证失败</h3>
            <p className="text-sm text-fg-secondary font-body mb-lg">{errorMsg}</p>
            <button onClick={() => navigate('/auth')} className="btn-secondary">
              返回登录页
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}