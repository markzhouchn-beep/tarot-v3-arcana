// ============================================================
// screens/Ask.tsx · /ask/:spread — 提问 + 立即抽
// v3.0.4 (2026-09-07): 简化结构，上面提问下面立即抽
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  love: '💞', career: '💼', money: '💰', self: '🌙', all: '✦',
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
  const [searchParams] = useSearchParams();

  const [spread, setSpread] = useState<Spread | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<string>('guest');
  const [user, setUser] = useState<any>(null);

  const prefilledQuestion = searchParams.get('question') || '';

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

  // 预填问题
  useEffect(() => {
    if (prefilledQuestion) setQuestion(prefilledQuestion);
  }, [prefilledQuestion]);

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
      const tier = spread.cards === 1 ? 'single' : spread.cards === 3 ? 'three' : spread.cards === 10 ? 'ten' : 'custom';
      const result = await ordersApi.create({
        spread_type: spread.id,
        spread_theme: spread.theme,
        question: question.trim(),
        tier,
        device_id: getDeviceId(),
      });
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
        <ScreenHeader back="/" title="加载中" />
        <div className="text-center py-3xl text-fg-faint">
          <div className="caps">加载牌阵信息</div>
        </div>
      </Layout>
    );
  }

  if (error && !spread) {
    return (
      <Layout size="sm">
        <ScreenHeader back="/" title="错误" />
        <div className="panel p-lg border-secondary/30 bg-secondary/5">
          <p className="text-secondary">{error}</p>
          <button onClick={() => navigate('/')} className="btn-secondary mt-md">
            返回首页
          </button>
        </div>
      </Layout>
    );
  }

  if (!spread) return null;

  return (
    <Layout size="sm">
      <ScreenHeader back="/" title="提问" />

      {/* 牌阵信息（极简卡片） */}
      <div className="panel p-md mb-lg flex items-center gap-md">
        <div className="text-3xl shrink-0">{THEME_SYMBOL[spread.theme] || '✦'}</div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg text-fg">{spread.name}</div>
          <div className="caps text-2xs text-fg-faint">
            {spread.cards} 张牌 · ¥{spread.price}
            {tier === 'silver' || tier === 'gold' && ' · 会员免费'}
          </div>
        </div>
      </div>

      {/* 提问（主体） */}
      <div className="mb-md">
        <label className="caps block mb-xs text-fg-faint">
          — 你想问什么 —
        </label>
        <textarea
          className="input min-h-[180px] resize-none text-base"
          placeholder="例如：&#10;· 我和他现在的关系是怎样的？&#10;· 这份工作是否值得继续？&#10;· 我该如何做出选择？"
          maxLength={500}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          autoFocus
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

      {/* 错误提示 */}
      {error && (
        <div className="text-sm text-secondary text-center border border-secondary/30 bg-secondary/5 px-md py-sm mb-md">
          {error}
        </div>
      )}

      {/* 立即抽按钮（底部） */}
      <Button
        onClick={handleSubmit}
        loading={submitting}
        fullWidth
        size="lg"
      >
        {tier === 'silver' || tier === 'gold' ? '✦ 立即抽 · 会员免费' : `✦ 立即抽 · ¥${spread.price}`}
      </Button>

      {/* 安全网 */}
      <div className="text-center mt-md">
        <p className="text-2xs text-fg-faint">
          {tier === 'silver' || tier === 'gold'
            ? '会员订阅期内无限解读，无额外费用'
            : '不需注册 · 30 秒看解读 · 随时可取消'}
        </p>
      </div>
    </Layout>
  );
}
