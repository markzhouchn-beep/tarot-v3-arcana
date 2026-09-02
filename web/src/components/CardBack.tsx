// ============================================================
// components/CardBack.tsx · 塔罗牌背（v3.0 复用 v2.0 card-back-rare.png）
// 创建：2026-09-01
// ============================================================

import { CARD_BACK_RARE_URL } from '../lib/cards';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  /** 是否显示装饰光晕（抽牌动画时） */
  glowing?: boolean;
}

const SIZE_CLASS = {
  sm: 'w-16',
  md: 'w-28',
  lg: 'w-40 md:w-48',
};

export function CardBack({ size = 'md', glowing = false }: Props) {
  return (
    <div
      className={`${SIZE_CLASS[size]} aspect-[5/8] relative group`}
    >
      <div
        className={`absolute inset-0 border-2 border-primary overflow-hidden shadow-lg ${
          glowing ? 'shadow-glow-gold-lg' : ''
        }`}
      >
        <img
          src={CARD_BACK_RARE_URL}
          alt="塔罗牌背"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      {glowing && (
        <div className="absolute inset-0 pointer-events-none animate-pulse">
          <div className="absolute inset-0 shadow-glow-gold" />
        </div>
      )}
    </div>
  );
}
