// ============================================================
// screens/Ask.tsx · /ask/:spread — 输入问题 + 牌阵确认
// Phase 1.5 · 第 1 页（抽牌→解读 链路起点）
// 创建：2026-09-01
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { spreadsApi, ordersApi, authApi, membershipApi } from '../lib/api';

interface Spread {
  id: string;
  name: string;
  theme: string;
  cards: number;
  tier_required: string;
  price: number;
  positions?: string[];
}

const THEME_SYMBOL: Record<string, string> = {
  love: '💞', career: '💼', money: '💰', self: '🌙',
};

function getDeviceId(): string {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('device_id', id);
  }
  return id;
}

export default function Ask() {
  const navigate = useNavigate();
  const { spread: spreadId } = useParams<{ spread: string }>();

  const [spread, setSpread] = useState<Spread | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<string>('guest');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      authApi.me().catch(() => null),
      membershipApi.status().catch(() => null),
    ]).then(([u, m]: any[]) => {
      setUser(u?.user || null);
      setTier(m?.tier || 'guest');
    });
  }, []);

  useEffect(() => {
    if (!spreadId) return;
    spreadsApi.get(spreadId)
      .then(s => { setSpread(s); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [spreadId]);

  const handleSubmit = async () => {
    if (!spread) return;
    if (!question.trim()) {
      setError('请描述你的问题');
      return;
    }
    if (question.length > 500) {
      setError('问题太长（500字以内）');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // tier 映射：仅映射 1/3/10 牌。5/7 牌走 spread.id 自己的定义。
      // Bug fix 2026-09-03：原来「不是 1/3 就映射 ten」会让 5 牌变成 10 牌
      const tier = spread.cards === 1 ? 'single' : spread.cards === 3 ? 'three' : spread.cards === 10 ? 'ten' : 'custom';
      const result = await ordersApi.create({
        spread_type: spread.id,
        spread_theme: spread.theme,
        question: question.trim(),
        tier,
        device_id: getDeviceId(),
      });
      // 会员：afdianPayUrl=null，直接跳 draw
      // 非会员：同步 window.open 跳转爱发电付乾
      if (result.afdianPayUrl) {
        const win = window.open('about:blank', '_blank');
        if (win) win.location.href = result.afdianPayUrl;
        else window.location.href = result.afdianPayUrl;
      }
      // 跳到抽牌动画
      navigate(`/draw/${result.orderId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout size="sm">
        <ScreenHeader back="/spreads" title="加载中" />
        <div className="text-center py-3xl text-fg-faint">
          <div className="caps">加载牌阵信息</div>
        </div>
      </Layout>
    );
  }

  if (error && !spread) {
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

  if (!spread) return null;

  return (
    <Layout size="sm">
      <ScreenHeader back="/spreads" title="提问" />

      {/* 牌阵信息卡 */}
      <div className="panel p-lg mb-xl text-center">
        <div className="text-3xl mb-sm">{THEME_SYMBOL[spread.theme] || '✦'}</div>
        <h1 className="font-display text-2xl text-fg mb-xs">
          {spread.name}
        </h1>
        <div className="caps text-fg-faint mb-md">
          {spread.cards} 张牌 · {spread.theme.toUpperCase()}
        </div>

        {/* 位置说明（如有） */}
        {spread.positions && spread.positions.length > 0 && (
          <div className="border-t border-border pt-md mt-md">
            <div className="caps text-fg-faint mb-xs">位置</div>
            <div className="text-xs text-fg-secondary font-body leading-relaxed">
              {spread.positions.join(' · ')}
            </div>
          </div>
        )}

        {/* 价格 */}
        <div className="flex justify-center items-baseline gap-md mt-md">
          {tier === 'silver' || tier === 'gold' ? (
            <>
              <span className="caps text-sm text-gradient-gold font-body font-bold">
                ✦ {tier === 'gold' ? '金月' : '银月'}会员专享
              </span>
              <span className="caps text-2xs text-fg-faint line-through opacity-50">
                ¥{spread.price}
              </span>
              <span className="caps text-2xs text-primary font-bold">
                免费
              </span>
            </>
          ) : (
            <>
              <span className="num-display text-2xl text-primary">¥{spread.price}</span>
              <span className="caps text-2xs text-fg-faint">
                {spread.tier_required === 'registered' ? '注册用户' : `需 ${spread.tier_required.toUpperCase()}`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 问题输入 */}
      <div className="mb-lg">
        <label className="caps block mb-xs text-fg-faint">
          — 你想问什么 —
        </label>
        <textarea
          className="input min-h-[140px] resize-none"
          placeholder="例如：&#10;· 我和他现在的关系是怎样的？&#10;· 这份工作是否值得继续？&#10;· 我该如何做出选择？"
          maxLength={500}
          value={question}
          onChange={e => setQuestion(e.target.value)}
        />
        <div className="flex justify-between mt-xs">
          <div className="caps text-2xs text-fg-faint">
            问题越具体，解读越准确
          </div>
          <div className="caps text-2xs text-fg-faint">
            {question.length} / 500
          </div>
        </div>
      </div>

      {/* 提示 */}
      <div className="panel p-md bg-bg-occult mb-lg">
        <div className="caps text-primary mb-xs">— 流程说明 —</div>
        <ul className="text-xs text-fg-secondary font-body space-y-xs">
          <li>· 确认问题后进入抽牌仪式（3 秒）</li>
          <li>· 系统抽牌 → 进入牌阵展示页</li>
          <li>· 付费解锁完整 AI 解读</li>
        </ul>
      </div>

      {/* 错误 */}
      {error && (
        <div className="text-sm text-secondary text-center border border-secondary/30 bg-secondary/5 px-md py-sm mb-md">
          {error}
        </div>
      )}

      {/* 提交 */}
      <Button onClick={handleSubmit} loading={submitting} fullWidth size="lg">
        {tier === 'silver' || tier === 'gold' ? '✦ 免费抽牌 · 直接解读' : '✦ 确认 · 进入抽牌仪式'}
      </Button>

      {/* 安全网 */}
      <div className="text-center mt-md">
        <p className="text-xs text-fg-faint">
          {tier === 'silver' || tier === 'gold'
            ? '会员订阅期间内无限解读，无额外费用'
            : '提交后将创建订单，但还未支付 · 随时可取消'}
        </p>
      </div>
    </Layout>
  );
}
