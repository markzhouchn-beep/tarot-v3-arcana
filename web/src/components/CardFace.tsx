// ============================================================
// components/CardFace.tsx · 单张塔罗牌（v2.0 复用 + 适配 v3.0）
// ============================================================

import { useState } from 'react';
import { cardImageById, CARD_BACK_RARE_URL } from '../lib/cards';

// v3.0 简化 Card 接口（Phase 1 由 tarot-knowledge 充实完整 78 张）
export interface CardMini {
  id: string;           // e.g. 'major_00'
  name: string;         // e.g. '愚者'
  orientation: 'upright' | 'reversed';
  symbol?: string;      // e.g. '🃏'（占位，Phase 1 由 tarot-knowledge.js 充实）
  bg?: string;          // 渐变色
  accent?: string;      // 强调色
  imageUrl?: string;    // 牌图（可选，不填则从 id 查 v2.0 牌图）
}

interface Props {
  card: CardMini;
  size?: 'sm' | 'md' | 'lg';
  faceUp?: boolean;
  position?: string;    // 牌阵位置标注
}

const SIZE_CLASS = {
  sm: 'w-16',
  md: 'w-28',
  lg: 'w-40 md:w-48',
};

export function CardFace({ card, size = 'md', faceUp = true, position }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const isReversed = card.orientation === 'reversed';

  // 牌图源优先级：传入 imageUrl > id 查 v2.0 牌图 > 牌背 fallback
  const resolvedImageUrl = card.imageUrl || cardImageById(card.id);

  return (
    <div className="flex flex-col items-center">
      <div
        className={`${SIZE_CLASS[size]} aspect-[5/8] relative group`}
        style={{
          transform: faceUp && isReversed ? 'rotate(180deg)' : undefined,
          transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          className="absolute inset-0 border-2 border-primary overflow-hidden shadow-lg"
          style={{ background: `linear-gradient(135deg, ${card.bg || '#c8985b'}, #1a1310)` }}
        >
          {resolvedImageUrl && !imgErr ? (
            <img
              src={resolvedImageUrl}
              alt={card.name}
              className="w-full h-full object-cover"
              onError={() => setImgErr(true)}
              loading="lazy"
            />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-between p-2"
              style={{ color: card.accent || '#c8985b' }}
            >
              <div className="text-2xs font-caps tracking-[0.2em] opacity-80">{card.id.slice(-2)}</div>
              <div className="flex-1 flex items-center justify-center text-center leading-none text-4xl">
                {card.symbol || '✦'}
              </div>
              <div className="text-[10px] font-display tracking-[0.2em] opacity-90">{card.name}</div>
            </div>
          )}
        </div>

        {/* 装饰光晕 */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-slow">
          <div className="absolute inset-0 shadow-glow-gold" />
        </div>
      </div>

      {position && (
        <div className="mt-2 text-2xs font-caps uppercase tracking-[0.2em] text-fg-faint">
          {position}
        </div>
      )}
    </div>
  );
}
