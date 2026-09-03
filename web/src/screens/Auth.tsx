// ============================================================
// screens/Auth.tsx · 邮箱密码登录 / 注册（v3.0.1：禁魔法链接）
// Phase 1 · 第 4 页
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { authApi, invitesApi } from '../lib/api';

type Action = 'login' | 'register';

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const callbackUrl = params.get('callback') || '/dashboard';
  const inviteCodeFromUrl = params.get('invite') || '';
  const [inviterInfo, setInviterInfo] = useState<{ nickname: string; tier: string } | null>(null);

  const [action, setAction] = useState<Action>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<any>(null);

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

  const handleSubmit = () => handlePassword();

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

      {/* 邮箱 */}
      <div className="mb-md">
        <label className="caps block mb-xs text-fg-faint">邮箱</label>
        <input
          type="email"
          className="input"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      {/* 密码 */}
      <div className="mb-md">
        <label className="caps block mb-xs text-fg-faint">密码</label>
        <input
          type="password"
          className="input"
          placeholder={action === 'register' ? '至少 8 位，含数字和字母' : '你的密码'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={action === 'register' ? 'new-password' : 'current-password'}
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

      {/* v3.0.1 C 方案：验证码登录 + 忘记密码入口 */}
      <button
        onClick={() => navigate('/auth/code')}
        className="text-xs text-primary hover:text-primary-light mt-xs block mx-auto mb-sm"
      >
        ✦ 用验证码登录
      </button>

      <div className="flex justify-end mb-md">
        <button
          onClick={() => navigate('/auth/forgot')}
          className="text-xs text-fg-faint hover:text-primary"
        >
          忘了密码？
        </button>
      </div>

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
        {action === 'login' ? '登录' : '注册'}
      </Button>

      {/* 提示 */}
      <div className="mt-xl text-center">
        <p className="text-xs text-fg-faint leading-relaxed">
          密码至少 8 位，须含数字和字母
          {'\n'}
          连续 5 次错误将锁定账户 15 分钟
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
