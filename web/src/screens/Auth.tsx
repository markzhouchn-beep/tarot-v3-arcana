// ============================================================
// screens/Auth.tsx · 登录/注册（v3.0.2：默认验证码）
// 2026-09-06 重构：默认用 6 位邮箱验证码，密码降为可选 Tab
// ============================================================

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { authApi, invitesApi } from '../lib/api';

type Action = 'login' | 'register';
type Mode = 'code' | 'password';

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const callbackUrl = params.get('callback') || '/dashboard';
  const inviteCodeFromUrl = params.get('invite') || '';
  const [inviterInfo, setInviterInfo] = useState<{ nickname: string; tier: string } | null>(null);

  // 默认 验证码 模式（无密码，最快）
  const [mode, setMode] = useState<Mode>('code');
  const [action, setAction] = useState<Action>('login');

  // 共享：邮箱
  const [email, setEmail] = useState('');

  // 密码模式字段
  const [password, setPassword] = useState('');

  // 验证码模式字段
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [codeStep, setCodeStep] = useState<'email' | 'code'>('email');
  const [resendIn, setResendIn] = useState(0);

  // 共享
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 验证码倒计时
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Phase 4: 解析 URL ?invite=ABC 参数 → 查邀请人信息
  useEffect(() => {
    if (inviteCodeFromUrl) {
      invitesApi.lookup(inviteCodeFromUrl)
        .then((res: any) => {
          if (res.ok) setInviterInfo(res.inviter);
        })
        .catch(() => { /* 邀请码无效静默 */ });
    }
  }, [inviteCodeFromUrl]);

  // 如果已登录，提示绑定密码（不强制）
  useEffect(() => {
    authApi.me().then(d => {
      if (d.user) setLoggedInUser(d.user);
    }).catch(() => {});
  }, []);

  const handlePassword = async () => {
    if (!email.includes('@')) {
      setMessage({ type: 'error', text: '请输入有效邮箱' });
      return;
    }
    if (password.length < 8) {
      setMessage({ type: 'error', text: '密码至少 8 位' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      if (action === 'register') {
        // Phase 4: 注册时带上 invite_code（如果 URL 有）
        await authApi.register({ email, password, invite_code: inviteCodeFromUrl || undefined });
      } else {
        await authApi.login({ email, password });
      }
      navigate(callbackUrl);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async () => {
    if (!email.includes('@')) {
      setMessage({ type: 'error', text: '请输入有效邮箱' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res: any = await authApi.sendCode(email, 'login');
      setMessage({
        type: 'success',
        text: res.dev_code
          ? `验证码已发送（开发模式：${res.dev_code}）`
          : `验证码已发送至 ${email}，${res.ttl_min || 10} 分钟内有效`,
      });
      setCodeStep('code');
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
      const res: any = await authApi.verifyCode(email, codeStr);
      if (res.already_logged_in) {
        setMessage({ type: 'success', text: res.message || '登录成功' });
        setTimeout(() => navigate(callbackUrl), 500);
        return;
      }
      // 新用户 / 无密码 → 跳 set-password
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

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setCode(text.split(''));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setMessage(null);
    if (m === 'code') {
      setCodeStep('email');
      setCode(['', '', '', '', '', '']);
    }
  };

  const handleSubmit = () => {
    if (mode === 'code') {
      if (codeStep === 'email') sendCode();
      else verifyCode();
    } else {
      handlePassword();
    }
  };

  return (
    <Layout size="sm">
      <ScreenHeader back="/" title="账户" />

      {/* Phase 4: 邀请人提示横幅 */}
      {inviterInfo && (
        <div className="panel p-md mb-md bg-bg-occult text-center text-sm">
          <span className="caps text-2xs text-primary">— 邀请提示 —</span>
          <p className="text-fg font-body mt-xs">
            ✦ 你正在被 <strong>{inviterInfo.nickname}</strong> 邀请注册
          </p>
          <p className="caps text-2xs text-fg-faint mt-xs">
            注册成功后你将获得 1 次三张免费 · 邀请人将获得 3 次追问
          </p>
        </div>
      )}

      <div className="text-center mb-2xl mt-lg">
        <div className="caps text-fg-faint mb-xs">— Welcome —</div>
        <h1 className="text-3xl text-gradient-gold mb-md">✦ ARCANA ai</h1>
        <p className="text-sm text-fg-secondary font-body italic">
          加入，解锁全部高级牌阵与追问
        </p>
      </div>

      {/* 模式 Tab：验证码 / 密码（默认验证码） */}
      <div className="flex gap-1 mb-lg bg-bg-occult rounded p-1">
        <button
          onClick={() => switchMode('code')}
          className={`flex-1 py-2 text-sm rounded transition ${
            mode === 'code'
              ? 'bg-primary text-bg-canvas font-medium'
              : 'text-fg-secondary hover:text-fg'
          }`}
        >
          ✦ 验证码登录
        </button>
        <button
          onClick={() => switchMode('password')}
          className={`flex-1 py-2 text-sm rounded transition ${
            mode === 'password'
              ? 'bg-primary text-bg-canvas font-medium'
              : 'text-fg-secondary hover:text-fg'
          }`}
        >
          密码登录
        </button>
      </div>

      {/* 验证码模式 */}
      {mode === 'code' && (
        <>
          {codeStep === 'email' ? (
            <div className="mb-md">
              <label className="caps block mb-xs text-fg-faint">邮箱</label>
              <input
                type="email"
                className="input"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendCode()}
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                autoFocus
              />
              <p className="caps text-2xs text-fg-faint mt-xs">
                无需密码 · 输入邮箱即可收到 6 位验证码
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-xs">
                <label className="caps text-fg-faint">验证码</label>
                <button
                  onClick={() => { setCodeStep('email'); setCode(['', '', '', '', '', '']); }}
                  className="text-xxs text-fg-secondary hover:text-primary"
                >
                  ← 改邮箱
                </button>
              </div>
              <p className="text-xxs text-fg-faint mb-md font-mono">{email}</p>
              <div className="flex gap-1.5 justify-between mb-md" onPaste={handleCodePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleCodeChange(i, e.target.value)}
                    onKeyDown={e => handleCodeKeyDown(i, e)}
                    className="input text-center text-2xl font-bold w-full"
                  />
                ))}
              </div>
              <div className="text-center">
                {resendIn > 0 ? (
                  <span className="text-xxs text-fg-faint">{resendIn}s 后重新发送</span>
                ) : (
                  <button onClick={sendCode} className="text-xxs text-primary hover:text-primary-light">
                    重新发送验证码
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 密码模式 */}
      {mode === 'password' && (
        <>
          <div className="mb-md">
            <label className="caps block mb-xs text-fg-faint">邮箱</label>
            <input
              type="email"
              className="input"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
            />
          </div>

          <div className="mb-md">
            <label className="caps block mb-xs text-fg-faint">密码</label>
            <input
              type="password"
              className="input"
              placeholder={action === 'register' ? '至少 8 位，含数字和字母' : '你的密码'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePassword()}
              autoComplete={action === 'register' ? 'new-password' : 'current-password'}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {/* 登录 / 注册 切换 */}
          <div className="flex justify-end mb-md">
            <button
              onClick={() => setAction(action === 'login' ? 'register' : 'login')}
              className="text-xs text-fg-secondary hover:text-primary"
            >
              {action === 'login' ? '还没有账户？注册' : '已有账户？登录'}
            </button>
          </div>

          <div className="flex justify-end mb-md">
            <button
              onClick={() => navigate('/auth/forgot')}
              className="text-xs text-fg-faint hover:text-primary"
            >
              忘了密码？
            </button>
          </div>
        </>
      )}

      {/* 消息 */}
      {message && (
        <div
          className={`text-sm px-md py-sm mb-md border ${
            message.type === 'success'
              ? 'border-success/30 bg-success/5 text-success'
              : 'border-secondary/30 bg-secondary/5 text-secondary'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 主按钮 */}
      <Button onClick={handleSubmit} loading={loading} fullWidth size="lg">
        {mode === 'code'
          ? (codeStep === 'email' ? '发送验证码' : '验证并登录')
          : (action === 'login' ? '登录' : '注册')}
      </Button>

      {/* 提示 */}
      <div className="mt-xl text-center">
        <p className="text-xs text-fg-faint leading-relaxed">
          {mode === 'code'
            ? '验证码 10 分钟内有效 · 不需要记密码'
            : '密码至少 8 位，须含数字和字母 · 连续 5 次错误将锁定 15 分钟'}
        </p>
      </div>

      {/* 跳过（开发用） */}
      <div className="mt-2xl text-center">
        <button
          onClick={() => navigate('/')}
          className="text-xs text-fg-faint hover:text-fg-secondary"
        >
          稍后再说 · 继续浏览
        </button>
      </div>

      {/* 已登录用户提示：引导绑定密码（不强制） */}
      {loggedInUser && (
        <div className="mt-xl panel p-md bg-bg-occult border-primary/20">
          <div className="caps text-primary mb-xs">当前已登录</div>
          <p className="text-xs text-fg-secondary font-body mb-md">
            你已用邮箱密码登录。如需换设备登录，请记得密码。
          </p>
        </div>
      )}
    </Layout>
  );
}
