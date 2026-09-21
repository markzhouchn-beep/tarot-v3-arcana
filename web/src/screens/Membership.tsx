// ============================================================
// screens/Membership.tsx · /membership — 会员中心
// 2026-09-21：爱发电已下线，会员订阅入口改为"敬请期待"
//            会员权益保留展示（admin 后台仍可手动授予）
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { membershipApi, authApi } from '../lib/api';

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

      {/* 2026-09-21：爱发电下线提示 */}
      <div className="panel p-lg mb-xl border-warning/40 bg-warning/5">
        <div className="text-center mb-md">
          <div className="text-2xl mb-xs">⏳</div>
          <h3 className="font-display text-lg text-gradient-gold mb-xs">会员订阅功能升级中</h3>
          <p className="text-xs text-fg-secondary font-body">
            我们正在为会员订阅接入支付宝 + PayPal 直接支付。<br />
            升级期间可继续享受会员权益，详情请联系客服。
          </p>
        </div>
      </div>

      {/* 套餐列表（展示但不可订阅） */}
      <div className="space-y-md">
        {TIERS.map(tier => (
          <TierCard key={tier.id} tier={tier} current={currentTier === tier.id} />
        ))}
      </div>

      {/* 权益对比表 */}
      <div className="mt-2xl">
        <div className="caps text-fg-faint mb-md text-center">— 权益对比 —</div>
        <div className="panel p-md overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-fg-faint font-normal">权益</th>
                <th className="text-center py-2 text-fg-faint font-normal">访客</th>
                <th className="text-center py-2 text-fg-faint font-normal">注册</th>
                <th className="text-center py-2 text-primary">银月</th>
                <th className="text-center py-2 text-primary">金月</th>
              </tr>
            </thead>
            <tbody className="text-fg-secondary">
              <tr className="border-b border-border-soft">
                <td className="py-2">每日 Yes/No</td>
                <td className="text-center text-fg-faint">1</td>
                <td className="text-center text-fg-faint">3</td>
                <td className="text-center text-fg">10</td>
                <td className="text-center text-primary font-medium">无限</td>
              </tr>
              <tr className="border-b border-border-soft">
                <td className="py-2">单张 / 三张牌阵</td>
                <td className="text-center text-primary">✓</td>
                <td className="text-center text-primary">✓</td>
                <td className="text-center text-primary">✓</td>
                <td className="text-center text-primary">✓</td>
              </tr>
              <tr className="border-b border-border-soft">
                <td className="py-2">5 张 / 7 张牌阵</td>
                <td className="text-center text-fg-faint">—</td>
                <td className="text-center text-fg-faint">—</td>
                <td className="text-center text-primary">5 张</td>
                <td className="text-center text-primary">全部</td>
              </tr>
              <tr className="border-b border-border-soft">
                <td className="py-2">凯尔特十字（10 张）</td>
                <td className="text-center text-fg-faint">—</td>
                <td className="text-center text-fg-faint">—</td>
                <td className="text-center text-fg-faint">—</td>
                <td className="text-center text-primary">✓</td>
              </tr>
              <tr className="border-b border-border-soft">
                <td className="py-2">Oracle 追问</td>
                <td className="text-center text-fg-faint">—</td>
                <td className="text-center text-fg-faint">2/月</td>
                <td className="text-center text-fg">5/月</td>
                <td className="text-center text-primary font-medium">无限</td>
              </tr>
              <tr>
                <td className="py-2">解读历史保存</td>
                <td className="text-center text-fg-faint">7天</td>
                <td className="text-center text-fg">永久</td>
                <td className="text-center text-fg">永久</td>
                <td className="text-center text-primary">永久</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 单次备选 */}
      <div className="mt-xl text-center space-y-sm">
        <p className="text-xxs text-fg-faint">
          不想开会员？<button onClick={() => navigate('/spreads')} className="text-primary hover:text-primary-light underline">单次解读 ¥1 起 →</button>
        </p>
      </div>
    </Layout>
  );
}

function TierCard({
  tier,
  current,
}: {
  tier: typeof TIERS[0];
  current: boolean;
}) {
  return (
    <div className={`panel p-lg ${current ? 'border-primary/60 bg-primary/5' : 'opacity-60'}`}>
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
        <Button variant="secondary" size="md" fullWidth disabled>
          ¥{tier.monthly}/月（暂不可订阅）
        </Button>
        <Button variant="secondary" size="md" fullWidth disabled>
          ¥{tier.yearly}/年（暂不可订阅）
        </Button>
      </div>
    </div>
  );
}