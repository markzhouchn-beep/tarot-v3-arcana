// ============================================================
// screens/Hero.tsx · 首页（品牌 + Yes/No 入口 + 主题牌阵 + 会员入口）
// Phase 1 · 第 1 页
// ============================================================

import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useEffect, useState } from 'react';
import { authApi } from '../lib/api';

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
          ✦ ARCANA ai
        </h1>
        <h2 className="text-xl font-display text-fg-secondary tracking-wide mb-xs">
          星 语 塔 罗
        </h2>
        <p className="text-sm font-body text-fg-faint italic">
          当答案藏在牌面，命运便不再沉默
        </p>
      </header>

      {/* 主 CTA · Yes/No 免费抽 */}
      <section className="mb-3xl">
        <button
          onClick={() => navigate('/yes-no')}
          className="w-full panel p-xl text-left transition-all duration-fast hover:border-primary hover:shadow-glow-gold"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="caps mb-xs text-primary">免费 · 每日一次</div>
              <h3 className="font-display text-2xl text-fg mb-xs">
                一张牌，回答你心中那个问题
              </h3>
              <p className="text-sm text-fg-faint font-body">
                不用邮箱 · 不用注册 · 抽 1 张牌立即得到答案
              </p>
            </div>
            <div className="text-3xl opacity-40 group-hover:opacity-100">→</div>
          </div>
        </button>
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

      {/* TODO: Phase 1 后续页面 */}
      <footer className="text-center text-2xs text-fg-faint mt-3xl">
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
