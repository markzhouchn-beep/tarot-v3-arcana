// ============================================================
// screens/Spread.tsx · /spread/:id — 牌阵展示 + 付费墙
// Phase 1.5 · 第 3 页
// 创建：2026-09-01 · 23:42（v3.0.1 重写：跳支付宝/PayPal + 主动 reconcile）
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
  payForm?: string; // v3.0.5：支付宝 HTML form（POST 提交）
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
    // v3.0.4：payUrl 改由服务端 GET /api/orders/:id 每次返回最新（避免旧签名 sessionStorage 缓存导致 invalid-signature）
    ordersApi.get(id)
      .then(o => {
        setOrder(o);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  // PayPal / 支付宝 回跳后刷新订单状态
  // v3.0.7：支付宝 return_url 不再带自定义参数（支付宝要求）
  // 直接在 Spread 页面触发 reconciliation（最多 3 次，间隔 2s）
  useEffect(() => {
    if (!order || order.status !== 'pending') return;
    if (order.payment_method !== 'alipay') return;

    let attempts = 0;
    const tryReconcile = () => {
      attempts++;
      ordersApi.reconcileAlipay(id!)
        .then(res => {
          if (res.status === 'paid' || res.ok) {
            ordersApi.get(id!).then(o => { setOrder(o); setLoading(false); }).catch(() => {});
          } else if (attempts < 3) {
            setTimeout(tryReconcile, 2000);
          } else {
            setError('支付确认中...若已完成支付请手动刷新');
          }
        })
        .catch(() => {
          if (attempts < 3) setTimeout(tryReconcile, 2000);
        });
    };
    tryReconcile();
  }, [order?.id, order?.status, order?.payment_method]);

  // PayPal/Alipay：浏览器回跳自动激活；无需客户端 reconcile
  const handleReconcile = async () => {
    if (!order) return;
    if (order.payment_method === 'paypal') {
      setError('PayPal 付款后页面会自动跳转，如未跳转请稍后刷新本页面');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      // 支付宝：用 /api/alipay/query 主动查询
      if (order.payment_method === 'alipay') {
        const res = await ordersApi.reconcileAlipay(order.id);
        if (res.status === 'paid' || res.ok) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          navigate(`/reading/${order.id}`);
        } else if (res.status === 'cancelled') {
          setError('订单已关闭，如需继续请重新下单');
        } else {
          setError('支付宝尚未查到该订单，请确认支付状态后重试');
        }
        setProcessing(false);
        return;
      }
      // PayPal：浏览器回跳会自动激活，无需客户端主动 reconcile
      // 仅提示用户等待页面自动刷新
      setError('PayPal 付款后页面会自动跳转，如未跳转请稍后刷新本页面');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // 跳支付收银台
  const handlePay = () => {
    if (!order) return;
    // v3.0.6：支付宝用服务端 302 重定向（浏览器跳短链 → 服务端查订单重签 → 302 到支付宝）
    if (order.payment_method === 'alipay') {
      window.location.href = `/api/alipay/go?id=${order.id}`;
      return;
    }
    // PayPal：跳转 approval URL，付款后会回跳 /paypal/return
    const payUrl = order.payUrl;
    if (!payUrl) {
      setError('支付链接未生成，请刷新页面重试');
      return;
    }
    window.location.href = payUrl;
  };

  const startPolling = () => {
    // 2026-09-21：支付宝 query 已替代轮询，无需再起 setInterval
    // 用户回跳后由 useEffect 自动触发一次 reconcileAlipay
    if (!order || polling) return;
    setPolling(true);
    setPollCount(1);
    // 兜底：如果 60s 内没有支付确认，给一个温和提示
    setTimeout(() => {
      if (polling) {
        setError('等待支付确认中...如已完成支付请手动刷新页面');
      }
    }, 60000);
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
          paymentMethod={order.payment_method || 'paypal'}
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
  paymentMethod,
  onPay,
  onReconcile,
  processing,
  polling,
  pollCount,
  error,
}: {
  orderId: string;
  amount: number;
  paymentMethod: string;
  onPay: () => void;
  onReconcile: () => void;
  processing: boolean;
  polling: boolean;
  pollCount: number;
  error: string | null;
}) {
  const isAlipay = paymentMethod === 'alipay';

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

      {/* 主按钮：根据支付方式显示 */}
      <Button onClick={onPay} variant="primary" size="lg" fullWidth loading={processing}>
        {isAlipay ? '🅿️ 立即解锁 · 跳转支付宝' : '💎 立即解锁 · 跳转 PayPal'}
      </Button>

      {/* 错误提示 */}
      {error && (
        <div className="panel p-md border-secondary/40 bg-secondary/10 mt-md text-center">
          <div className="text-xs text-secondary">{error}</div>
        </div>
      )}

      {/* 手动核实按钮（轮询超时 / 回跳失败时用） */}
      {(polling || processing) && (
        <button
          onClick={onReconcile}
          className="w-full mt-sm text-xs text-primary underline"
        >
          我已支付 · 重新核实
        </button>
      )}

      <div className="caps text-2xs text-fg-faint text-center mt-md">
        安全支付 · 由 {isAlipay ? '支付宝' : 'PayPal'} 提供保障
      </div>
    </div>
  );
}