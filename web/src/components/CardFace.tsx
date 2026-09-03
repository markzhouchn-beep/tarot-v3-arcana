// ============================================================
// components/CardFace.tsx · 单张塔罗牌（v3.0 纯牌图模式）
// ============================================================
// 重写 2026-09-03 20:53：删除 SVG/渐变/symbol 占位，统一用 rider-waite JPG
// - 正面：cardImageById() 拼的 v2.0 JPG（已修 Pentacles → Pents）
// - 兜底：同目录的 card-back-rare.png（牌背），不再用 emoji/渐变
// ============================================================

import { useState } from 'react';
import { cardImageById, CARD_BACK_RARE_URL } from '../lib/cards';

// v3.0 Card 接口（Phase 1 由 tarot-knowledge 充实完整 78 张）
export interface CardMini {
  id: string;           // e.g. 'ar07', 'wands_04'
  name: string;         // e.g. '战车'
  orientation: 'upright' | 'reversed';
  imageUrl?: string;    // 可选，传入则直接用（不走 cardImageById）
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

  // 牌图源：传入 imageUrl > id 查 rider-waite > 兜底牌背
  const resolvedImageUrl = card.imageUrl || cardImageById(card.id);
  const finalSrc = resolvedImageUrl && !imgErr ? resolvedImageUrl : CARD_BACK_RARE_URL;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`${SIZE_CLASS[size]} aspect-[5/8] relative group`}
        style={{
          transform: faceUp && isReversed ? 'rotate(180deg)' : undefined,
          transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="absolute inset-0 border-2 border-primary overflow-hidden shadow-lg bg-bg-occult">
          <img
            src={finalSrc}
            alt={card.name}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
            loading="lazy"
          />
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