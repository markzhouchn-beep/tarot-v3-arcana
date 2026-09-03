// ============================================================
// components/UserMenu.tsx · 顶部用户菜单（昵称/会员 + 退出）
// Bug fix 2026-09-03：右上角加个能点开的用户菜单，带退出按钮
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';

const TIER_LABEL: Record<string, string> = {
  silver: '🌙 银月',
  gold: '✦ 金月',
  registered: '注册',
  guest: '访客',
};

export function UserMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>( null);

  useEffect(() => {
    authApi.me().then((d: any) => setUser(d?.user || null)).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) {
    return (
      <button
        onClick={() => navigate('/auth')}
        className="caps text-xs text-primary px-sm py-xs border border-primary/40 rounded-md hover:bg-primary/10 transition-colors"
      >
        登录
      </button>
    );
  }

  const nickname = user.nickname || user.email?.split('@')[0] || '我';
  const tier = user.tier || 'registered';

  const handleLogout = async () => {
    setBusy(true);
    try {
      await authApi.logout();
      window.location.href = '/';
    } catch {
      window.location.href = '/';
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-sm py-xs px-sm border border-primary/40 rounded-md hover:bg-primary/10 transition-colors"
      >
        <span className="caps text-xs text-gradient-gold font-bold">
          {TIER_LABEL[tier] || '注册'}
        </span>
        <span className="text-sm text-fg font-body max-w-[80px] truncate">
          {nickname}
        </span>
        <span className="text-fg-faint text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-xs panel p-sm min-w-[180px] z-50 shadow-lg animate-fade-in">
          <button
            onClick={() => { setOpen(false); navigate('/dashboard'); }}
            className="block w-full text-left px-md py-sm text-sm text-fg hover:bg-primary/10 rounded transition-colors"
          >
            ✦ 我的占卜
          </button>
          <button
            onClick={() => { setOpen(false); navigate('/membership'); }}
            className="block w-full text-left px-md py-sm text-sm text-fg hover:bg-primary/10 rounded transition-colors"
          >
            💎 会员套餐
          </button>
          <div className="border-t border-border my-xs" />
          <button
            onClick={handleLogout}
            disabled={busy}
            className="block w-full text-left px-md py-sm text-sm text-secondary hover:bg-secondary/10 rounded transition-colors disabled:opacity-50"
          >
            {busy ? '退出中…' : '⎋ 退出登录'}
          </button>
        </div>
      )}
    </div>
  );
}