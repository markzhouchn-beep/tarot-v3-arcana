// ============================================================
// screens/Dashboard.tsx · /dashboard — 用户后台
// Phase 1.6 · 我的占卜记录
// Phase 4 · 邀请 Tab
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { authApi, ordersApi, invitesApi } from '../lib/api';

interface OrderRecord {
  id: string;
  question: string;
  status: string;
  created_at: number;
  amount: number;
  cards_count: number;
}

interface InviteReward {
  id: string;
  reward_type: string;
  reward_value: string;
  granted_at: number;
}

interface InviteInfo {
  id: string;
  invitee_email: string;
  invitee_tier?: string;
  status: string;
  created_at: number;
  invitee_effective_at?: number;
  reward_registration_at?: number;
  reward_first_paid_at?: number;
  reward_milestone_at?: number;
}

interface InviteStats {
  invite_code: string;
  invite_url?: string;
  invites: InviteInfo[];
  rewards: InviteReward[];
  summary: {
    total_invites: number;
    effective_count: number;
    total_rewards: number;
    milestone_reached: boolean;
  };
}

type TabKey = 'readings' | 'invite';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('readings');
  const [inviteStats, setInviteStats] = useState<InviteStats | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    authApi.me()
      .then(d => {
        setUser(d.user);
        // 拉订单历史
        return ordersApi.list().catch(() => ({ orders: [] }));
      })
      .then((data: any) => {
        setOrders(data.orders || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Phase 4: 邀请 Tab 打开时拉取
  useEffect(() => {
    if (activeTab === 'invite' && !inviteStats && !inviteLoading) {
      setInviteLoading(true);
      invitesApi.me()
        .then((res: any) => {
          if (res.ok) setInviteStats(res);
          setInviteLoading(false);
        })
        .catch(() => setInviteLoading(false));
    }
  }, [activeTab, inviteStats, inviteLoading]);

  if (loading) {
    return (
      <Layout size="md">
        <ScreenHeader back="/" title="我的" />
        <div className="text-center py-3xl caps text-fg-faint animate-pulse">加载中</div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout size="md">
        <ScreenHeader back="/" title="我的" />
        <div className="panel p-lg text-center">
          <div className="caps text-fg-faint mb-md">— 未登录 —</div>
          <Button onClick={() => navigate('/auth')} variant="primary" size="md">
            登录 / 注册
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout size="md">
      <ScreenHeader back="/" title="我的" />

      {/* 用户卡片 */}
      <div className="panel p-lg mb-lg text-center bg-bg-occult">
        <div className="text-3xl mb-xs">✦</div>
        <div className="font-display text-xl text-fg">{user.email}</div>
        <div className="caps text-2xs text-fg-faint mt-xs">
          {user.tier === 'silver' ? '🌙 银月会员' :
           user.tier === 'gold' ? '✦ 金月会员' : '注册用户'}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-md mb-lg">
        <button
          onClick={() => setActiveTab('readings')}
          className={`flex-1 py-sm text-sm font-body transition-colors ${
            activeTab === 'readings'
              ? 'text-primary border-b-2 border-primary'
              : 'text-fg-faint border-b border-fg-faint/30'
          }`}
        >
          我的占卜
        </button>
        <button
          onClick={() => setActiveTab('invite')}
          className={`flex-1 py-sm text-sm font-body transition-colors ${
            activeTab === 'invite'
              ? 'text-primary border-b-2 border-primary'
              : 'text-fg-faint border-b border-fg-faint/30'
          }`}
        >
          ✦ 邀请好友
        </button>
      </div>

      {activeTab === 'readings' && (
        <>
          <div className="caps text-primary mb-md">— 我的占卜 —</div>
      {orders.length === 0 ? (
        <div className="panel p-lg text-center text-fg-faint">
          <div className="caps text-2xs mb-md">暂无记录</div>
          <Button onClick={() => navigate('/spreads')} variant="primary" size="md">
            开始第一次占卜
          </Button>
        </div>
      ) : (
        <div className="space-y-sm">
          {orders.map(o => (
            <OrderItem key={o.id} order={o} onClick={() => {
              if (o.status === 'paid' || o.status === 'interpreted') {
                navigate(`/reading/${o.id}`);
              } else {
                navigate(`/spread/${o.id}`);
              }
            }} />
          ))}
        </div>
      )}

      <div className="mt-xl flex gap-md">
        <Button onClick={() => navigate('/spreads')} variant="secondary" size="md" fullWidth>
          ✦ 新的占卜
        </Button>
        <Button onClick={() => navigate('/membership')} variant="primary" size="md" fullWidth>
          升级会员
        </Button>
      </div>
        </>
      )}

      {/* Phase 4: 邀请 Tab */}
      {activeTab === 'invite' && (
        <InvitePanel stats={inviteStats} loading={inviteLoading} />
      )}
    </Layout>
  );
}

// ============================================================
// Phase 4: 邀请面板
// ============================================================
function InvitePanel({ stats, loading }: { stats: InviteStats | null; loading: boolean }) {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return <div className="text-center py-xl caps text-fg-faint animate-pulse">加载中</div>;
  }

  if (!stats) {
    return (
      <div className="panel p-lg text-center text-fg-faint">
        <div className="caps text-2xs mb-md">加载失败</div>
        <div className="text-sm">请稍后重试</div>
      </div>
    );
  }

  // 优先用后端返的 invite_url（生产/本地 origin 一致），否则拼接当前 origin
  const inviteUrl = stats.invite_url || `${window.location.origin}/?invite=${stats.invite_code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: 用 prompt
      prompt('复制邀请链接：', inviteUrl);
    }
  };

  // 奖励类型 → 文案映射
  const rewardLabels: Record<string, string> = {
    registration_ask: '+3 次追问',
    invitee_three_spread: '+1 次三张免费',
    paid_coupon: '+¥3 单次抵扣券',
    paid_ask: '+5 次追问',
    milestone_ten: '+1 次免费十张牌',
    milestone_ask: '+10 次追问',
  };

  // 状态 → 文案映射
  const statusLabels: Record<string, string> = {
    pending: '待验证',
    registered: '已注册',
    effective: '已体验',
    paid: '已付费',
    rewarded: '已奖励',
  };

  return (
    <div className="space-y-lg">
      {/* 邀请链接卡片 */}
      <div className="panel p-lg bg-bg-occult border-primary/40">
        <div className="caps text-2xs text-primary text-center mb-md">— 我的邀请码 —</div>
        <div className="font-display text-3xl text-center text-fg tracking-widest mb-md">
          {stats.invite_code}
        </div>
        <div className="text-2xs text-fg-secondary text-center mb-md break-all font-mono">
          {inviteUrl}
        </div>
        <Button onClick={handleCopy} variant="primary" size="md" fullWidth>
          {copied ? '✓ 已复制' : '复制邀请链接'}
        </Button>
      </div>

      {/* 累计统计 */}
      <div className="grid grid-cols-3 gap-sm">
        <div className="panel p-md text-center">
          <div className="font-display text-xl text-fg">{stats.summary.total_invites}</div>
          <div className="caps text-2xs text-fg-faint mt-xs">总邀请</div>
        </div>
        <div className="panel p-md text-center">
          <div className="font-display text-xl text-fg">{stats.summary.effective_count}</div>
          <div className="caps text-2xs text-fg-faint mt-xs">有效注册</div>
        </div>
        <div className="panel p-md text-center">
          <div className="font-display text-xl text-primary">{stats.summary.total_rewards}</div>
          <div className="caps text-2xs text-fg-faint mt-xs">获得奖励</div>
        </div>
      </div>

      {/* 奖励说明 */}
      <div className="panel p-md bg-bg-occult">
        <div className="caps text-2xs text-primary mb-sm">— 邀请奖励 —</div>
        <ul className="text-sm text-fg-secondary space-y-xs font-body">
          <li>✦ 每邀请 1 人注册：你 +3 次追问 / 好友 +1 次三张免费</li>
          <li>✦ 好友首次付费：你 +¥3 抵扣券 + 5 次追问</li>
          <li>✦ 累计 3 人有效：你 +1 次免费十张牌 + 10 次追问</li>
        </ul>
      </div>

      {/* 我的奖励 */}
      {stats.rewards.length > 0 && (
        <div>
          <div className="caps text-primary mb-sm">— 我的奖励 —</div>
          <div className="space-y-xs">
            {stats.rewards.map(r => (
              <div key={r.id} className="panel p-sm flex items-center justify-between">
                <span className="text-sm text-fg font-body">
                  {rewardLabels[r.reward_type] || r.reward_type}
                </span>
                <span className="caps text-2xs text-fg-faint">
                  {new Date(r.granted_at).toLocaleDateString('zh-CN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 邀请记录 */}
      {stats.invites.length > 0 && (
        <div>
          <div className="caps text-primary mb-sm">— 邀请记录 —</div>
          <div className="space-y-xs">
            {stats.invites.map(inv => (
              <div key={inv.id} className="panel p-sm">
                <div className="flex items-center justify-between mb-xs">
                  <span className="text-sm text-fg-secondary font-body truncate">
                    {inv.invitee_email || '匿名'}
                  </span>
                  <span className="caps text-2xs text-primary">
                    {statusLabels[inv.status] || inv.status}
                  </span>
                </div>
                <div className="caps text-2xs text-fg-faint">
                  {new Date(inv.created_at).toLocaleDateString('zh-CN')}
                  {inv.reward_first_paid_at && ' · 已付费奖励'}
                  {inv.reward_milestone_at && ' · 已里程碑奖励'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 里程碑提示 */}
      {!stats.summary.milestone_reached && stats.summary.effective_count >= 2 && (
        <div className="panel p-md text-center bg-bg-occult border-primary/40">
          <div className="text-sm text-primary font-body">
            ✦ 再邀请 {3 - stats.summary.effective_count} 人即可解锁十张牌免费奖励！
          </div>
        </div>
      )}
      {stats.summary.milestone_reached && (
        <div className="panel p-md text-center bg-primary/10 border-primary">
          <div className="text-sm text-primary font-body">
            🎉 你已解锁里程碑奖励！查看上方「我的奖励」
          </div>
        </div>
      )}
    </div>
  );
}

function OrderItem({ order, onClick }: { order: OrderRecord; onClick: () => void }) {
  const statusLabel = {
    pending: '待支付',
    paid: '已付',
    interpreted: '已解读',
    expired: '已过期',
    cancelled: '已取消',
  }[order.status] || order.status;

  return (
    <button
      onClick={onClick}
      className="w-full panel p-md text-left hover:border-primary transition-colors"
    >
      <div className="flex items-center justify-between mb-xs">
        <div className="caps text-2xs text-fg-faint">
          {new Date(order.created_at).toLocaleString('zh-CN')}
        </div>
        <div className={`caps text-2xs ${
          order.status === 'interpreted' || order.status === 'paid' ? 'text-primary' :
          order.status === 'pending' ? 'text-fg-secondary' :
          'text-fg-faint'
        }`}>
          {statusLabel}
        </div>
      </div>
      <div className="text-sm text-fg font-body line-clamp-2">"{order.question}"</div>
      <div className="flex justify-between items-center mt-xs">
        <div className="caps text-2xs text-fg-faint">
          {order.cards_count} 张牌 · ¥{order.amount}
        </div>
        <div className="caps text-2xs text-primary">查看 →</div>
      </div>
    </button>
  );
}