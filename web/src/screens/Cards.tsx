// ============================================================
// screens/Cards.tsx · /cards — 78 张塔罗牌列表
// 创建：2026-09-06
// 数据源：../data/cards.ts
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { CardFace } from '../components/CardFace';
import { ALL_CARDS, ARCANA_META, type Arcana } from '../data/cards';

const ARCANAS: Arcana[] = ['major', 'wands', 'cups', 'swords', 'pentacles'];

export default function Cards() {
  const navigate = useNavigate();
  const [activeArcana, setActiveArcana] = useState<Arcana>('major');

  return (
    <Layout size="lg">
      <div className="flex items-center justify-between mb-lg">
        <button
          onClick={() => navigate('/')}
          className="text-fg-faint hover:text-primary text-sm"
        >
          ← 返回首页
        </button>
        <h1 className="font-display text-xl text-gradient-gold">塔罗百科</h1>
        <span className="text-xxs text-fg-faint">78 张</span>
      </div>

      <p className="text-sm text-fg-secondary text-center mb-lg font-body italic">
        78 张塔罗牌完整含义 · 点击任意牌查看正逆位解读
      </p>

      {/* 花色 Tab */}
      <div className="flex gap-1 mb-lg bg-bg-occult rounded p-1 overflow-x-auto">
        {ARCANAS.map((a) => (
          <button
            key={a}
            onClick={() => setActiveArcana(a)}
            className={`flex-1 min-w-fit px-3 py-2 text-xs rounded transition whitespace-nowrap ${
              activeArcana === a
                ? 'bg-primary text-bg-canvas font-medium'
                : 'text-fg-secondary hover:text-fg'
            }`}
          >
            {ARCANA_META[a].symbol} {ARCANA_META[a].name}
          </button>
        ))}
      </div>

      {/* 牌列表 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-md">
        {ALL_CARDS.filter(c => c.arcana === activeArcana).map((card) => (
          <button
            key={card.id}
            onClick={() => navigate(`/cards/${card.id}`)}
            className="panel p-md text-center hover:border-primary hover:shadow-glow-gold transition group"
          >
            <div className="flex justify-center mb-xs">
              <CardFace
                card={{ id: card.id, name: card.name, orientation: 'upright' }}
                size="sm"
                faceUp
              />
            </div>
            <div className="font-display text-sm text-fg group-hover:text-primary transition">
              {card.name}
            </div>
            <div className="text-xxs text-fg-faint mt-0.5">
              {card.number === 0 ? '0' : card.number} · {card.keywords.upright[0]}
            </div>
          </button>
        ))}
      </div>

      <div className="caps text-2xs text-fg-faint text-center mt-xl">
        内容来源：经典韦特塔罗 · AI 辅助整理
      </div>
    </Layout>
  );
}
