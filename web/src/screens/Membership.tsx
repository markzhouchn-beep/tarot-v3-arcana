// ============================================================
// screens/Membership.tsx · /membership — 会员中心
// Phase 1.6
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { membershipApi, authApi, ordersApi } from '../lib/api';

interface MembershipStatus {
  tier: 'guest' | 'registered' | 'silver' | 'gold';
  expires_at?: number;
  auto_renew?: number;
}

const TIERS = [
  {
    id: 'silver',
    name: '银月会员',
    icon: '🌙',
    monthly: 19.9,
    yearly: 199,
    features: [
      '每日无限 Yes/No',
      '所有单张 / 三张牌阵',
      '银月专属牌阵（5 张阵）',
      '5 次追问 / 月',
    ],
    planMonthly: 'AFDIAN_PLAN_SILVER_MONTHLY',
    planYearly: 'AFDIAN_PLAN_SILVER_YEARLY',
  },
  {
    id: 'gold',
    name: '金月会员',
    icon: '✦',
    monthly: 39.9,
    yearly: 399,
    features: [
      '银月所有权益',
      '金月专属牌阵（7 张 · 10 张 · 凯尔特十字）',
      '无限追问',
      '每月 3 次免费重抽',
    ],
    planMonthly: 'AFDIAN_PLAN_GOLD_MONTHLY',
    planYearly: 'AFDIAN_PLAN_GOLD_YEARLY',
  },
];

export default function Membership() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<MembershipStatus | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      membershipApi.status().catch(() => null),
      authApi.me().catch(() => null),
    ]).then(([s, u]) => {
      setStatus(s as any);
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Layout size="md">
        <ScreenHeader back="/" title="会员" />
        <div className="text-center py-3xl text-fg-faint caps animate-pulse">加载中</div>
      </Layout>
    );
  }

  const currentTier = status?.tier || 'guest';
  const isMember = currentTier === 'silver' || currentTier === 'gold';

  return (
    <Layout size="md">
      <ScreenHeader back="/" title="会员" />

      {/* 当前状态 */}
      <div className="panel p-lg mb-xl text-center border-primary/30 bg-bg-occult">
        <div className="caps text-2xs text-fg-faint mb-sm">— 你的会员状态 —</div>
        {user ? (
          <>
            <div className="font-display text-2xl text-gradient-gold mb-xs">
              {isMember ? TIERS.find(t => t.id === currentTier)?.name : '未开通会员'}
            </div>
            {isMember && status?.expires_at && (
              <div className="caps text-2xs text-fg-secondary">
                到期时间：{new Date(status.expires_at).toLocaleDateString('zh-CN')}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-fg-secondary">
            请先<button onClick={() => navigate('/auth')} className="text-primary underline mx-xs">登录</button>查看会员状态
          </div>
        )}
      </div>

      {/* 套餐列表 */}
      <div className="space-y-md">
        {TIERS.map(tier => (
          <TierCard
            key={tier.id}
            tier={tier}
            current={currentTier === tier.id}
            onSubscribe={async (plan) => {
              // Phase 2：调 /api/membership/subscribe → 拿爱发电 URL → window.open 跳转
              try {
                // 先查是否登录（未登录跳转 /auth）
                const me = await authApi.me();
                if (!me?.user?.id) {
                  navigate('/auth');
                  return;
                }
                const planKey = `${tier.id}_${plan === 'monthly' ? 'monthly' : 'yearly'}`;
                const res = await membershipApi.subscribe(planKey);
                if (res?.afdianPayUrl) {
                  // 必须同步 window.open 避免拦截
                  const win = window.open('about:blank', '_blank');
                  if (win) win.location.href = res.afdianPayUrl;
                  else window.location.href = res.afdianPayUrl;
                } else {
                  alert('订阅创建失败：未返回支付链接');
                }
              } catch (err) {
                // 401 / 未登录一律跳 /auth，不弹错误框
                const msg = err instanceof Error ? err.message : String(err);
                if (
                  msg.includes('401') ||
                  msg.includes('LOGIN_REQUIRED') ||
                  msg.includes('SESSION_EXPIRED') ||
                  msg.includes('UNAUTHORIZED') ||
                  msg.includes('请先登录') ||
                  msg.includes('会话已过期')
                ) {
                  navigate('/auth');
                  return;
                }
                alert(`订阅失败：${msg}`);
              }
            }}
          />
        ))}
      </div>

      <div className="caps text-2xs text-fg-faint text-center mt-xl">
        会员通过爱发电订阅 · 自动激活
      </div>
    </Layout>
  );
}

function TierCard({
  tier,
  current,
  onSubscribe,
}: {
  tier: typeof TIERS[0];
  current: boolean;
  onSubscribe: (plan: 'monthly' | 'yearly') => void;
}) {
  return (
    <div className={`panel p-lg ${current ? 'border-primary/60 bg-primary/5' : ''}`}>
      <div className="flex items-center gap-sm mb-md">
        <div className="text-3xl">{tier.icon}</div>
        <div>
          <h3 className="font-display text-xl text-fg">{tier.name}</h3>
          {current && <div className="caps text-2xs text-primary">当前套餐</div>}
        </div>
      </div>

      <ul className="text-xs text-fg-secondary font-body space-y-xs mb-md">
        {tier.features.map((f, i) => (
          <li key={i}>· {f}</li>
        ))}
      </ul>

      <div className="flex gap-md">
        <Button onClick={() => onSubscribe('monthly')} variant="secondary" size="md" fullWidth>
          ¥{tier.monthly}/月
        </Button>
        <Button onClick={() => onSubscribe('yearly')} variant="primary" size="md" fullWidth>
          ¥{tier.yearly}/年 省 ¥{tier.monthly * 12 - tier.yearly}
        </Button>
      </div>
    </div>
  );
}