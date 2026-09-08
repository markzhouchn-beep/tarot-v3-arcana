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
import { ordersApi, authApi } from '../lib/api';
import { generateShareCard, downloadShareCard } from '../lib/share-card';
import { cardImageById } from '../lib/cards';

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
  const [copied, setCopied] = useState(false);
  const [userEmail, setUserEmail] = useState<any>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailStep, setEmailStep] = useState<'input' | 'code' | 'done'>('input');
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState(['', '', '', '', '', '']);
  const [emailLoading, setEmailLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // 复制链接
  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级方案
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 下载分享卡片（Canvas 生成放到 requestIdleCallback，不卡 UI）
  const handleShare = (template: 'quote' | 'question' | 'mood') => {
    if (!order?.reading) return;
    setSharing(true);
    setShareError(null);

    // 准备数据（同步）
    const cardName = order.cards[0]?.name;
    const spreadName = order.spread_name || order.spread_type || '塔罗解读';
    const st = order.spread_type || '';
    const theme: 'love' | 'career' | 'money' | 'self' =
      st.startsWith('love') ? 'love' :
      st.startsWith('career') ? 'career' :
      st.startsWith('money') ? 'money' :
      'self';
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
    const cardsWithImg = order.cards.map(c => ({
      id: c.id,
      name: c.name,
      orientation: (c.orientation === 'reversed' ? 'reversed' : 'upright') as 'reversed' | 'upright',
      imageUrl: cardImageById(c.id),
    }));

    const doGenerate = async () => {
      try {
        const blob = await generateShareCard({
          siteName: '塔罗匣 · Arcana Box',
          siteUrl: 'tarotbox.cn',
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

    // 空闲时生成，不阻塞 UI
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => doGenerate(), { timeout: 3000 });
    } else {
      setTimeout(() => doGenerate(), 100);
    }
  };

  // 加载订单
  useEffect(() => {
    // 取当前用户
    authApi.me().then((d: any) => setUserEmail(d?.user || null)).catch(() => {});

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

  // 倒计时
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

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
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setInterpreting(false);
    }
  };

  // 追问已迁移到 /oracle/:orderId（删除 mock）

  // ── 留邮箱解锁追问 ──
  const handleSendEmail = async () => {
    if (!emailInput.includes('@')) { setEmailMsg('请输入有效邮箱'); return; }
    setEmailLoading(true);
    setEmailMsg(null);
    try {
      const res: any = await authApi.sendCode(emailInput, 'login');
      setEmailMsg(res.dev_code ? `已发送（开发：${res.dev_code}）` : `已发送至 ${emailInput}`);
      setEmailStep('code');
      setResendIn(60);
    } catch (err: any) {
      setEmailMsg(err.message);
    } finally { setEmailLoading(false); }
  };

  const handleVerifyEmailCode = async () => {
    const codeStr = emailCode.join('');
    if (codeStr.length !== 6) { setEmailMsg('请输入6位验证码'); return; }
    setEmailLoading(true);
    setEmailMsg(null);
    try {
      const res: any = await authApi.verifyCode(emailInput, codeStr);
      if (res.already_logged_in) {
        setUserEmail(res.user);
        setEmailStep('done');
        setEmailMsg('已登录！可以追问啦 🌙');
      } else if (res.temp_token) {
        // 设置密码后登录
        const r2: any = await fetch('/api/auth/set-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ temp_token: res.temp_token, password: 'TarotBox' + Date.now() }),
        }).then(d => d.json());
        if (r2.ok) {
          setUserEmail(r2.user);
          setEmailStep('done');
          setEmailMsg('注册成功！可以追问啦 🌙');
        } else { setEmailMsg(r2.message); }
      } else { setEmailMsg('验证失败，请重试'); }
    } catch (err: any) { setEmailMsg(err.message); }
    finally { setEmailLoading(false); }
  };

  const handleCodeChange = (idx: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(0, 1);
    const next = [...emailCode];
    next[idx] = digit;
    setEmailCode(next);
  };

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

            {/* 复制链接 */}
            <button
              onClick={handleCopyLink}
              className="w-full text-center text-xxs text-fg-secondary hover:text-primary mt-sm"
            >
              {copied ? '✅ 已复制链接' : '🔗 复制解读链接'}
            </button>
          </div>

          {/* 永久保存引导（仅未登录访客） */}
          {!userEmail && (
            <div className="panel p-md mt-lg border-secondary/30">
              <div className="flex items-center gap-sm mb-sm">
                <span className="text-lg">🔖</span>
                <div className="flex-1">
                  <div className="caps text-2xs text-secondary">永久保存 · 一键找回</div>
                  <div className="text-sm text-fg">留下邮箱，这份解读就归你</div>
                </div>
              </div>
              {emailStep === 'input' && (
                <div className="flex gap-xs">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 bg-bg-canvas border border-border rounded px-sm py-xs text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleSendEmail}
                    disabled={emailLoading}
                    className="px-md py-xs text-sm bg-primary text-bg-canvas rounded disabled:opacity-50 whitespace-nowrap"
                  >
                    {emailLoading ? '发送中' : '发验证码'}
                  </button>
                </div>
              )}
              {emailStep === 'code' && (
                <div className="flex gap-xs">
                  <input
                    type="text"
                    value={emailCode.join('')}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setEmailCode(v.split('').concat(Array(6 - v.length).fill('')));
                    }}
                    placeholder="6 位验证码"
                    className="flex-1 bg-bg-canvas border border-border rounded px-sm py-xs text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleVerifyEmailCode}
                    disabled={emailLoading}
                    className="px-md py-xs text-sm bg-primary text-bg-canvas rounded disabled:opacity-50"
                  >
                    验证
                  </button>
                </div>
              )}
              {emailStep === 'done' && emailMsg && (
                <div className="text-xs text-primary">{emailMsg}</div>
              )}
              {emailMsg && emailStep !== 'done' && (
                <div className="text-xs text-secondary mt-1">{emailMsg}</div>
              )}
              <div className="text-2xs text-fg-faint mt-xs">已有账号？登录后所有解读都在「我的」里</div>
            </div>
          )}

          {/* 追问引导（高优先级） */}
          <div className="panel p-lg bg-bg-occult border-primary/30 mt-lg">
            <div className="caps text-primary mb-xs">— 牌面还没说够 —</div>
            <p className="text-sm text-fg-secondary font-body mb-md leading-relaxed">
              解读是"现在"，追问 Oracle 还能问 <span className="text-fg">「他 / 这件事 / 接下来怎么办」</span>。5 轮对话，让塔罗师继续推演。
            </p>

            {userEmail ? (
              /* 已登录 → 直接追问 */
              <Button onClick={() => navigate(`/oracle/${id}`)} variant="primary" size="md" fullWidth>
                🌙 追问 Oracle · 5 轮对话
              </Button>
            ) : emailStep === 'done' ? (
              /* 邮箱验证完成 */
              <Button onClick={() => navigate(`/oracle/${id}`)} variant="primary" size="md" fullWidth>
                🌙 追问 Oracle · 5 轮对话
              </Button>
            ) : emailStep === 'code' ? (
              /* 输入验证码 */
              <div>
                <p className="text-xs text-fg-secondary mb-sm text-center">
                  验证码已发至 <span className="text-primary">{emailInput}</span>
                </p>
                <div className="flex gap-1 justify-center mb-sm">
                  {[0,1,2,3,4,5].map(i => (
                    <input
                      key={i}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={emailCode[i]}
                      onChange={e => handleCodeChange(i, e.target.value)}
                      className="input text-center text-xl font-bold w-10 h-12"
                    />
                  ))}
                </div>
                <Button onClick={handleVerifyEmailCode} variant="primary" size="md" fullWidth loading={emailLoading}>
                  验证并追问
                </Button>
                {emailMsg && <p className="text-xs text-center text-primary mt-xs">{emailMsg}</p>}
                <p className="text-2xs text-fg-faint text-center mt-xs">
                  {resendIn > 0 ? `${resendIn}s后可重发` : (
                    <button onClick={handleSendEmail} className="text-primary hover:underline">重新发送</button>
                  )}
                </p>
              </div>
            ) : (
              /* 留邮箱解锁 */
              <div>
                <p className="text-sm text-fg-secondary font-body mb-md">
                  留下邮箱，免费获得 <span className="text-primary">5 次追问</span> · 无需记住密码
                </p>
                <div className="flex gap-sm">
                  <input
                    type="email"
                    className="input flex-1"
                    placeholder="your@email.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value.toLowerCase())}
                    onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <Button onClick={handleSendEmail} variant="primary" size="md" loading={emailLoading}>
                    获取追问
                  </Button>
                </div>
                {emailMsg && <p className="text-xs text-center text-primary mt-xs">{emailMsg}</p>}
                <p className="caps text-2xs text-fg-faint text-center mt-sm">
                  访客每月 2 次追问 · 登录后可升级会员
                </p>
              </div>
            )}
          </div>

          {/* 行动按钮 */}
          <div className="grid grid-cols-2 gap-md mt-md">
            <Button onClick={() => navigate('/spreads')} variant="secondary" size="md">
              ✦ 新的占卜
            </Button>
            <Button onClick={() => navigate('/dashboard')} variant="ghost" size="md">
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