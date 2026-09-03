// ============================================================
// ErrorBoundary.tsx · 全局错误兜底（防止组件报错导致整页白屏）
// ============================================================

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 完整错误日志（生产环境也打印，便于排查）
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          background: '#0a0a0a',
          color: '#e8d9b5',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✦</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 500 }}>
            页面加载出错
          </h1>
          <p style={{ opacity: 0.7, marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            请刷新重试。如反复出现，请反馈客服
          </p>
          <pre style={{
            fontSize: '0.75rem',
            opacity: 0.5,
            maxWidth: '90%',
            overflow: 'auto',
            padding: '0.5rem',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '4px',
          }}>
            {String(this.state.error?.message || this.state.error || '未知错误')}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '0.5rem 1.5rem',
              border: '1px solid #b8935a',
              borderRadius: '4px',
              background: 'transparent',
              color: '#b8935a',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}