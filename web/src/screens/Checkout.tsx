// ============================================================
// screens/Checkout.tsx · /checkout/:type — 单次付费（不走会员）
// Phase 1.6 · 直接买 1 次单牌 / 三张 / 十张
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { ordersApi } from '../lib/api';

const PRODUCTS = [
  { id: 'single', label: '单张牌阵', sku: 'AFDIAN_SKU_SINGLE', price: 1, cards: 1 },
  { id: 'three', label: '三张牌阵', sku: 'AFDIAN_SKU_THREE', price: 1.9, cards: 3 },
  { id: 'ten', label: '十张牌阵', sku: 'AFDIAN_SKU_TEN', price: 9.9, cards: 10 },
];

function getDeviceId(): string {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('device_id', id);
  }
  return id;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { type } = useParams<{ type: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const product = PRODUCTS.find(p => p.id === type);

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
      });
      // 跳 spread 等待解读，后端返回的 afdian_pay_url 会被 Spread 读取并跳转
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

      {error && (
        <div className="panel p-md border-secondary/30 bg-secondary/5 mb-md text-sm text-secondary text-center">
          {error}
        </div>
      )}

      <Button onClick={handleBuy} variant="primary" size="lg" fullWidth loading={submitting}>
        💎 立即购买 · 跳转爱发电
      </Button>

      {/* 信任标识 */}
      <div className="mt-md flex items-center justify-center gap-sm text-xxs text-fg-faint">
        <span className="inline-flex items-center gap-xs">
          <span className="text-secondary">🛡️</span>
          <span>由爱发电 afdian.net 担保支付</span>
        </span>
      </div>
      <div className="caps text-2xs text-fg-faint text-center mt-xs">
        支持微信 · 支付宝 · 支付完成自动返回
      </div>
    </Layout>
  );
}