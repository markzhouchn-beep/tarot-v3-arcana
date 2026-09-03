// ============================================================
// screens/YesNo.tsx · Yes/No 免费抽（最简单闭环）
// Phase 1 · 第 3 页
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { CardBack } from '../components/CardBack';
import { CardFace } from '../components/CardFace';
import { yesNoApi, authApi } from '../lib/api';

interface DrawResult {
  ok: boolean;
  card: { id: string; name: string; orientation: string };
  question: string;
  result: 'yes' | 'no' | 'uncertain';
  keywords: string[];
  energy_tendency: string;
  explanation: string;
  action_hint: string;
  remaining: number;
}

interface Quota {
  used: number;
  limit: number;
  remaining: number;
}

const RESULT_STYLE = {
  yes:       { symbol: '✓', color: '#5B7C5B', label: '是' },
  no:        { symbol: '✗', color: '#B8332E', label: '否' },
  uncertain: { symbol: '?', color: '#C8985B', label: '未定' },
};

function getDeviceId(): string {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('device_id', id);
  }
  return id;
}

export default function YesNo() {
  const navigate = useNavigate();
  const [deviceId] = useState(getDeviceId());
  const [quota, setQuota] = useState<Quota | null>(null);
  const [user, setUser] = useState<{ tier?: string } | null>(null);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<DrawResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshQuota();
    // 获取用户 tier（仅用于决定是否提示注册）
    authApi.me().then((d: any) => setUser(d?.user || null)).catch(() => setUser(null));
  }, []);

  const refreshQuota = () => {
    yesNoApi.quota(deviceId)
      .then(setQuota)
      .catch(() => setQuota({ used: 0, limit: 1, remaining: 1 }));
  };

  const handleDraw = async () => {
    if (!question.trim()) {
      setError('请输入你的问题');
      return;
    }
    if (quota && quota.remaining <= 0) {
      const tier = user?.tier || 'guest';
      const msg = {
        guest:     '今日 1 次已用完 · 注册登录可解锁 3 次/日',
        registered: '今日 3 次已用完 · 开通银月可解锁 10 次/日',
        silver:    '今日 10 次已用完 · 升级金月可解锁无限',
        gold:      '今日次数已用完 · 请明天再试',
      }[tier] || '今日次数已用完';
      setError(msg);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await yesNoApi.draw(question.trim(), deviceId);
      setResult(r);
      setQuestion('');
      refreshQuota();
    } catch (err: any) {
      // 调试：含 HTTP 状态 + 错码 + message，方便快速定位
      const detail = [
        err.code && `[${err.code}]`,
        err.status && `HTTP ${err.status}`,
        err.message,
      ].filter(Boolean).join(' ');
      setError(detail || '未知错误');
      console.error('[YesNo] draw error:', { status: err.status, code: err.code, message: err.message, raw: err.raw });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setQuestion('');
  };

  return (
    <Layout size="sm">
      <ScreenHeader back="/" title="Yes / No · 一张牌" />

      {/* 配额提示 */}
      {quota && (
        <div className="caps text-fg-faint text-center mb-lg">
          今日剩余 <span className="text-primary">{quota.remaining}</span> / {quota.limit} 次
        </div>
      )}

      {/* 用完提示横幅：引导升级 */}
      {quota && quota.remaining <= 0 && (
        <div className="panel p-md border-primary/40 bg-bg-occult text-center mb-lg">
          <div className="caps text-primary mb-xs">— 今日次数已用完 —</div>
          <p className="text-sm text-fg-secondary mb-md leading-relaxed">
            {user?.tier === 'guest' && '注册登录可解锁 3 次/日'}
            {user?.tier === 'registered' && '开通银月可解锁 10 次/日'}
            {user?.tier === 'silver' && '升级金月可解锁无限'}
            {(!user || user?.tier === 'gold') && '请明天再来'}
          </p>
          {(user?.tier === 'guest' || !user) && (
            <Button onClick={() => navigate('/auth')} variant="primary" size="sm" fullWidth>
              ✦ 注册登录解锁更多
            </Button>
          )}
          {user?.tier === 'registered' && (
            <Button onClick={() => navigate('/membership')} variant="primary" size="sm" fullWidth>
              ✦ 开通银月会员
            </Button>
          )}
          {user?.tier === 'silver' && (
            <Button onClick={() => navigate('/membership')} variant="primary" size="sm" fullWidth>
              ✦ 升级金月会员
            </Button>
          )}
        </div>
      )}

      {!result ? (
        <div className="space-y-lg">
          {/* 牌背（v2.0 card-back-rare.png） */}
          <div className="flex justify-center my-2xl">
            <CardBack size="md" glowing />
          </div>

          {/* 输入问题 */}
          <div>
            <label className="caps block mb-xs text-fg-faint">
              你想问什么
            </label>
            <textarea
              className="input min-h-[100px] resize-none"
              placeholder="例如：他喜欢我吗？ / 我应该换工作吗？"
              maxLength={500}
              value={question}
              onChange={e => setQuestion(e.target.value)}
            />
            <div className="caps text-fg-faint text-2xs mt-xs text-right">
              {question.length} / 500
            </div>
          </div>

          {error && (
            <div className="text-sm text-secondary text-center border border-secondary/30 bg-secondary/5 px-md py-sm">
              {error}
            </div>
          )}

          <Button onClick={handleDraw} loading={loading} fullWidth size="lg">
            ✦ 抽牌
          </Button>
        </div>
      ) : (
        <ResultView result={result} onAgain={handleReset} onClose={() => navigate('/')} onUnlock={() => navigate('/spreads?theme=love')} />
      )}
    </Layout>
  );
}

