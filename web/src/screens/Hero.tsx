// ============================================================
// screens/Hero.tsx · 首页（品牌 + Yes/No 入口 + 主题牌阵 + 会员入口）
// Phase 1 · 第 1 页
// 2026-09-06 v3.0.3：新增「大家都在问什么」示例问题模块（替代用户评价）
// ============================================================

import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useEffect, useState } from 'react';
import { authApi } from '../lib/api';

interface SampleQuestion {
  id: string;
  question: string;
  card: string;          // 牌名
  cardSymbol: string;    // 牌符号
  snippet: string;       // AI 解读片段
  action: string;        // 行动建议
}

const SAMPLE_QUESTIONS: SampleQuestion[] = [
  {
    id: 'love-1',
    question: '他对我到底有没有意思？',
    card: '恋人 · 正位',
    cardSymbol: '💕',
    snippet: '月亮正位显示你们之间确实有连接。但现在的隐士逆位代表他在犹豫 —— 不是不喜欢，是怕承认。',
    action: '下一步：见面时主动提起一个私密话题，看他会不会跟进。',
  },
  {
    id: 'love-2',
    question: '我们还能复合吗？',
    card: '命运之轮',
    cardSymbol: '🎡',
    snippet: '过去是逆位塔（你们分得不愉快），现在是世界正位（你已经在愈合）。未来力量正位代表需要主动。',
    action: '下一步：先给自己 3 周，再发一条不带情绪的问候。',
  },
  {
    id: 'career-1',
    question: '这次升职能通过吗？',
    card: '皇帝 · 正位',
    cardSymbol: '👑',
    snippet: '现状是世界正位（你能力够），挑战是逆位审判（过去的项目在审查你）。但核心牌权杖 3 显示有贵人。',
    action: '下一步：准备一份过去 6 个月的成果清单，主动找上级 1on1。',
  },
  {
    id: 'career-2',
    question: '现在换工作合适吗？',
    card: '高塔',
    cardSymbol: '🗼',
    snippet: '现在是逆位高塔（当前公司正在动荡），未来是星星正位（前方有光）。但需要准备，不是现在走。',
    action: '下一步：再等 2 个月，期间每周投 2 份简历，3 个月内拿 offer 再动。',
  },
  {
    id: 'money-1',
    question: '今年下半年财运怎么样？',
    card: '皇后 · 正位',
    cardSymbol: '🌾',
    snippet: '上半年权杖 4 稳中有升。下半年女皇正位带来副业机遇 —— 尤其跟"美、创作、关怀"相关的方向。',
    action: '下一步：6 月开始试一个小副业（哪怕只赚 100/月），积累下半年能量。',
  },
  {
    id: 'love-3',
    question: '这次相亲能成吗？',
    card: '太阳 · 正位',
    cardSymbol: '☀️',
    snippet: '相遇牌太阳正位强烈预示良好开端。但隐士逆位提示 —— 别用力过猛，自然一点。',
    action: '下一步：前 3 次见面只聊 30 分钟内，让对方有"还想再聊"的欲望。',
  },
  {
    id: 'self-1',
    question: '我该不该和 TA 复合？',
    card: '死神 · 正位',
    cardSymbol: '🦋',
    snippet: '死神正位不是终结，是"重生"。不是 TA 的问题 —— 是你带着旧模式回去。',
    action: '下一步：先分开 3 个月。写下"上次分手的真实原因"，等 3 个月再决定。',
  },
  {
    id: 'self-2',
    question: '我该怎么改变现状？',
    card: '魔术师',
    cardSymbol: '🪄',
    snippet: '魔术师手举 4 元素 —— 你已经有所有"工具"。只是还没"整合"。',
    action: '下一步：列一张"过去 3 年你做对的事"，识别你最擅长的能力并强化它。',
  },
];

