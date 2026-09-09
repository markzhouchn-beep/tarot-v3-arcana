// ============================================================
// screens/Spread.tsx · /spread/:id — 牌阵展示 + 付费墙
// Phase 1.5 · 第 3 页
// 创建：2026-09-01 · 23:42（v3.0.1 重写：跳爱发电真页面 + 轮询）
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { CardFace } from '../components/CardFace';
import { ordersApi } from '../lib/api';

interface Order {
  id: string;
  status: string;
  question: string;
  spread_type: string;
  spread_name?: string;
  payUrl?: string;
  payment_method?: string;
  cards: Array<{
    id: string;
    name: string;
    orientation: string;
    position: string;
    keywords_up?: string[];
    keywords_down?: string[];
  }>;
  amount: number;
  paid_at?: string | null;
}

export default function Spread() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<any>(null);

  useEffect(() => {
    if (!id) return;
    ordersApi.get(id)
      .then(o => {
        // payUrl 从 sessionStorage 中转回来（创建时不存数据库）
        const storedPayUrl = sessionStorage.getItem(`payUrl_${id}`);
        if (storedPayUrl) {
          o.payUrl = storedPayUrl;
          sessionStorage.removeItem(`payUrl_${id}`);
        }
        setOrder(o);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  // PayPal 回跳后刷新订单状态
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') === 'paypal') {
      // 清理 URL，避免刷新后又触发
      window.history.replaceState({}, '', window.location.pathname);
      // 重新拉订单
      ordersApi.get(id!)
        .then(o => { setOrder(o); setLoading(false); })
        .catch(() => {});
    }
  }, [id]);

  // PD v0.8：「我已支付」→ 调 reconcile（调爱发电 query-order 核实）
  const handleReconcile = async () => {
    if (!order) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await ordersApi.reconcile(order.id);
      if (res.status === 'paid' || res.already || res.status === 'interpreted') {
        if (pollRef.current) clearInterval(pollRef.current);
        setPolling(false);
        navigate(`/reading/${order.id}`);
      } else if (res.status === 'still_pending') {
        setError('爱发电未查询到该订单，请确认支付状态后重试');
      } else {
        setError(res.message || '核实失败，请稍候重试');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // 跳 PayPal 收银台
  const handlePay = () => {
    if (!order) return;
    const payUrl = order.payUrl;
    if (!payUrl) {
      setError('支付链接未生成，请刷新页面重试');
      return;
    }
    // 直接跳转，PayPal 付款后会回跳 /paypal/return，然后 redirect 回这里
    window.location.href = payUrl;
  };

  const startPolling = () => {
    if (!order || polling) return;
    setPolling(true);
    setPollCount(0);
    let count = 0;
    pollRef.current = setInterval(async () => {
      count++;
      setPollCount(count);
      try {
        const res = await ordersApi.reconcile(order.id);
        if (res.status === 'paid' || res.already || res.status === 'interpreted') {
          clearInterval(pollRef.current);
          setPolling(false);
          navigate(`/reading/${order.id}`);
        } else if (count >= 72) {
          clearInterval(pollRef.current);
          setPolling(false);
          setError('轮询超时（6 分钟），请点击"我已支付·重新核实"手动重试');
        }
      } catch (e) {
        // 单次失败不退出轮询
      }
    }, 5000);
  };

  if (loading) {
    return (
      <Layout size="sm">
        <ScreenHeader back="/spreads" title="加载中" />
        <div className="text-center py-3xl">
          <div className="caps text-fg-faint animate-pulse">牌阵展开中</div>
        </div>
      </Layout>
    );
  }

  if (error && !order) {
    return (
      <Layout size="sm">
        <ScreenHeader back="/spreads" title="错误" />
        <div className="panel p-lg border-secondary/30 bg-secondary/5">
          <p className="text-secondary">{error}</p>
          <button onClick={() => navigate('/spreads')} className="btn-secondary mt-md">
            返回牌阵选择
          </button>
        </div>
      </Layout>
    );
  }

  if (!order) return null;

  const isPaid = order.status === 'paid' || order.status === 'interpreted' || order.status === 'completed';

  return (
    <Layout size="md">
      <ScreenHeader back="/spreads" title={isPaid ? '你的牌阵' : '你的牌阵 · 解锁解读'} />

      {/* 问题回显 */}
      <div className="panel p-md mb-lg bg-bg-occult">
        <div className="caps text-fg-faint mb-xs">— 你的问题 —</div>
        <p className="text-sm text-fg font-body italic leading-relaxed">
          "{order.question}"
        </p>
      </div>

      {/* 牌阵展示区 */}
      <div className="mb-lg">
        <div className={`grid gap-md mb-md ${
          order.cards.length === 1 ? 'grid-cols-1 justify-items-center' :
          order.cards.length === 3 ? 'grid-cols-3' :
          order.cards.length <= 5 ? 'grid-cols-3' :
          'grid-cols-2'
        }`}>
          {order.cards.map((card, i) => (
            <CardWithPosition
              key={card.id + i}
              card={card}
              position={card.position || `位置 ${i + 1}`}
              blurred={!isPaid}
            />
          ))}
        </div>
      </div>

      {/* 解读区（已付） / 付费墙（未付） */}
      {isPaid ? (
        <div className="text-center mt-xl">
          <Button
            onClick={() => navigate(`/reading/${order.id}`)}
            variant="primary"
            size="lg"
            fullWidth
          >
            ✦ 查看完整 AI 解读
          </Button>
          <p className="caps text-2xs text-fg-faint mt-md">
            AI 解读约 30 秒生成
          </p>
        </div>
      ) : (
        <Paywall
          orderId={order.id}
          amount={order.amount}
          onPay={handlePay}
          onReconcile={handleReconcile}
          processing={processing}
          polling={polling}
          pollCount={pollCount}
          error={error}
        />
      )}
    </Layout>
  );
}

// === 单卡 + 位置标签 ===
function CardWithPosition({
  card,
  position,
  blurred,
}: {
  card: { id: string; name: string; orientation: string; keywords_up?: string[]; keywords_down?: string[] };
  position: string;
  blurred: boolean;
}) {
  // 后端返英文 'upright' | 'reversed'（tarot-knowledge.js:214），不要和中文 '正位' 比较
  const orientation = card.orientation === 'reversed' ? 'reversed' : 'upright';
  const keywords = orientation === 'upright' ? card.keywords_up : card.keywords_down;

  return (
    <div className="text-center animate-fade-in" style={{ animationDelay: `${Math.random() * 300}ms` }}>
      <div className="caps text-2xs text-fg-faint mb-xs">{position}</div>
      <div className={`relative inline-block ${blurred ? 'blur-md opacity-60' : ''} transition-all duration-slow`}>
        <CardFace card={{ id: card.id, name: card.name, orientation }} size="sm" />
      </div>
      {!blurred && (
        <div className="mt-sm">
          <div className="font-display text-sm text-fg">{card.name}</div>
          <div className="caps text-2xs text-fg-faint">
            {orientation === 'upright' ? '正位' : '逆位'}
          </div>
          {keywords && keywords.length > 0 && (
            <div className="text-2xs text-fg-secondary mt-xs font-body">
              {keywords.slice(0, 3).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// === 付费墙（未付状态） ===
function Paywall({
  orderId,
  amount,
  onPay,
  onReconcile,
  processing,
  polling,
  pollCount,
  error,
}: {
  orderId: string;
  amount: number;
  onPay: () => void;
  onReconcile: () => void;
  processing: boolean;
  polling: boolean;
  pollCount: number;
  error: string | null;
}) {
  return (
    <div className="panel p-lg border-primary/40 bg-bg-occult mt-xl">
      <div className="text-center mb-md">
        <div className="text-2xl mb-xs">✦</div>
        <h3 className="font-display text-xl text-gradient-gold mb-xs">解锁完整 AI 解读</h3>
        <p className="text-xs text-fg-secondary font-body">
          AI 将结合你的问题与每张牌的含义，给你完整解读
        </p>
      </div>

      <div className="text-center mb-lg">
        <div className="caps text-2xs text-fg-faint mb-xs">— 本次解读 —</div>
        <div className="num-display text-3xl text-primary">¥{amount.toFixed(1)}</div>
      </div>

      <ul className="text-xs text-fg-secondary font-body space-y-xs mb-lg">
        <li>· 3 段式深度解读（现状 · 挑战 · 行动）</li>
        <li>· 每张牌的象征意义与位置含义</li>
        <li>· 3 次免费追问机会</li>
        <li>· 解读永久保存（会员后台可查）</li>
      </ul>

      {/* 主按钮：跳 PayPal */}
      <Button onClick={onPay} variant="primary" size="lg" fullWidth loading={processing}>
        💎 立即解锁 · 跳转 PayPal
      </Button>

      {/* 错误提示 */}
      {error && (
        <div className="panel p-md border-secondary/40 bg-secondary/10 mt-md text-center">
          <div className="text-xs text-secondary">{error}</div>
        </div>
      )}

      <div className="caps text-2xs text-fg-faint text-center mt-md">
        安全支付 · 由 PayPal 提供保障
      </div>
    </div>
  );
}