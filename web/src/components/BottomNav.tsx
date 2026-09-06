// ============================================================
// components/BottomNav.tsx · 底部 Tab Bar（v3.0.3 · 2026-09-06）
// 4 个 Tab：首页 / 抽牌（FAB）/ 会员 / 我的
// 隐藏场景：/admin、/auth、/auth/*
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../lib/api';

interface Tab {
  key: string;
  path: string;
  label: string;
  icon: string;
  requireAuth?: boolean;
}

const TABS: Tab[] = [
  { key: 'home',    path: '/',            label: '首页', icon: '🏠' },
  { key: 'draw',    path: '/yes-no',      label: '抽牌', icon: '✦' }, // FAB
  { key: 'member',  path: '/membership',  label: '会员', icon: '💎' },
  { key: 'me',      path: '/dashboard',   label: '我的', icon: '👤', requireAuth: true },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    authApi.me().then((d: any) => setUser(d?.user || null)).catch(() => {});
  }, []);

  // 隐藏场景
  const HIDE_PREFIXES = ['/admin', '/auth'];
  if (HIDE_PREFIXES.some(p => location.pathname.startsWith(p))) return null;

  const handleTab = (tab: Tab) => {
    if (tab.requireAuth && !user) {
      // 未登录 → 引导去登录，登录成功后回原 tab
      navigate(`/auth?callback=${encodeURIComponent(tab.path)}`);
      return;
    }
    navigate(tab.path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md"
      style={{
        background: 'linear-gradient(180deg, rgba(26, 19, 16, 0.6) 0%, rgba(14, 10, 7, 0.95) 100%)',
        borderTop: '1px solid rgba(200, 152, 91, 0.2)',
        boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div className="max-w-screen-sm mx-auto flex items-center justify-around h-16 px-sm">
        {TABS.map((tab) => {
          const isActive = location.pathname === tab.path ||
            (tab.path === '/dashboard' && location.pathname.startsWith('/dashboard')) ||
            (tab.path === '/membership' && location.pathname.startsWith('/membership')) ||
            (tab.path === '/yes-no' && location.pathname.startsWith('/yes-no'));
          const isCenter = tab.key === 'draw';

          if (isCenter) {
            return (
              <button
                key={tab.key}
                onClick={() => handleTab(tab)}
                className="relative -top-5 w-14 h-14 rounded-full flex items-center justify-center transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/60"
                style={{
                  background: 'linear-gradient(135deg, #c8985b 0%, #a83a3a 100%)',
                  boxShadow: '0 0 24px rgba(200, 152, 91, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)',
                }}
                aria-label={tab.label}
              >
                <span className="text-2xl">{tab.icon}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.key}
              onClick={() => handleTab(tab)}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition focus:outline-none focus:text-primary ${
                isActive ? 'text-primary' : 'text-fg-faint hover:text-fg-secondary'
              }`}
              aria-label={tab.label}
            >
              <span className={`text-xl ${isActive ? 'scale-110' : ''} transition-transform`}>{tab.icon}</span>
              <span className="text-xxs">{tab.label}</span>
              {isActive && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
      {/* iOS 安全区 */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
