// ============================================================
// components/ScreenHeader.tsx · 屏顶栏（v2.0 复用 + 适配 v3.0）
// ============================================================

import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Props {
  back?: string;          // 返回路径
  right?: ReactNode;      // 右侧按钮
  title?: string;         // 屏顶小标
  /** v3.0 新增：透明背景（Hero 风格） */
  transparent?: boolean;
}

export function ScreenHeader({ back, right, title, transparent = false }: Props) {
  const navigate = useNavigate();
  return (
    <div
      className={`flex items-center justify-between px-md py-md ${
        transparent ? 'bg-transparent' : ''
      }`}
    >
      <div className="flex items-center gap-md">
        {back && (
          <button
            onClick={() => navigate(back)}
            className="icon-btn"
            aria-label="返回"
          >
            ←
          </button>
        )}
        {title && <span className="caps">{title}</span>}
      </div>
      {right}
    </div>
  );
}
