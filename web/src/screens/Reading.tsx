// ============================================================
// screens/Reading.tsx · /reading/:id — AI 解读页
// Phase 1.5 · 第 4 页（最后一步）
// 创建：2026-09-01 · 23:43
//
// 流程：
// - 进入即调 /api/orders/:id/interpret
// - 解读生成中显示 Loading（轮询 5s 一次）
// - 解读生成完渲染：3 段结构（现状/挑战/行动）
// - 底部「追问 ORACLE」按钮（跳 /oracle/:id）
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { CardFace } from '../components/CardFace';
import { ordersApi } from '../lib/api';
import { generateShareCard, downloadShareCard } from '../lib/share-card';

interface Order {
  id: string;
  status: string;
  question: string;
  spread_type?: string;
  spread_name?: string;
  cards: Array<{ id: string; name: string; orientation: 'upright' | 'reversed' | string }>;
  reading?: {
    sections: Array<{ title: string; body: string; emoji?: string }>;
    summary?: string;
  } | null;
  interpreted_at?: string | null;
}

export default function Reading() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [interpreting, setInterpreting] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // 下载分享卡片
  const handleShare = async (template: 'quote' | 'question' | 'mood') => {
    if (!order?.reading) return;
    setSharing(true);
    setShareError(null);
    try {
      const cardName = order.cards[0]?.name;
      const spreadName = order.spread_name || order.spread_type || '塔罗解读';

      // 主题从 spread_type 推断
      const st = order.spread_type || '';
      const theme: 'love' | 'career' | 'money' | 'self' =
        st.startsWith('love') ? 'love' :
        st.startsWith('career') ? 'career' :
        st.startsWith('money') ? 'money' :
        'self';

      // AI 输出的 4 个关键字段：
      // - goldenPhrase: 「## 总结」 section（最后一段）
      // - briefAnswer: 「## 现状分析」前 60 字
      // - atmosphere: 「## 牌阵总览」section（第一段）
      // - summary: 取最后一节 body 前 80 字作为 fallback
      const sections = order.reading.sections || [];
      const findSection = (kw: string) =>
        sections.find(s => (s.title || '').includes(kw)) || sections[sections.length - 1];
      const overviewSec = findSection('总览') || sections[0];
      const statusSec = findSection('现状') || sections[1] || sections[0];
      const summarySec = sections[sections.length - 1] || sections[0];

      const goldenPhrase = (summarySec?.body || '').replace(/\n+/g, ' ').trim().slice(0, 100);
      const briefAnswer = (statusSec?.body || '').replace(/\n+/g, ' ').trim().slice(0, 80);
      const atmosphere = (overviewSec?.body || '').replace(/\n+/g, ' ').trim().slice(0, 120);
      const summary = (summarySec?.body || '').replace(/\n+/g, ' ').trim().slice(0, 80);

      // 牌图 URL（公版 Rider-Waite）
      const cardsWithImg = order.cards.map(c => ({
        id: c.id,
        name: c.name,
        orientation: (c.orientation === 'reversed' ? 'reversed' : 'upright') as 'reversed' | 'upright',
        imageUrl: `/cards/rider-waite/${c.id}.jpg`,
      }));

      const blob = await generateShareCard({
        siteName: 'ARCANA 星语塔罗',
        siteUrl: 'tarot.layershop.store',
        spreadName,
        theme,
        cards: cardsWithImg,
        question: order.question,
        goldenPhrase,
        briefAnswer,
        atmosphere,
        cardName,
        summary,
      }, template);

      const filename = `arcana-${template}-${order.id.slice(0, 8)}.png`;
      downloadShareCard(blob, filename);
    } catch (err: any) {
      setShareError(err.message || '生成失败');
    } finally {
      setSharing(false);
    }
  };

  // 加载订单
  useEffect(() => {
    if (!id) return;
    ordersApi.get(id)
      .then(o => {
        setOrder(o);
        setLoading(false);
        if (!o.reading && o.status === 'paid') {
          startInterpret(o.id);
        }
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [id]);

  // 启动解读
  const startInterpret = async (orderId: string) => {
    setInterpreting(true);
    try {
      await ordersApi.interpret(orderId);
      // 轮询
      let count = 0;
      const timer = setInterval(async () => {
        count++;
        setPollCount(count);
        try {
          const updated = await ordersApi.get(orderId);
          if (updated.reading) {
            setOrder(updated);
            setInterpreting(false);
            clearInterval(timer);
          }
        } catch (e) {}
        if (count >= 30) {
          clearInterval(timer);
          setInterpreting(false);
          setError('解读生成超时，请刷新重试');
        }
      }, 5000);
    } catch (err: any) {
      setError(err.message);
      setInterpreting(false);
    }
  };

  // 追问已迁移到 /oracle/:orderId（删除 mock）

  if (loading) {
    return (
      <Layout size="sm">
        <ScreenHeader back="/spreads" title="加载中" />
        <div className="text-center py-3xl">
          <div className="caps text-fg-faint animate-pulse">读取解读中</div>
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout size="sm">
        <ScreenHeader back="/spreads" title="错误" />
        <div className="panel p-lg border-secondary/30 bg-secondary/5">
          <p className="text-secondary">{error || '订单不存在'}</p>
          <button onClick={() => navigate('/spreads')} className="btn-secondary mt-md">
            返回
          </button>
        </div>
      </Layout>
    );
  }

  const hasReading = !!order.reading;

  return (
    <Layout size="md">
      <ScreenHeader back="/spreads" title="解读" />

      {/* 问题回显 */}
      <div className="panel p-md mb-lg bg-bg-occult text-center">
        <div className="caps text-fg-faint mb-xs">— 关于你的问题 —</div>
        <p className="text-sm text-fg font-body italic leading-relaxed">
          "{order.question}"
        </p>
      </div>

      {/* 牌阵展示（仅已付/已解读） */}
      {order.cards.length > 0 && (
        <div className="mb-lg">
          <div className="caps text-fg-faint text-center mb-sm">— 你抽到的牌 —</div>
          <div className={`grid gap-md ${
            order.cards.length === 1 ? 'grid-cols-1 justify-items-center' :
            order.cards.length === 3 ? 'grid-cols-3' :
            'grid-cols-2'
          }`}>
            {order.cards.slice(0, 3).map((card, i) => (
              <div key={i} className="text-center animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <CardFace card={{ id: card.id, name: card.name, orientation: (card.orientation === 'reversed' ? 'reversed' : 'upright') as 'upright' | 'reversed' }} size="sm" />
                <div className="caps text-2xs text-fg-faint mt-xs">
                  {card.orientation === 'reversed' ? 'Reversed' : 'Upright'}
                </div>
                <div className="text-xs text-fg mt-xs">{card.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 解读内容 */}
      {hasReading ? (
        <div className="space-y-lg animate-fade-in">
          {/* 3 段结构 */}
          {order.reading!.sections.map((s, i) => {
            // 如果标题看起来像卡名（不含中文标点），附上对应卡图
            const card = i < order.cards.length ? order.cards[i] : null;
            return (
              <section key={i} className="panel p-lg">
                <div className="flex items-start gap-md mb-md">
                  {s.emoji && <span className="text-2xl">{s.emoji}</span>}
                  <div className="flex-1">
                    <div className="caps text-2xs text-primary">
                      {'I'.repeat(i + 1)} · {s.title.includes('位置') ? s.title : `第${i + 1}部分`}
                    </div>
                    <h3 className="font-display text-lg text-fg mt-xs">{s.title}</h3>
                  </div>
                  {card && (
                    <div className="shrink-0">
                      <CardFace card={{ id: card.id, name: card.name, orientation: (card.orientation === 'reversed' ? 'reversed' : 'upright') as 'upright' | 'reversed' }} size="sm" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-fg font-body leading-relaxed whitespace-pre-line">
                  {s.body}
                </p>
              </section>
            );
          })}

          {/* 总结 */}
          {order.reading!.summary && (
            <section className="panel p-md bg-bg-occult border-primary/30">
              <div className="caps text-primary mb-xs">— 总结 —</div>
              <p className="text-sm text-fg font-body italic">
                {order.reading!.summary}
              </p>
            </section>
          )}

          {/* 追问 UI（已迁移到 /oracle/:orderId，删除 mock） */}

          {/* 分享 + 下载 */}
          <div className="panel p-lg mt-xl bg-bg-occult border-primary/30">
            <div className="caps text-primary text-center mb-md">— 分享解读 —</div>
            <div className="grid grid-cols-3 gap-sm mb-md">
              <button
                onClick={() => handleShare('quote')}
                disabled={sharing}
                className="panel p-md text-center hover:border-primary transition-colors disabled:opacity-50"
              >
                <div className="text-2xl mb-xs">✦</div>
                <div className="caps text-2xs text-fg">金句型</div>
              </button>
              <button
                onClick={() => handleShare('question')}
                disabled={sharing}
                className="panel p-md text-center hover:border-primary transition-colors disabled:opacity-50"
              >
                <div className="text-2xl mb-xs">？</div>
                <div className="caps text-2xs text-fg">问题型</div>
              </button>
              <button
                onClick={() => handleShare('mood')}
                disabled={sharing}
                className="panel p-md text-center hover:border-primary transition-colors disabled:opacity-50"
              >
                <div className="text-2xl mb-xs">🌙</div>
                <div className="caps text-2xs text-fg">氛围型</div>
              </button>
            </div>
            {sharing && (
              <div className="text-center text-xs text-primary animate-pulse">
                ✦ 生成中…
              </div>
            )}
            {shareError && (
              <div className="text-center text-xs text-secondary">
                {shareError}
              </div>
            )}
          </div>

          {/* 行动按钮 */}
          <div className="grid grid-cols-2 gap-md mt-lg">
            <Button onClick={() => navigate('/spreads')} variant="secondary" size="md">
              ✦ 新的占卜
            </Button>
            <Button onClick={() => navigate(`/oracle/${id}`)} variant="primary" size="md">
              🌙 追问 Oracle
            </Button>
          </div>
          <div className="mt-sm">
            <Button onClick={() => navigate('/dashboard')} variant="ghost" size="sm" fullWidth>
              📜 我的解读
            </Button>
          </div>
        </div>
      ) : (
        // Loading 状态
        <LoadingInterpretation
          interpreting={interpreting}
          pollCount={pollCount}
          cardCount={order.cards.length}
        />
      )}
    </Layout>
  );
}

// === Loading（解读生成中） ===
function LoadingInterpretation({
  interpreting,
  pollCount,
  cardCount,
}: {
  interpreting: boolean;
  pollCount: number;
  cardCount: number;
}) {
  // 5 段进度估算（5s 每段，总 30s+）
  const progress = Math.min(100, (pollCount / 6) * 100);

  return (
    <div className="panel p-2xl text-center bg-bg-occult">
      <div className="relative w-20 h-20 mx-auto mb-lg">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
        <div className="absolute inset-4 rounded-full bg-primary/60" />
      </div>

      <h3 className="font-display text-2xl text-gradient-gold mb-sm">
        AI 正在解读
      </h3>
      <p className="text-xs text-fg-secondary font-body italic mb-lg">
        正在解读 {cardCount} 张牌…
      </p>

      {/* 进度条 */}
      <div className="w-full max-w-xs mx-auto h-1 bg-bg-occult border border-border overflow-hidden mb-sm">
        <div
          className="h-full bg-primary transition-all duration-slow shadow-glow-gold"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="caps text-2xs text-fg-faint">
        {interpreting ? `${pollCount * 5}s · 解读准备中` : '准备解读'}
      </div>

      <p className="text-2xs text-fg-faint mt-lg">
        解读通常需要 15-30 秒
      </p>
    </div>
  );
}