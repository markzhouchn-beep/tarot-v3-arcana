// ============================================================
// screens/Draw.tsx · /draw/:order_id — 抽牌动画（3 秒仪式感）
// Phase 1.5 · 第 2 页（输入问题后，跳此页抽牌）
// 创建：2026-09-01
//
// 动画流程（CSS keyframes 实现，无 framer-motion）：
// 1. 洗牌（0-1s）→ 牌堆左右晃动
// 2. 切牌（1-2s）→ 牌堆快速展开
// 3. 翻牌（2-3s）→ 抽到的牌从牌背翻到正面
// 4. 自动跳转 /spread/:id
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { CardBack } from '../components/CardBack';
import { CardFace } from '../components/CardFace';
import { ordersApi } from '../lib/api';

interface Order {
  id: string;
  status: string;
  question: string;
  cards: Array<{ id: string; name: string; orientation: string }>;
  spread_type: string;
}

type Phase = 'shuffle' | 'cut' | 'flip' | 'done';

const PHASE_DURATION = {
  shuffle: 1000,
  cut: 1000,
  flip: 1000,
};

const PHASE_TEXT = {
  shuffle: { title: '洗 牌', body: '默念你的问题' },
  cut:     { title: '切 牌', body: '准备抽牌' },
  flip:    { title: '翻 牌', body: '准备看结果' },
};

export default function Draw() {
  const navigate = useNavigate();
  const params = useParams();
  const orderId = params.order_id || params.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [phase, setPhase] = useState<Phase>('shuffle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    ordersApi.get(orderId)
      .then(o => setOrder(o))
      .catch(err => setError(err.message));
  }, [orderId]);

  // 抽牌动画时序
  useEffect(() => {
    let timer: any;
    const tick = () => {
      setPhase(p => {
        if (p === 'shuffle') { timer = setTimeout(tick, PHASE_DURATION.shuffle); return 'cut'; }
        if (p === 'cut')     { timer = setTimeout(tick, PHASE_DURATION.cut);     return 'flip'; }
        if (p === 'flip')    { timer = setTimeout(tick, PHASE_DURATION.flip);    return 'done'; }
        if (p === 'done') {
          // 跳转到牌阵展示页
          if (orderId) navigate(`/spread/${orderId}`);
          return 'done';
        }
        return p;
      });
    };
    timer = setTimeout(tick, PHASE_DURATION.shuffle);
    return () => clearTimeout(timer);
  }, [orderId, navigate]);

  // 进度条
  useEffect(() => {
    const totalMs = PHASE_DURATION.shuffle + PHASE_DURATION.cut + PHASE_DURATION.flip;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(100, (elapsed / totalMs) * 100));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <Layout size="sm">
        <div className="text-center py-3xl">
          <p className="text-secondary mb-md">{error}</p>
          <button onClick={() => navigate('/spreads')} className="btn-secondary">
            返回牌阵选择
          </button>
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout size="sm">
        <div className="text-center py-3xl">
          <div className="caps text-fg-faint animate-pulse">准备中</div>
        </div>
      </Layout>
    );
  }

  if (phase === 'done') {
    return (
      <Layout size="sm">
        <div className="text-center py-3xl">
          <div className="caps text-fg-faint animate-pulse">牌阵展开中</div>
        </div>
      </Layout>
    );
  }

  const isFlipped = phase === 'flip';

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-md">
      {/* 装饰光球（强化仪式感） */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="orb animate-orb-breathe"
          style={{
            width: '600px', height: '600px',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(200, 152, 91, 0.25) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* 屏顶小标 */}
      <div className="relative z-10 caps text-fg-faint mb-lg">
        — {order.cards.length} 张牌仪式 —
      </div>

      {/* 牌堆 / 翻牌区 */}
      <div className="relative z-10 flex items-center justify-center mb-2xl" style={{ minHeight: 320 }}>
        {phase === 'shuffle' && <ShuffleStack count={order.cards.length} />}
        {phase === 'cut' && <CutStack count={order.cards.length} />}
        {phase === 'flip' && (
          <FlippedCards cards={order.cards} />
        )}
      </div>

      {/* 文案 + 进度 */}
      <div className="relative z-10 w-full max-w-md text-center">
        {phase in PHASE_TEXT && (
          <>
            <h2 className="font-display text-3xl text-gradient-gold mb-sm">
              {PHASE_TEXT[phase as keyof typeof PHASE_TEXT].title}
            </h2>
            <p className="text-sm text-fg-secondary font-body italic mb-lg">
              {PHASE_TEXT[phase as keyof typeof PHASE_TEXT].body}
            </p>

            {/* 进度条 */}
            <div className="w-full h-1 bg-bg-occult border border-border overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-100 ease-linear shadow-glow-gold"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="caps text-2xs text-fg-faint mt-xs">
              {Math.round(progress)}% · 解读准备中
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// === 洗牌：3 张牌快速左右晃动 ===
function ShuffleStack({ count }: { count: number }) {
  return (
    <div className="flex">
      {[...Array(Math.min(count + 2, 5))].map((_, i) => (
        <div
          key={i}
          className="animate-shuffle"
          style={{
            marginLeft: i === 0 ? 0 : '-50px',
            animationDelay: `${i * 100}ms`,
          }}
        >
          <CardBack size="md" />
        </div>
      ))}
    </div>
  );
}

// === 切牌：牌堆快速散开 ===
function CutStack({ count }: { count: number }) {
  return (
    <div className="flex">
      {[...Array(Math.min(count + 2, 5))].map((_, i) => (
        <div
          key={i}
          className="animate-cut"
          style={{
            marginLeft: i === 0 ? 0 : '-60px',
            animationDelay: `${i * 80}ms`,
          }}
        >
          <CardBack size="md" />
        </div>
      ))}
    </div>
  );
}

// === 翻牌：横排展示抽到的牌 ===
function FlippedCards({ cards }: { cards: Array<{ id: string; name: string; orientation: string }> }) {
  return (
    <div className={`flex flex-wrap justify-center gap-md animate-fade-in`}>
      {cards.map((c, i) => (
        <div
          key={c.id + i}
          className="animate-draw-card"
          style={{ animationDelay: `${i * 200}ms`, animationFillMode: 'both' }}
        >
          <CardFace
            card={{
              id: c.id,
              name: c.name,
              orientation: c.orientation === 'reversed' ? 'reversed' : 'upright',
            }}
            size={cards.length > 3 ? 'sm' : 'md'}
          />
        </div>
      ))}
    </div>
  );
}