export default function Hero() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    authApi.me().then(d => setUser(d.user)).catch(() => {});
  }, []);

  return (
    <Layout orbs size="md">
      {/* 屏顶 · 登录 / 会员入口 */}
      <div className="flex justify-end mb-2xl">
        {user ? (
          <button
            onClick={() => navigate('/dashboard')}
            className="caps text-fg-secondary hover:text-primary"
          >
            {user.nickname || user.email?.split('@')[0] || '我的'}
          </button>
        ) : (
          <button
            onClick={() => navigate('/auth')}
            className="caps text-fg-secondary hover:text-primary"
          >
            登录 / 注册
          </button>
        )}
      </div>

      {/* 品牌 */}
      <header className="text-center mb-3xl animate-fade-in">
        <div className="caps mb-md">— Mystic Vintage Dark —</div>
        <h1 className="text-5xl text-gradient-gold mb-md animate-float-y">
          ✦ Arcana Box
        </h1>
        <h2 className="text-xl font-display text-fg-secondary tracking-wide mb-xs">
          塔 罗 匣
        </h2>
        <p className="text-sm font-body text-fg-faint italic">
          答案就在牌面
        </p>
      </header>

      {/* 主 CTA · 零门槛立即出答案 */}
      <section className="mb-3xl">
        <button
          onClick={() => navigate('/yes-no?quick=1')}
          className="w-full panel p-2xl text-center transition-all duration-fast hover:border-primary hover:shadow-glow-gold bg-bg-occult animate-fade-in"
        >
          {/* 牌背装饰 */}
          <div className="text-5xl mb-lg animate-float-y">🂿</div>
          <div className="caps text-primary mb-sm">免费 · 无需注册</div>
          <h3 className="font-display text-3xl text-fg mb-sm">
            免费抽一张 · 立即看答案
          </h3>
          <p className="text-sm text-fg-faint font-body mb-lg">
            点击即抽 · 零门槛 · 30 秒内看到你的解读
          </p>
          <div className="inline-block px-lg py-sm bg-primary text-bg-canvas font-display text-lg rounded">
            ✦ 立即开始 →
          </div>
        </button>
      </section>

      {/* 大家都在问什么 · 真实示例问题（脱敏） */}
      <section className="mb-3xl">
        <div className="caps text-fg-faint text-center mb-md">— 大家都在问什么 —</div>
        <div className="space-y-md">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q.id}
              onClick={() => navigate(`/yes-no?question=${encodeURIComponent(q.question)}`)}
              className="w-full panel p-md text-left transition-all duration-fast hover:border-primary hover:shadow-glow-gold group"
            >
              <div className="flex items-start gap-md">
                <div className="text-2xl shrink-0">{q.cardSymbol}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-md text-primary mb-1">
                    {q.question}
                  </div>
                  <div className="text-xs text-fg-faint font-body line-clamp-2 leading-relaxed">
                    {q.snippet}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="caps text-2xs text-fg-faint">{q.card}</span>
                    <span className="text-xxs text-primary opacity-0 group-hover:opacity-100 transition">
                      我也想问问 →
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="caps text-2xs text-fg-faint text-center mt-md">
          脱敏真实场景 · 点击任意问题立即开始
        </p>
      </section>

      {/* 主题牌阵入口 · 4 主题 */}
      <section className="mb-3xl">
        <div className="caps text-fg-faint mb-md">— 选择主题 —</div>
        <div className="grid grid-cols-2 gap-md">
          <ThemeCard
            symbol="💞"
            title="感情"
            desc="过去的他 · 现在的你 · 未来可能"
            onClick={() => navigate('/spreads?theme=love')}
          />
          <ThemeCard
            symbol="💼"
            title="事业"
            desc="方向 · 抉择 · 上升期"
            onClick={() => navigate('/spreads?theme=career')}
          />
          <ThemeCard
            symbol="💰"
            title="财富"
            desc="财流 · 投资 · 机遇"
            onClick={() => navigate('/spreads?theme=money')}
          />
          <ThemeCard
            symbol="🌙"
            title="自我"
            desc="内在映照 · 潜意识 · 成长"
            onClick={() => navigate('/spreads?theme=self')}
          />
        </div>
      </section>

      {/* 会员入口 */}
      <section className="mb-3xl">
        <button
          onClick={() => navigate('/membership')}
          className="w-full panel p-lg text-left bg-bg-occult transition-all duration-fast hover:border-primary"
        >
          <div className="flex items-center gap-md">
            <div className="text-2xl">✦</div>
            <div className="flex-1">
              <div className="caps text-primary mb-2xs">会员 · 月卡 ¥19.9 / 年卡 ¥199</div>
              <p className="text-sm text-fg-secondary font-body">
                每日 3 次 Yes/No · 5 次追问 · 解锁全部高级牌阵
              </p>
            </div>
            <div className="text-fg-faint">→</div>
          </div>
        </button>
      </section>

      {/* Oracle 追问入口 */}
      <section className="mb-3xl">
        <button
          onClick={() => navigate('/oracle')}
          className="w-full panel p-lg text-left transition-all duration-fast hover:border-primary"
        >
          <div className="flex items-center gap-md">
            <div className="text-2xl">🔮</div>
            <div className="flex-1">
              <div className="caps text-secondary mb-2xs">Oracle · 塔罗追问</div>
              <p className="text-sm text-fg-secondary font-body">
                抽完牌还不解？继续追问 · 5 轮对话 · 塔罗师深度解答
              </p>
            </div>
            <div className="text-fg-faint">→</div>
          </div>
        </button>
      </section>

      {/* 塔罗百科 · 78 张含义 */}
      <section className="mt-3xl mb-xl">
        <div className="caps text-fg-faint text-center mb-md">— 塔罗百科 —</div>
        <div className="grid grid-cols-1 gap-xs">
          <a
            href="/cards"
            onClick={(e) => { e.preventDefault(); navigate('/cards'); }}
            className="panel p-md flex items-center justify-between transition-all duration-fast hover:border-primary hover:shadow-glow-gold no-underline cursor-pointer"
          >
            <div className="flex items-center gap-md">
              <span className="text-xl">✦</span>
              <div>
                <div className="font-display text-sm text-fg">78 张塔罗牌含义大全</div>
                <div className="text-2xs text-fg-faint font-body">完整韦特图鉴 · 22 大阿 + 56 小阿</div>
              </div>
            </div>
            <span className="text-fg-faint text-xs">→</span>
          </a>
          <a
            href="/community"
            onClick={(e) => { e.preventDefault(); navigate('/community'); }}
            className="panel p-md flex items-center justify-between transition-all duration-fast hover:border-primary hover:shadow-glow-gold no-underline cursor-pointer"
          >
            <div className="flex items-center gap-md">
              <span className="text-xl">◈</span>
              <div>
                <div className="font-display text-sm text-fg">社区精选追问</div>
                <div className="text-2xs text-fg-faint font-body">看看大家都在问什么 · 公开追问</div>
              </div>
            </div>
            <span className="text-fg-faint text-xs">→</span>
          </a>
          <a
            href="/membership"
            onClick={(e) => { e.preventDefault(); navigate('/membership'); }}
            className="panel p-md flex items-center justify-between transition-all duration-fast hover:border-primary hover:shadow-glow-gold no-underline cursor-pointer"
          >
            <div className="flex items-center gap-md">
              <span className="text-xl">💎</span>
              <div>
                <div className="font-display text-sm text-fg">会员套餐</div>
                <div className="text-2xs text-fg-faint font-body">¥19.9/月 起 · 无限追问 + 全部高级牌阵</div>
              </div>
            </div>
            <span className="text-fg-faint text-xs">→</span>
          </a>
        </div>
      </section>

      <footer className="text-center text-2xs text-fg-faint mt-xl">
        <div className="caps">v3.0 · Phase 1 · 2026</div>
      </footer>
    </Layout>
  );
}

function ThemeCard({
  symbol,
  title,
  desc,
  onClick,
}: {
  symbol: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="panel p-lg text-left transition-all duration-fast hover:border-primary hover:shadow-glow-gold"
    >
      <div className="text-2xl mb-xs">{symbol}</div>
      <div className="font-display text-lg text-fg mb-2xs">{title}</div>
      <div className="text-xs text-fg-faint font-body">{desc}</div>
    </button>
  );
}
