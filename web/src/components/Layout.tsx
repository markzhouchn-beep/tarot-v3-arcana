// ============================================================
// components/Layout.tsx · 通用布局（540px 居中 + 装饰边距）
// 创建：2026-09-01 · Phase 1
// ============================================================

import type { ReactNode } from 'react';
import { UserMenu } from './UserMenu';

interface Props {
  children: ReactNode;
  /** 是否显示 Hero 风格的呼吸光球背景 */
  orbs?: boolean;
  /** 容器宽度变体 */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAX = {
  sm: '420px',
  md: '540px',
  lg: '720px',
};

export function Layout({ children, orbs = false, size = 'md' }: Props) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      {orbs && <OrbBackground />}

      {/* Bug fix 2026-09-03：右上角全局加用户菜单（昵称 + 退出） */}
      <div className="fixed top-md right-md z-50">
        <UserMenu />
      </div>

      <main
        className="relative z-10 mx-auto px-md py-xl w-full pt-2xl"
        style={{ maxWidth: SIZE_MAX[size] }}
      >
        {children}
      </main>
    </div>
  );
}

/** 呼吸光球 · Hero 用 */
function OrbBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div
        className="orb animate-orb-breathe"
        style={{
          width: '480px',
          height: '480px',
          top: '-15%',
          left: '-15%',
          background: 'radial-gradient(circle, rgba(168, 58, 58, 0.35) 0%, transparent 70%)',
        }}
      />
      <div
        className="orb animate-orb-breathe-slow"
        style={{
          width: '600px',
          height: '600px',
          bottom: '-25%',
          right: '-20%',
          background: 'radial-gradient(circle, rgba(200, 152, 91, 0.3) 0%, transparent 70%)',
        }}
      />
      <div
        className="orb animate-orb-breathe"
        style={{
          width: '320px',
          height: '320px',
          top: '40%',
          right: '-10%',
          background: 'radial-gradient(circle, rgba(168, 58, 58, 0.25) 0%, transparent 70%)',
          animationDelay: '2s',
        }}
      />
    </div>
  );
}
