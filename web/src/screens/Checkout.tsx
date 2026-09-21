// ============================================================
// screens/Checkout.tsx · /checkout/:type — 单次付费（不走会员）
// v3.1 · 2026-09-21
// 新增：支付方式选择（PayPal / 支付宝）
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { ordersApi, detectCountry } from '../lib/api';

const PRODUCTS = [
  { id: 'single', label: '单张牌阵', price: 1, cards: 1 },
  { id: 'three', label: '三张牌阵', price: 1.9, cards: 3 },
  { id: 'ten', label: '十张牌阵', price: 9.9, cards: 10 },
];

function getDeviceId(): string {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('device_id', id);
  }
  return id;
}

type PayMethod = 'paypal' | 'alipay';

export default function Checkout() {
  const navigate = useNavigate();
  const { type } = useParams<{ type: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>('paypal');
  const product = PRODUCTS.find(p => p.id === type);

  // 根据 IP 国家自动推荐支付方式（CN/HK/MO → 支付宝，其他 → PayPal）
  useEffect(() => {
    detectCountry().then((country) => {
      if (country === 'CN' || country === 'HK' || country === 'MO') {
        setPayMethod('alipay');
      } else {
        setPayMethod('paypal');
      }
    }).catch(() => { /* keep default */ });
  }, []);

  if (!product) {
    return (
      <Layout size="sm">
        <ScreenHeader back="/spreads" title="错误" />
        <div className="panel p-lg border-secondary/30 bg-secondary/5">
          <p className="text-secondary">未知套餐</p>
          <button onClick={() => navigate('/spreads')} className="btn-secondary mt-md">
            返回
          </button>
        </div>
      </Layout>
    );
  }

  const handleBuy = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await ordersApi.create({
        spread_type: 'single',
        spread_theme: 'self',
        question: '（单次购买占位问题）',
        tier: product.id,
        device_id: getDeviceId(),
        payment_method: payMethod,
      });
      // payUrl 中转：创建时存 sessionStorage，Spread 页面读取
      if (result.payUrl) {
        sessionStorage.setItem(`payUrl_${result.orderId}`, result.payUrl);
      }
      navigate(`/spread/${result.orderId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout size="sm">
      <ScreenHeader back="/spreads" title="购买" />

      <div className="panel p-lg text-center mb-lg">
        <div className="text-3xl mb-xs">✦</div>
        <h1 className="font-display text-2xl text-gradient-gold mb-sm">{product.label}</h1>
        <div className="caps text-fg-faint mb-md">{product.cards} 张牌解读</div>
        <div className="num-display text-4xl text-primary">¥{product.price}</div>
        <div className="caps text-2xs text-fg-faint mt-xs">单次付费 · 永久保存</div>
      </div>

      <ul className="text-xs text-fg-secondary font-body space-y-xs mb-lg">
        <li>· 完整 AI 解读（3 段式）</li>
        <li>· 3 次免费追问</li>
        <li>· 解读永久保存（会员后台可查）</li>
        <li>· 不开通会员也能用</li>
      </ul>

      {/* 支付方式选择 */}
      <div className="mb-md">
        <div className="caps text-2xs text-fg-faint mb-xs">选择支付方式</div>
        <div className="grid grid-cols-2 gap-sm">
          <button
            onClick={() => setPayMethod('paypal')}
            className={`panel p-md text-center transition-all ${
              payMethod === 'paypal'
                ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                : 'border-border opacity-60 hover:opacity-100'
            }`}
          >
            <div className="text-2xl mb-xs">💳</div>
            <div className="text-sm font-medium">PayPal</div>
            <div className="text-xxs text-fg-faint mt-xs">信用卡 / 余额</div>
          </button>
          <button
            onClick={() => setPayMethod('alipay')}
            className={`panel p-md text-center transition-all ${
              payMethod === 'alipay'
                ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                : 'border-border opacity-60 hover:opacity-100'
            }`}
          >
            <div className="text-2xl mb-xs">🅿️</div>
            <div className="text-sm font-medium">支付宝</div>
            <div className="text-xxs text-fg-faint mt-xs">手机网站支付</div>
          </button>
        </div>
      </div>

      {error && (
        <div className="panel p-md border-secondary/30 bg-secondary/5 mb-md text-sm text-secondary text-center">
          {error}
        </div>
      )}

      <Button onClick={handleBuy} variant="primary" size="lg" fullWidth loading={submitting}>
        {payMethod === 'alipay' ? '🅿️ 立即购买 · 跳转支付宝' : '💎 立即购买 · 跳转 PayPal'}
      </Button>

      {/* 信任标识 */}
      <div className="mt-md flex items-center justify-center gap-sm text-xxs text-fg-faint">
        <span className="inline-flex items-center gap-xs">
          <span className="text-secondary">🛡️</span>
          <span>
            {payMethod === 'alipay'
              ? '由支付宝提供安全支付保障'
              : '由 PayPal 提供安全支付保障'}
          </span>
        </span>
      </div>
      <div className="caps text-2xs text-fg-faint text-center mt-xs">
        {payMethod === 'alipay'
          ? '支持余额 / 花呗 / 银行卡 · 支付完成自动返回'
          : '支持信用卡 · PayPal 余额 · 支付完成自动返回'}
      </div>
    </Layout>
  );
}