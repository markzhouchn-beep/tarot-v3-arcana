// ============================================================
// screens/Spreads.tsx · 牌阵选择（4 主题 + 🔍 预览锁模式）
// Phase 1 · 第 2 页
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { PreviewLock } from '../components/PreviewLock';
import { spreadsApi, authApi } from '../lib/api';

interface Spread {
  id: string;
  name: string;
  theme: string;
  cards: number;
  tier_required: string;
  price: number;
  original_price?: number;
  positions?: string[];
  accessible: boolean;
  locked: boolean;
  free_first?: boolean;
}

const THEME_META: Record<string, { label: string; symbol: string }> = {
  all:    { label: '全部',    symbol: '✦' },
  love:   { label: '感情',    symbol: '💞' },
  career: { label: '事业',    symbol: '💼' },
  money:  { label: '财富',    symbol: '💰' },
  self:   { label: '自我',    symbol: '🌙' },
};

const TIER_LABEL: Record<string, string> = {
  registered: '注册可用',
  silver:     '银月',
  gold:       '金月',
};

export default function Spreads() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const theme = params.get('theme') || 'all';

  const [spreads, setSpreads] = useState<Spread[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      spreadsApi.list().then(d => d.spreads).catch(() => []),
      authApi.me().then(d => d.user).catch(() => null),
    ]).then(([s, u]) => {
      setSpreads(s);
      setUser(u);
      setLoading(false);
    });
  }, []);

  const filtered = theme === 'all' ? spreads : spreads.filter(s => s.theme === theme);

  return (
    <Layout size="md">
      <ScreenHeader back="/" title="选择牌阵" />

      {/* 主题切换 tabs */}
      <div className="flex gap-xs mb-xl overflow-x-auto pb-xs">
        {Object.entries(THEME_META).map(([key, { label, symbol }]) => (
          <button
            key={key}
            onClick={() => navigate(key === 'all' ? '/spreads' : `/spreads?theme=${key}`)}
            className={`px-md py-xs font-caps uppercase tracking-[0.18em] text-2xs whitespace-nowrap transition-colors duration-fast border ${
              theme === key
                ? 'border-primary text-primary bg-bg-occult'
                : 'border-transparent text-fg-faint hover:text-fg-secondary'
            }`}
          >
            <span className="mr-2xs">{symbol}</span>
            {label}
          </button>
        ))}
      </div>

      {/* 牌阵列表 */}
      {loading ? (
        <div className="text-center py-3xl text-fg-faint">
          <div className="caps">加载中</div>
        </div>
      ) : (
        <div className="space-y-md">
          {filtered.map(spread => (
            <SpreadCard
              key={spread.id}
              spread={spread}
              isLoggedIn={!!user}
              onClick={() => navigate(`/ask/${spread.id}`)}
              onAuthClick={() => navigate('/auth')}
              onMembershipClick={() => navigate('/membership')}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}

function SpreadCard({
  spread,
  isLoggedIn,
  onClick,
  onAuthClick,
  onMembershipClick,
}: {
  spread: Spread;
  isLoggedIn: boolean;
  onClick: () => void;
  onAuthClick: () => void;
  onMembershipClick: () => void;
}) {
  const isLocked = spread.locked;
  const needsLogin = !isLoggedIn;

  if (isLocked && needsLogin) {
    return <PreviewLock reason="login_required" ctaHref="/auth" spread={spread} />;
  }

  if (isLocked && spread.tier_required !== 'registered') {
    const tier = spread.tier_required as 'silver' | 'gold';
    return <PreviewLock reason="tier_required" tier={tier} ctaHref="/membership" spread={spread} />;
  }

  return (
    <button
      onClick={onClick}
      className="w-full panel p-lg text-left transition-all duration-fast hover:border-primary hover:shadow-glow-gold animate-fade-in"
    >
      <SpreadContent spread={spread} />
    </button>
  );
}

function SpreadContent({ spread }: { spread: Spread }) {
  return (
    <div>
      <div className="flex items-start justify-between mb-xs">
        <h3 className="font-display text-xl text-fg">{spread.name}</h3>
        <div className="caps text-fg-faint text-2xs whitespace-nowrap">
          {spread.cards} 张牌
        </div>
      </div>

      {/* 价格 / 权限标识 */}
      <div className="flex items-center gap-md mb-md">
        <div className="caps text-2xs">
          <span
            className={`px-2xs py-2xs border ${
              spread.tier_required === 'registered'
                ? 'border-border text-fg-faint'
                : spread.tier_required === 'silver'
                ? 'border-border-strong text-fg-secondary'
                : 'border-primary text-primary'
            }`}
          >
            {TIER_LABEL[spread.tier_required]}
          </span>
        </div>
        {spread.price > 0 && (
          <div className="flex items-baseline gap-xs">
            <span className="num-display text-lg text-primary">¥{spread.price}</span>
            {spread.original_price && (
              <span className="num-display text-xs text-fg-faint line-through">
                ¥{spread.original_price}
              </span>
            )}
          </div>
        )}
        {spread.free_first && (
          <div className="caps text-2xs text-accent-green">首单免费</div>
        )}
      </div>

      {/* 位置说明 */}
      {spread.positions && spread.positions.length > 0 && (
        <div className="text-xs text-fg-faint font-body leading-relaxed">
          {spread.positions.slice(0, 3).join(' · ')}
          {spread.positions.length > 3 && ' · ...'}
        </div>
      )}
    </div>
  );
}
