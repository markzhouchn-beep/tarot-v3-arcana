// ============================================================
// components/Button.tsx · 通用按钮（v3.0 新组件 · 强化视觉层级）
// ============================================================

import type { ReactNode, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  ghost:     'bg-transparent text-fg-secondary border border-transparent hover:text-primary hover:border-border',
  danger:    'btn-danger',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'px-md py-xs text-2xs',
  md: 'px-xl py-md text-xs',
  lg: 'px-2xl py-lg text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`
        ${VARIANT_CLASS[variant]}
        ${SIZE_CLASS[size]}
        ${fullWidth ? 'w-full' : ''}
        ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-xs">
          <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          <span>加载中</span>
        </span>
      ) : children}
    </button>
  );
}
