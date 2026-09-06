// ============================================================
// screens/CardDetail.tsx · /cards/:id — 单张塔罗牌详情
// 创建：2026-09-06
// ============================================================

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { CardFace } from '../components/CardFace';
import { getCardById, ARCANA_META } from '../data/cards';

export default function CardDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const card = id ? getCardById(id) : undefined;
  const [orientation, setOrientation] = useState<'upright' | 'reversed'>('upright');

  if (!card) {
    return (
      <Layout size="sm">
        <div className="text-center py-3xl">
          <div className="text-4xl mb-md">✦</div>
          <p className="text-fg-secondary mb-lg">未找到这张牌</p>
          <button onClick={() => navigate('/cards')} className="btn-primary">
            返回牌列表
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout size="md">
      {/* Header */}
      <div className="flex items-center justify-between mb-md">
        <button
          onClick={() => navigate('/cards')}
          className="text-fg-faint hover:text-primary text-sm"
        >
          ← 全部牌
        </button>
        <span className="caps text-2xs text-fg-faint">
          {ARCANA_META[card.arcana].symbol} {ARCANA_META[card.arcana].name}
        </span>
      </div>

      {/* 牌 + 切换 */}
      <div className="flex flex-col items-center mb-xl">
        <div className="mb-md">
          <CardFace
            card={{ id: card.id, name: card.name, orientation }}
            size="lg"
            faceUp
          />
        </div>

        {/* 正/逆位切换 */}
        <div className="flex gap-2">
          <button
            onClick={() => setOrientation('upright')}
            className={`px-4 py-1.5 text-xs rounded border transition ${
              orientation === 'upright'
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-bg-panel border-border-soft text-fg-secondary hover:border-primary/40'
            }`}
          >
            ✦ 正位
          </button>
          <button
            onClick={() => setOrientation('reversed')}
            className={`px-4 py-1.5 text-xs rounded border transition ${
              orientation === 'reversed'
                ? 'bg-secondary/20 border-secondary text-secondary-bright'
                : 'bg-bg-panel border-border-soft text-fg-secondary hover:border-primary/40'
            }`}
          >
            ⨯ 逆位
          </button>
        </div>
      </div>

      {/* 牌名 */}
      <div className="text-center mb-md">
        <h1 className="font-display text-3xl text-gradient-gold">
          {card.name}
        </h1>
        <div className="caps text-2xs text-fg-faint mt-xs">
          {card.nameEn} · {card.number === 0 ? '0' : card.number}
          {card.zodiac && ` · ${card.zodiac}`}
          {card.element && ` · ${card.element}`}
        </div>
      </div>

      {/* 关键词 */}
      <div className="mb-lg">
        <div className="text-xxs text-fg-faint mb-2 caps">关键词</div>
        <div className="flex flex-wrap gap-1.5 justify-center mb-2">
          {card.keywords.upright.map((k) => (
            <span key={k} className="px-2 py-1 text-xs bg-primary/15 text-primary border border-primary/30 rounded">
              {k}
            </span>
          ))}
        </div>
        {orientation === 'reversed' && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {card.keywords.reversed.map((k) => (
              <span key={k} className="px-2 py-1 text-xs bg-secondary/15 text-secondary-bright border border-secondary/30 rounded">
                {k}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 含义 */}
      <div className="panel p-lg mb-md border-primary/30">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xl ${orientation === 'upright' ? 'text-primary' : 'text-secondary-bright'}`}>
            {orientation === 'upright' ? '✦' : '⨯'}
          </span>
          <span className="caps text-sm text-fg font-medium">
            {orientation === 'upright' ? '正位' : '逆位'} 含义
          </span>
        </div>
        <p className="font-body text-sm text-fg-secondary leading-relaxed">
          {orientation === 'upright' ? card.upright : card.reversed}
        </p>
      </div>

      {/* 什么时候会抽到 */}
      <div className="panel p-md bg-bg-occult">
        <div className="text-xxs text-fg-faint mb-1.5 caps">什么时候会抽到这张牌</div>
        <p className="text-sm text-fg leading-relaxed italic font-body">
          {card.when}
        </p>
      </div>

      {/* CTA */}
      <div className="mt-xl space-y-2">
        <button
          onClick={() => navigate(`/yes-no?question=${encodeURIComponent('请用 ' + card.name + ' 给我一个指引')}`)}
          className="w-full py-3 bg-primary hover:bg-primary-light text-bg-canvas rounded font-medium tracking-wide transition shadow-glow-gold"
        >
          ✦ 用「{card.name}」给我一个指引
        </button>
        <button
          onClick={() => navigate('/cards')}
          className="w-full py-2.5 text-sm text-fg-secondary hover:text-fg transition"
        >
          返回全部 78 张
        </button>
      </div>
    </Layout>
  );
}
