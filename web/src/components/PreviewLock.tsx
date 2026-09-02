// ============================================================
// components/PreviewLock.tsx · v3.0 预览锁
// 修复 v3.0.1：仅渲染锁屏（不再叠加原内容，避免撑爆）
// 创建：2026-09-01 · 23:36 重写
// ============================================================

import { useNavigate } from 'react-router-dom';

interface Props {
  reason: 'login_required' | 'tier_required' | 'quota_exhausted';
  tier?: 'silver' | 'gold';
  ctaHref: string;
  spread?: {
    name: string;
    cards: number;
    theme: string;
    price?: number;
  };
}

function getHeadline(reason: string, tier?: string, spread?: Props['spread']) {
  if (reason === 'login_required') {
    const name = spread?.name || '这个牌阵';
    const cards = spread?.cards || 0;
    return {
      emoji: '🔒',
      title: `${name}（${cards}张牌阵）`,
      body: cards > 1
        ? `这段关系的深层能量，需要 ${cards} 张牌才能看清。`
        : `一个简单的指引，可能点亮你心中的疑问。`,
    };
  }
  if (reason === 'tier_required') {
    return {
      emoji: '🌙',
      title: tier === 'gold' ? '金月会员专属牌阵' : '银月会员专属牌阵',
      body: tier === 'gold'
        ? '凯尔特十字、十张深度阵 — 解锁所有深层探索。'
        : '高阶牌阵 · 完整位置解读 · 无限追问。',
    };
  }
  return {
    emoji: '⏳',
    title: '今日额度已用完',
    body: '升级会员解锁无限使用，或明天再来。',
  };
}

export function PreviewLock({ reason, tier, ctaHref, spread }: Props) {
  const navigate = useNavigate();
  const headline = getHeadline(reason, tier, spread);

  return (
    // 修复：使用完整的锁屏卡片（不叠加 children），固定最小高度，圆角统一 rounded-lg
    <div className="relative panel rounded-lg p-lg border border-border bg-bg-occult overflow-hidden">
      {/* 装饰背景光晕 */}
      <div
        className="absolute -top-20 -right-20 w-48 h-48 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(200, 152, 91, 0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative flex items-start gap-md">
        {/* 左侧：🔒 */}
        <div className="flex-shrink-0 text-3xl opacity-70">{headline.emoji}</div>

        {/* 右侧：标题 + 文案 + 三按钮 */}
        <div className="flex-1 min-w-0">
          {reason === 'tier_required' && tier && (
            <div className="caps text-secondary mb-xs">{tier.toUpperCase()} MEMBER ONLY</div>
          )}

          <h4 className="font-display text-base text-fg mb-xs leading-tight">
            {headline.title}
          </h4>
          <p className="text-xs text-fg-secondary font-body mb-md leading-relaxed">
            {headline.body}
          </p>

          {/* 三按钮（紧凑横向） */}
          <div className="flex flex-wrap gap-xs">
            {reason === 'tier_required' && tier === 'silver' && (
              <button onClick={() => navigate(ctaHref)} className="btn-primary text-2xs px-md py-xs">
                🌙 升级银月 ¥19.9/月
              </button>
            )}
            {reason === 'tier_required' && tier === 'gold' && (
              <button onClick={() => navigate(ctaHref)} className="btn-primary text-2xs px-md py-xs">
                ✦ 升级金月 ¥39.9/月
              </button>
            )}
            {reason === 'login_required' && (
              <button onClick={() => navigate(ctaHref)} className="btn-primary text-2xs px-md py-xs">
                立即登录
              </button>
            )}
            {reason === 'quota_exhausted' && (
              <button onClick={() => navigate(ctaHref)} className="btn-primary text-2xs px-md py-xs">
                查看会员
              </button>
            )}
            {reason === 'tier_required' && spread?.price && (
              <button
                onClick={() => navigate(`/checkout/single?spread=${spread.cards === 1 ? 'single' : spread.cards === 3 ? 'three' : 'ten'}`)}
                className="btn-secondary text-2xs px-md py-xs"
              >
                💳 单次 ¥{spread.price}
              </button>
            )}
            <button
              onClick={() => navigate('/yes-no')}
              className="text-2xs text-fg-faint hover:text-primary transition-colors px-md py-xs font-caps uppercase tracking-[0.18em]"
            >
              ✨ Yes/No
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}