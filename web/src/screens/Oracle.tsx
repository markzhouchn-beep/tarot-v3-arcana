// ============================================================
// screens/Oracle.tsx · /oracle — Oracle 智能问答
// Phase 1.6 · v3.0 核心（会员订阅后开放）
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { oracleApi, authApi, membershipApi } from '../lib/api';

interface Session {
  id: string;
  title?: string;
  created_at: number;
  last_message?: string;
}

export default function Oracle() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [tier, setTier] = useState<string>('guest');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      authApi.me().catch(() => null),
      membershipApi.status().catch(() => null),
      oracleApi.sessions().catch(() => ({ sessions: [] })),
    ]).then(([u, m, s]: any[]) => {
      setUser(u?.user || null);
      setTier(m?.tier || 'guest');
      setSessions(s?.sessions || []);
    });
  }, []);

  const isMember = tier === 'silver' || tier === 'gold';

  const handleAsk = async () => {
    if (!question.trim()) {
      setError('请输入你的问题');
      return;
    }
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!isMember) {
      navigate('/membership');
      return;
    }
    setError(null);
    setAsking(true);
    try {
      const res = await oracleApi.ask({ content: question });
      setAnswer(res.content || res.answer || 'Oracle 已收到你的问题');
      setQuestion('');
      // 刷新 session 列表
      const s = await oracleApi.sessions().catch(() => ({ sessions: [] }));
      setSessions((s as any).sessions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  };

  if (!user) {
    return (
      <Layout size="md">
        <ScreenHeader back="/" title="Oracle" />
        <div className="panel p-lg text-center">
          <div className="text-3xl mb-md">✦</div>
          <h3 className="font-display text-xl text-fg mb-sm">Oracle 智能问答</h3>
          <p className="text-sm text-fg-secondary font-body mb-md">
            无限对话 · 占卜之外的全场景塔罗问答
          </p>
          <div className="caps text-2xs text-fg-faint mb-md">需要会员订阅</div>
          <Button onClick={() => navigate('/auth')} variant="primary" size="md">
            登录解锁
          </Button>
        </div>
      </Layout>
    );
  }

  if (!isMember) {
    return (
      <Layout size="md">
        <ScreenHeader back="/" title="Oracle" />
        <div className="panel p-lg text-center border-primary/30 bg-bg-occult">
          <div className="text-3xl mb-md">🌙</div>
          <h3 className="font-display text-xl text-gradient-gold mb-sm">会员专属功能</h3>
          <p className="text-sm text-fg-secondary font-body mb-md">
            Oracle 智能问答需要银月 / 金月会员订阅
          </p>
          <Button onClick={() => navigate('/membership')} variant="primary" size="md">
            查看会员套餐
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout size="md">
      <ScreenHeader back="/" title="Oracle" />

      {/* 最新回答 */}
      {answer && (
        <div className="panel p-lg mb-lg bg-bg-occult animate-fade-in">
          <div className="caps text-2xs text-primary mb-sm">— Oracle 答 —</div>
          <p className="text-sm text-fg font-body leading-relaxed whitespace-pre-line">{answer}</p>
        </div>
      )}

      {/* 提问框 */}
      <div className="panel p-md mb-lg">
        <textarea
          className="input min-h-[100px] resize-none mb-md"
          placeholder="问任何塔罗相关问题…&#10;例如：&#10;· 感情遇到瓶颈该怎么突破？&#10;· 我适合做创意类工作吗？"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          maxLength={500}
        />
        {error && (
          <div className="text-sm text-secondary mb-md text-center">{error}</div>
        )}
        <Button onClick={handleAsk} variant="primary" size="md" fullWidth loading={asking}>
          ✦ 询问 Oracle
        </Button>
      </div>

      {/* 历史会话 */}
      <div className="caps text-primary mb-md">— 历史对话 —</div>
      {sessions.length === 0 ? (
        <div className="panel p-lg text-center text-fg-faint caps text-2xs">
          暂无对话
        </div>
      ) : (
        <div className="space-y-sm">
          {sessions.map(s => (
            <button
              key={s.id}
              className="w-full panel p-md text-left hover:border-primary transition-colors"
            >
              <div className="caps text-2xs text-fg-faint mb-xs">
                {new Date(s.created_at).toLocaleString('zh-CN')}
              </div>
              <div className="text-sm text-fg font-body line-clamp-1">
                {s.title || s.last_message || '新对话'}
              </div>
            </button>
          ))}
        </div>
      )}
    </Layout>
  );
}