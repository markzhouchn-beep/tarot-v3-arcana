// ============================================================
// screens/OracleChat.tsx · /oracle/:readingId — 阅读报告追问页
// Phase 3.0 · 创建：2026-09-02 02:30
//
// 流程：reading 报告 → 点「追问 Oracle」→ 进入此页 → 选预设问题或自由提问 → AI 三层 prompt 回答
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { oracleApi, authApi, membershipApi, ordersApi } from '../lib/api';

interface PresetQuestion {
  id: string;
  text: string;
  description?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  depth_layer?: number;
  created_at: number;
}

export default function OracleChat() {
  const params = useParams();
  const readingId = params.readingId;
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [tier, setTier] = useState<string>('guest');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [presets, setPresets] = useState<Record<string, PresetQuestion[]>>({});
  const [readingSummary, setReadingSummary] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // 初始化
  useEffect(() => {
    if (!readingId) {
      setError('未指定 readingId');
      setInitLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setDebugInfo('检查登录态...');
        const me = await authApi.me().catch((e) => {
          console.error('[OracleChat] authApi.me failed:', e);
          return null;
        });
        if (cancelled) return;
        setDebugInfo(`用户: ${me?.user?.email || '未登录'}`);

        if (!me?.user?.id) {
          navigate('/auth');
          return;
        }
        setUser(me.user);

        setDebugInfo('检查会员...');
        const m = await membershipApi.status().catch((e) => {
          console.error('[OracleChat] membershipApi.status failed:', e);
          return null;
        });
        if (cancelled) return;
        setTier(m?.tier || 'guest');
        setDebugInfo(`Tier: ${m?.tier || 'guest'}`);

        setDebugInfo('查 order 的 reading...');
        let resolvedReadingId: string = readingId || '';
        try {
          const order = await ordersApi.get(readingId);
          if (order?.reading_id) {
            resolvedReadingId = order.reading_id;
            setDebugInfo(`reading_id=${resolvedReadingId.slice(0, 8)}...`);
          } else {
            setDebugInfo(`按 reading_id 直查=${resolvedReadingId.slice(0, 8)}...`);
          }
        } catch (e) {
          console.warn('[OracleChat] ordersApi.get failed, treat as readingId', e);
          setDebugInfo(`按 reading_id 直查=${resolvedReadingId.slice(0, 8)}...`);
        }

        setDebugInfo('创建/获取 Oracle 会话...');
        const sess = await oracleApi.createSession(resolvedReadingId).catch((e) => {
          console.error('[OracleChat] createSession failed:', e);
          throw new Error('createSession: ' + e.message);
        });
        if (cancelled) return;
        setSessionId(sess.sessionId);
        setDebugInfo(`Session: ${sess.sessionId?.slice(0, 8)}...`);

        setDebugInfo('加载历史...');
        const hist = await oracleApi.getMessages(sess.sessionId).catch((e) => {
          console.error('[OracleChat] getMessages failed:', e);
          return { messages: [] };
        });
        if (cancelled) return;
        setMessages(hist.messages || []);

        setDebugInfo('加载预设问题...');
        const presetRes = await oracleApi.presetQuestions({
          spread_type: 'three_card',
          tier: m?.tier || 'registered',
        }).catch((e) => {
          console.error('[OracleChat] presetQuestions failed:', e);
          return { questions: {} };
        });
        if (cancelled) return;
        setPresets(presetRes.questions || {});

        setDebugInfo('加载报告摘要...');
        const r = await fetch(`/api/readings/${resolvedReadingId}`, {
          credentials: 'include',
        }).catch((e) => {
          console.error('[OracleChat] fetch reading failed:', e);
          return null;
        });
        if (cancelled) return;
        if (r && r.ok) {
          const rj = await r.json();
          setReadingSummary(rj?.summary || rj?.reading?.summary || '');
        }

        setDebugInfo('完成');
      } catch (err: any) {
        console.error('[OracleChat] init error:', err);
        setError(err.message);
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [readingId, navigate]);

  const handleAsk = async (content: string, presetId?: string) => {
    if (!sessionId || !content.trim()) {
      setError('请先选择或输入问题');
      return;
    }
    setAsking(true);
    setError(null);

    const tempId = 'temp-' + Date.now();
    const tempUserMsg: Message = {
      id: tempId,
      role: 'user',
      content,
      created_at: Date.now(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setQuestion('');

    try {
      const res = await oracleApi.ask({
        session_id: sessionId,
        content,
        preset_question_id: presetId,
      });
      const aiMsg: Message = {
        id: res.aiMessageId || ('ai-' + Date.now()),
        role: 'assistant',
        content: res.content || '',
        depth_layer: res.depthLayer,
        created_at: Date.now(),
      };
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        { ...tempUserMsg, id: res.userMessageId || tempId },
        aiMsg,
      ]);
      setRemaining(res.remaining);
    } catch (err: any) {
      setError(err.message || '追问失败');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setAsking(false);
    }
  };

  const isMember = tier === 'silver' || tier === 'gold';

  // === 渲染 ===
  return (
    <Layout size="md">
      <ScreenHeader back={readingId ? `/reading/${readingId}` : '/'} title="追问 Oracle" />

      {/* 开发模式：调试面板。生产环境只保留错误文本 */}
      {import.meta.env.DEV && (initLoading || debugInfo) && (
        <div className="panel p-md mb-md bg-bg-occult text-2xs">
          {initLoading && <div>状态：{debugInfo || '加载中...'}</div>}
          {error && <div className="text-secondary mt-xs">调试：{error}</div>}
        </div>
      )}
      {!import.meta.env.DEV && error && (
        <div className="panel p-md mb-md border-secondary text-center text-sm text-secondary">
          {error}
        </div>
      )}

      {/* 报告摘要 */}
      {readingSummary && (
        <div className="panel p-md mb-md bg-bg-occult">
          <div className="caps text-2xs text-primary mb-xs">— 原报告摘要 —</div>
          <p className="text-sm text-fg-secondary italic font-body">{readingSummary}</p>
        </div>
      )}

      {/* 会员检查 */}
      {user && !isMember && (
        <div className="panel p-md mb-md border-primary/30 text-center">
          <p className="text-sm text-fg-secondary mb-sm">追问需要会员订阅</p>
          <Button onClick={() => navigate('/membership')} variant="primary" size="sm">
            查看会员套餐
          </Button>
        </div>
      )}

      {/* 预设问题 */}
      {!initLoading && isMember && Object.keys(presets).length > 0 && (
        <div className="mb-md">
          <div className="caps text-primary text-2xs mb-sm">— 选一个预设问题 —</div>
          {Object.entries(presets).map(([cat, qs]) => (
            <div key={cat} className="mb-sm">
              <div className="caps text-2xs text-fg-faint mb-xs">
                {cat === 'single_card' && '单卡深入'}
                {cat === 'two_cards' && '两牌关系'}
                {cat === 'action' && '行动指引'}
                {cat === 'review' && '复盘审视'}
              </div>
              <div className="space-y-xs">
                {qs.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => handleAsk(q.text, q.id)}
                    disabled={asking}
                    className="w-full text-left panel p-sm hover:border-primary transition-colors disabled:opacity-50"
                  >
                    <div className="text-sm text-fg font-body">{q.text}</div>
                    {q.description && (
                      <div className="text-2xs text-fg-faint mt-xs">{q.description}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 对话历史 */}
      {messages.length > 0 && (
        <div className="space-y-md mb-md">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`panel p-md ${msg.role === 'user' ? 'bg-bg-occult ml-md' : 'mr-md'}`}
            >
              <div className="caps text-2xs text-fg-faint mb-xs">
                {msg.role === 'user' ? '你' : '— Oracle —'}
                {msg.depth_layer && msg.role === 'assistant' && ` · 深度 ${msg.depth_layer}`}
              </div>
              <p className="text-sm text-fg font-body leading-relaxed whitespace-pre-line">
                {msg.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 输入框 */}
      {!initLoading && isMember && sessionId && (
        <div className="panel p-md sticky bottom-0 bg-bg-base">
          {remaining !== null && (
            <div className="caps text-2xs text-fg-faint mb-xs">
              剩余追问：{remaining === 999 ? '∞' : `${remaining} 次`}
            </div>
          )}
          <textarea
            className="input min-h-[80px] resize-none mb-sm"
            placeholder="输入你的追问…（最多 500 字）"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            disabled={asking}
          />
          <Button
            onClick={() => handleAsk(question)}
            variant="primary"
            size="md"
            fullWidth
            loading={asking}
            disabled={!question.trim()}
          >
            ✦ 追问
          </Button>
        </div>
      )}
    </Layout>
  );
}