function ResultView({
  result,
  onAgain,
  onClose,
  onUnlock,
}: {
  result: DrawResult;
  onAgain: () => void;
  onClose: () => void;
  onUnlock: () => void;
}) {
  const style = RESULT_STYLE[result.result];

  return (
    <div className="animate-fade-in">
      {/* 大符号 */}
      <div className="text-center mb-2xl">
        <div
          className="text-8xl font-display animate-float-y"
          style={{ color: style.color, textShadow: `0 0 40px ${style.color}` }}
        >
          {style.symbol}
        </div>
        <div className="caps mt-md" style={{ color: style.color }}>
          {style.label}
        </div>
      </div>

      {/* 牌信息 + 真牌图 */}
      <div className="text-center mb-2xl">
        <div className="flex justify-center mb-lg">
          <CardFace
            card={{
              id: result.card.id,
              name: result.card.name,
              // backend 现在返英文 upright/reversed，但兼容老的中文 '正位'
              orientation: result.card.orientation === 'reversed' || result.card.orientation === '逆位' ? 'reversed' : 'upright',
            }}
            size="lg"
          />
        </div>
        <div className="font-display text-2xl text-fg mb-xs">
          {result.card.name}
          <span className="text-fg-faint ml-sm text-base">
            （{result.card.orientation}）
          </span>
        </div>
        <div className="text-sm text-fg-secondary italic">
          「{result.question}」
        </div>
      </div>

      {/* 关键词 */}
      <div className="flex justify-center gap-xs mb-2xl">
        {result.keywords.map(k => (
          <span key={k} className="caps text-2xs px-2xs py-2xs border border-border text-primary">
            {k}
          </span>
        ))}
      </div>

      {/* 解读方向 */}
      <div className="panel p-lg mb-md">
        <div className="caps text-fg-faint mb-xs">解读方向</div>
        <p className="font-display text-md text-fg leading-relaxed">
          {result.energy_tendency}
        </p>
      </div>

      {/* 解读 */}
      <div className="panel p-lg mb-md">
        <div className="caps text-fg-faint mb-xs">解读</div>
        <p className="font-body text-md text-fg-secondary leading-relaxed">
          {result.explanation}
        </p>
      </div>

      {/* 行动建议 */}
      <div className="panel p-lg mb-2xl bg-bg-occult">
        <div className="caps text-primary mb-xs">行动建议</div>
        <p className="font-display text-md text-fg leading-relaxed italic">
          {result.action_hint}
        </p>
      </div>

      {/* 转化引导 · 主 CTA（Yes/No 转付费解读） */}
      <div className="space-y-md">
        <div className="panel p-lg bg-bg-occult border-primary/40">
          <div className="caps text-primary mb-xs">— 想看完整解读 —</div>
          <p className="text-sm text-fg-secondary font-body mb-md leading-relaxed">
            一张牌只是一个方向。完整解读包含状态分析、可能发展、行动建议 —— 只需 ¥1.9。
          </p>
          <Button
            onClick={onUnlock}
            variant="primary"
            size="md"
            fullWidth
          >
            ✦ 查看完整牌阵 · 从 ¥1.9 起
          </Button>
        </div>

        <Button onClick={onAgain} variant="secondary" fullWidth>
          再抽一张
        </Button>
        <Button onClick={onClose} variant="ghost" fullWidth>
          返回首页
        </Button>
      </div>
    </div>
  );
}
