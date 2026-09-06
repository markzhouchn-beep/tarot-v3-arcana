// ============================================================
// screens/Admin.tsx · 管理后台 v2（2026-09-06 重构）
// 暗色主题 + 侧边栏分组 + SVG 可视化 + 操作日志
// 11 个 Tab：总览/漏斗/续费率/订单/订阅/用户/AI成本/YesNo/敏感词/反馈/匿名/操作日志
// 鉴权：Basic Auth（localStorage 存）
// ============================================================

import { useEffect, useState, useMemo } from 'react';
import { adminApi } from '../lib/api';

// ============================================================
// 类型 & 路由表
// ============================================================

type TabKey =
  | 'overview'
  | 'funnel'
  | 'renewal'
  | 'orders'
  | 'subscriptions'
  | 'users'
  | 'ai-cost'
  | 'yesno'
  | 'alerts'
  | 'feedback'
  | 'anonymous'
  | 'action-logs';

type Group = { id: string; label: string; icon: string; items: Array<{ key: TabKey; label: string; icon: string }> };

const GROUPS: Group[] = [
  {
    id: 'biz', label: '经营', icon: '📈',
    items: [
      { key: 'overview', label: '总览', icon: '📊' },
      { key: 'funnel', label: '转化漏斗', icon: '🔍' },
      { key: 'renewal', label: '续费率', icon: '🔁' },
    ],
  },
  {
    id: 'trade', label: '交易', icon: '💰',
    items: [
      { key: 'orders', label: '订单', icon: '💳' },
      { key: 'subscriptions', label: '订阅', icon: '🌙' },
      { key: 'users', label: '用户', icon: '👥' },
    ],
  },
  {
    id: 'ai', label: 'AI / 风险', icon: '🤖',
    items: [
      { key: 'ai-cost', label: 'AI 成本', icon: '🤖' },
      { key: 'yesno', label: 'Yes/No', icon: '🔮' },
      { key: 'alerts', label: '敏感词', icon: '⚠️' },
      { key: 'feedback', label: '反馈', icon: '💬' },
      { key: 'anonymous', label: '匿名用户', icon: '👤' },
    ],
  },
  {
    id: 'sys', label: '系统', icon: '⚙️',
    items: [
      { key: 'action-logs', label: '操作日志', icon: '📜' },
    ],
  },
];

const ALL_TABS: Record<TabKey, { label: string; icon: string; group: string }> = (() => {
  const m: any = {};
  GROUPS.forEach(g => g.items.forEach(it => m[it.key] = { ...it, group: g.id }));
  return m;
})();

// ============================================================
// 主组件
// ============================================================

export default function Admin() {
  const [authed, setAuthed] = useState(adminApi.isAuthed());
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [tab, setTab] = useState<TabKey>('overview');
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogin = async () => {
    adminApi.setAuth(user, pass);
    try {
      await adminApi.overview();
      setAuthed(true);
      setError('');
    } catch (err: any) {
      adminApi.clearAuth();
      setError('登录失败：' + (err.message || '请检查用户名密码'));
    }
  };

  const handleLogout = () => {
    adminApi.clearAuth();
    setAuthed(false);
    setUser('');
    setPass('');
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-bg-canvas flex items-center justify-center p-4 relative overflow-hidden">
        {/* Mystical Background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl animate-orb-breathe" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-secondary/10 blur-3xl animate-orb-breathe-slow" />
        </div>
        <div className="max-w-md w-full bg-bg-panel border border-border-soft rounded-lg shadow-glow-gold p-8 relative z-10">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3 animate-float-y">🔒</div>
            <h1 className="text-2xl font-display text-primary tracking-wide">ARCANA</h1>
            <p className="text-xs text-fg-secondary mt-2 tracking-widest uppercase">管理后台 · Admin v2</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-fg-secondary mb-1.5 tracking-wider uppercase">用户名</label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full px-4 py-2.5 bg-bg-occult border border-border rounded text-fg placeholder-fg-faint focus:outline-none focus:border-primary focus:shadow-glow-gold transition"
                placeholder="mark"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-secondary mb-1.5 tracking-wider uppercase">密码</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-2.5 bg-bg-occult border border-border rounded text-fg placeholder-fg-faint focus:outline-none focus:border-primary focus:shadow-glow-gold transition"
              />
            </div>
            {error && (
              <div className="text-sm text-secondary-bright bg-secondary/10 border border-secondary/30 p-3 rounded">
                {error}
              </div>
            )}
            <button
              onClick={handleLogin}
              className="w-full py-2.5 bg-primary hover:bg-primary-light text-bg-canvas rounded font-medium tracking-wider uppercase transition shadow-glow-gold"
            >
              进入后台
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeMeta = ALL_TABS[tab];

  return (
    <div className="min-h-screen bg-bg-canvas text-fg flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-bg-occult border-r border-border-soft flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border-soft">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-pulse">✨</span>
              <span className="font-display text-primary text-lg tracking-wider">ARCANA</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-fg-secondary hover:text-primary text-lg"
            title={sidebarOpen ? '收起' : '展开'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4">
          {GROUPS.map((g) => (
            <div key={g.id} className="mb-4">
              {sidebarOpen && (
                <div className="px-4 mb-2 text-xxs text-fg-faint tracking-widest uppercase">
                  {g.icon} {g.label}
                </div>
              )}
              {g.items.map((it) => {
                const isActive = tab === it.key;
                return (
                  <button
                    key={it.key}
                    onClick={() => setTab(it.key)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition relative ${
                      isActive
                        ? 'bg-primary/10 text-primary border-l-2 border-primary'
                        : 'text-fg-secondary hover:bg-bg-panel hover:text-fg border-l-2 border-transparent'
                    }`}
                    title={it.label}
                  >
                    <span className="text-base">{it.icon}</span>
                    {sidebarOpen && <span className="font-medium">{it.label}</span>}
                    {isActive && sidebarOpen && (
                      <span className="ml-auto text-primary-light">●</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-border-soft">
          <div className={`flex items-center gap-2 ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary text-sm font-display">
              M
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-sm text-fg truncate">mark</div>
                <div className="text-xxs text-fg-faint">v3.0 admin</div>
              </div>
            )}
            {sidebarOpen && (
              <button onClick={handleLogout} className="text-xxs text-fg-faint hover:text-secondary-bright" title="退出">
                退出
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 bg-bg-panel border-b border-border-soft flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">{activeMeta?.icon}</span>
            <h1 className="font-display text-lg text-fg">{activeMeta?.label}</h1>
            <span className="text-xxs text-fg-faint px-2 py-0.5 bg-bg-occult rounded">
              {GROUPS.find(g => g.id === activeMeta?.group)?.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xxs text-fg-faint">
            <span className="font-mono">{new Date().toLocaleString('zh-CN', { hour12: false })}</span>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {tab === 'overview' && <OverviewTab setTab={setTab} />}
          {tab === 'funnel' && <FunnelTab />}
          {tab === 'renewal' && <RenewalTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'subscriptions' && <SubscriptionsTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'ai-cost' && <AICostTab />}
          {tab === 'yesno' && <YesNoTab />}
          {tab === 'alerts' && <AlertsTab />}
          {tab === 'feedback' && <FeedbackTab />}
          {tab === 'anonymous' && <AnonymousTab />}
          {tab === 'action-logs' && <ActionLogsTab />}
        </div>
      </main>
    </div>
  );
}

// ============================================================
// 公共组件
// ============================================================

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const show = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  const ToastView = toast ? (
    <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-lg shadow-glow-gold-lg border backdrop-blur animate-fade-in ${
      toast.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-100' :
      toast.type === 'error' ? 'bg-secondary/20 border-secondary/50 text-secondary-bright' :
      'bg-primary/20 border-primary/50 text-primary-light'
    }`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>{toast.msg}</span>
      </div>
    </div>
  ) : null;
  return { show, ToastView };
}

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-fg-faint">
      <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
      <div className="text-sm">加载中…</div>
    </div>
  );
}

function Empty({ icon = '✨', text = '暂无数据' }: { icon?: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-fg-faint">
      <div className="text-4xl mb-3 opacity-50">{icon}</div>
      <div className="text-sm">{text}</div>
    </div>
  );
}

function ErrorBox({ err, onRetry }: { err: string; onRetry?: () => void }) {
  return (
    <div className="p-4 bg-secondary/10 border border-secondary/30 rounded text-secondary-bright">
      <div className="flex items-center justify-between">
        <span className="text-sm">❌ {err}</span>
        {onRetry && <button onClick={onRetry} className="text-xs underline hover:no-underline">重试</button>}
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, color = 'primary', trend,
}: {
  label: string;
  value: any;
  sub?: string;
  color?: 'primary' | 'green' | 'red' | 'blue' | 'purple';
  trend?: number;
}) {
  const colorMap = {
    primary: 'from-primary/20 to-primary/5 text-primary border-primary/30',
    green: 'from-green-500/20 to-green-500/5 text-green-400 border-green-500/30',
    red: 'from-secondary/20 to-secondary/5 text-secondary-bright border-secondary/30',
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-500/5 text-purple-400 border-purple-500/30',
  };
  return (
    <div className={`p-5 bg-gradient-to-br ${colorMap[color]} border rounded-lg`}>
      <div className="text-xxs uppercase tracking-widest opacity-70 mb-1.5">{label}</div>
      <div className="font-display text-3xl mb-1">{value}</div>
      {sub && <div className="text-xs opacity-70">{sub}</div>}
      {trend !== undefined && (
        <div className={`text-xxs mt-2 ${trend >= 0 ? 'text-green-400' : 'text-secondary-bright'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: any; action?: any }) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Panel({ children, className = '' }: { children: any; className?: string }) {
  return <div className={`bg-bg-panel border border-border-soft rounded-lg ${className}`}>{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    refunded: 'bg-secondary/20 text-secondary-bright border-secondary/30',
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    expired: 'bg-fg-faint/20 text-fg-faint border-fg-faint/30',
    handled: 'bg-green-500/20 text-green-400 border-green-500/30',
    closed: 'bg-fg-faint/20 text-fg-faint border-fg-faint/30',
    yes: 'bg-green-500/20 text-green-400 border-green-500/30',
    no: 'bg-secondary/20 text-secondary-bright border-secondary/30',
    uncertain: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span className={`px-2 py-0.5 text-xxs rounded border ${map[status] || 'bg-fg-faint/20 text-fg-secondary border-fg-faint/30'}`}>
      {status}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, { cls: string; lbl: string }> = {
    gold: { cls: 'bg-primary/20 text-primary border-primary/40', lbl: '金月' },
    silver: { cls: 'bg-fg-faint/20 text-fg-secondary border-fg-faint/40', lbl: '银月' },
    registered: { cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40', lbl: '注册' },
    guest: { cls: 'bg-fg-faint/10 text-fg-faint border-fg-faint/20', lbl: '访客' },
  };
  const c = map[tier] || { cls: 'bg-fg-faint/20 text-fg-faint border-fg-faint/30', lbl: tier };
  return <span className={`px-2 py-0.5 text-xxs rounded border ${c.cls}`}>{c.lbl}</span>;
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    bug: '🐛 Bug', suggestion: '💡 建议', praise: '❤️ 表扬', other: '📝 其他',
  };
  return <span className="px-2 py-0.5 text-xxs rounded bg-bg-occult text-fg-secondary border border-border-soft">{labels[type] || type}</span>;
}

function Modal({ open, onClose, title, children, width = 'max-w-2xl' }: { open: boolean; onClose: () => void; title: string; children: any; width?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className={`bg-bg-panel border border-border rounded-lg ${width} w-full max-h-[90vh] overflow-hidden shadow-glow-gold-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border-soft flex items-center justify-between">
          <h3 className="font-display text-lg text-primary">{title}</h3>
          <button onClick={onClose} className="text-fg-secondary hover:text-fg w-6 h-6 flex items-center justify-center">×</button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-4rem)]">{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// SVG 可视化组件
// ============================================================

function LineChart({
  data, xKey, yKey, height = 100, color = '#c8985b', area = true, formatY = (v: number) => v.toFixed(2),
}: {
  data: any[]; xKey: string; yKey: string; height?: number; color?: string; area?: boolean; formatY?: (v: number) => string;
}) {
  if (!data || data.length === 0) return <div className="text-xxs text-fg-faint text-center py-4">暂无趋势</div>;
  const width = 600;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const ys = data.map(d => d[yKey]);
  const maxY = Math.max(...ys, 1);
  const minY = 0;
  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points = data.map((d, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + innerH - ((d[yKey] - minY) / (maxY - minY)) * innerH,
    raw: d,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L${points[points.length - 1].x},${padding.top + innerH} L${points[0].x},${padding.top + innerH} Z`;
  const yTicks = 4;
  const safeId = `grad-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={safeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[...Array(yTicks + 1)].map((_, i) => {
        const y = padding.top + (innerH / yTicks) * i;
        const value = maxY - (maxY / yTicks) * i;
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2={padding.left + innerW} y2={y} stroke="rgba(200, 152, 91, 0.08)" />
            <text x={padding.left - 5} y={y + 3} textAnchor="end" fontSize="9" fill="#8a7a64">{formatY(value)}</text>
          </g>
        );
      })}
      {area && <path d={areaPath} fill={`url(#${safeId})`} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="2.5" fill={color} />
          <title>{`${p.raw[xKey]}: ${formatY(p.raw[yKey])}`}</title>
        </g>
      ))}
      {/* x 轴标签：首尾 */}
      {data.length > 0 && (
        <>
          <text x={padding.left} y={height - 5} fontSize="9" fill="#8a7a64">{data[0][xKey]}</text>
          <text x={padding.left + innerW} y={height - 5} textAnchor="end" fontSize="9" fill="#8a7a64">{data[data.length - 1][xKey]}</text>
        </>
      )}
    </svg>
  );
}

function DonutChart({ value, max = 100, label, color = '#c8985b', size = 100 }: {
  value: number; max?: number; label: string; color?: string; size?: number;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(200, 152, 91, 0.1)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0.2, 1)' }} />
      </svg>
      <div className="-mt-12 text-center">
        <div className="font-display text-xl text-fg">{(pct * 100).toFixed(1)}%</div>
        <div className="text-xxs text-fg-faint">{label}</div>
      </div>
    </div>
  );
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-fg">{label}</span>
        <span className="text-fg-secondary font-mono">
          {value} <span className="text-fg-faint text-xs">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-7 bg-bg-occult rounded overflow-hidden border border-border-soft">
        <div
          className="h-full transition-all duration-700 flex items-center justify-end px-2"
          style={{ width: `${Math.max(pct, 3)}%`, background: `linear-gradient(90deg, ${color}40, ${color})` }}
        >
          {pct > 15 && <span className="text-xxs text-bg-canvas font-bold">{pct.toFixed(0)}%</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 总览
// ============================================================

function OverviewTab({ setTab }: { setTab: (t: TabKey) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const refresh = () => {
    setLoading(true);
    setErr('');
    adminApi.overview()
      .then(setData)
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;
  if (err) return <ErrorBox err={err} onRetry={refresh} />;
  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title={`今日概览 · ${data.today}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="今日订单" value={data.orders} sub="已支付" color="primary" />
          <StatCard label="今日营收" value={`¥${(data.revenue || 0).toFixed(2)}`} sub="实收" color="green" />
          <StatCard label="活跃订阅" value={data.active_subs} sub="全部时长" color="blue" />
          <StatCard label="今日追问" value={data.oracle_calls_today} sub="AI 调用" color="purple" />
        </div>
      </Section>

      {data.pending_orders_warning > 0 && (
        <div className="p-4 bg-secondary/10 border border-secondary/40 rounded-lg flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="text-secondary-bright font-medium">有 {data.pending_orders_warning} 个待支付订单超过 30 分钟</div>
            <div className="text-xs text-fg-secondary mt-0.5">建议前往「订单」核对并手动补单</div>
          </div>
        </div>
      )}

      <Section title="快捷入口">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '🔍', label: '查看漏斗', tab: 'funnel' },
            { icon: '💳', label: '处理订单', tab: 'orders' },
            { icon: '🤖', label: 'AI 成本', tab: 'ai-cost' },
            { icon: '📜', label: '操作日志', tab: 'action-logs' },
          ].map((q) => (
            <a key={q.tab} onClick={() => setTab(q.tab as TabKey)} className="p-4 bg-bg-panel border border-border-soft rounded-lg hover:border-primary/50 hover:shadow-glow-gold cursor-pointer transition text-center">
              <div className="text-2xl mb-1">{q.icon}</div>
              <div className="text-sm text-fg-secondary">{q.label}</div>
            </a>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ============================================================
// 转化漏斗
// ============================================================

function FunnelTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const refresh = () => {
    setLoading(true);
    setErr('');
    adminApi.funnel().then(setData).catch((e: any) => setErr(e.message || '加载失败')).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;
  if (err) return <ErrorBox err={err} onRetry={refresh} />;
  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="核心转化漏斗">
        <Panel className="p-6">
          <FunnelBar label="注册用户" value={data.registered} total={data.registered} color="#3b82f6" />
          <FunnelBar label="发起订单" value={data.ordered} total={data.registered} color="#c8985b" />
          <FunnelBar label="完成付费" value={data.paid} total={data.registered} color="#22c55e" />
          <div className="mt-4 pt-4 border-t border-border-soft grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xxs text-fg-faint uppercase tracking-wider">注册→下单</div>
              <div className="font-display text-xl text-primary mt-1">
                {data.registered > 0 ? ((data.ordered / data.registered) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div>
              <div className="text-xxs text-fg-faint uppercase tracking-wider">下单→付费</div>
              <div className="font-display text-xl text-primary mt-1">
                {data.ordered > 0 ? ((data.paid / data.ordered) * 100).toFixed(1) : 0}%
              </div>
            </div>
            <div>
              <div className="text-xxs text-fg-faint uppercase tracking-wider">整体转化</div>
              <div className="font-display text-xl text-green-400 mt-1">
                {data.registered > 0 ? ((data.paid / data.registered) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        </Panel>
      </Section>

      {data.invites_funnel && (
        <Section title="邀请裂变漏斗">
          <Panel className="p-6">
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="总邀请" value={data.invites_funnel.total_invites} color="primary" />
              <StatCard label="注册" value={data.invites_funnel.registered} color="blue" />
              <StatCard label="有效动作" value={data.invites_funnel.effective} color="purple" />
              <StatCard label="付费" value={data.invites_funnel.paid} color="green" />
            </div>
          </Panel>
        </Section>
      )}
    </div>
  );
}

// ============================================================
// 续费率
// ============================================================

function RenewalTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const refresh = () => {
    setLoading(true);
    setErr('');
    adminApi.renewal().then(setData).catch((e: any) => setErr(e.message || '加载失败')).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;
  if (err) return <ErrorBox err={err} onRetry={refresh} />;
  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="续费率监控">
        <div className="grid grid-cols-3 gap-4">
          {data.windows.map((w: any) => (
            <Panel key={w.window_days} className="p-6 flex flex-col items-center">
              <DonutChart value={Number(w.renewal_rate)} max={100} label={`${w.window_days} 天窗口`} color={Number(w.renewal_rate) >= 30 ? '#22c55e' : Number(w.renewal_rate) >= 15 ? '#c8985b' : '#a83a3a'} />
              <div className="mt-4 text-xs text-fg-faint">{w.renewed} 续订 / {w.expired} 过期</div>
            </Panel>
          ))}
        </div>
      </Section>

      <Section title="即将过期（7 天内）">
        <Panel>
          {data.expiring_soon.length === 0 ? (
            <Empty icon="🌙" text="无即将过期订阅" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg-occult text-fg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">用户</th>
                  <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">等级</th>
                  <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">到期</th>
                </tr>
              </thead>
              <tbody>
                {data.expiring_soon.map((s: any) => (
                  <tr key={s.id} className="border-t border-border-soft hover:bg-bg-occult">
                    <td className="px-4 py-2.5 text-fg">{s.email}</td>
                    <td className="px-4 py-2.5"><TierBadge tier={s.tier} /></td>
                    <td className="px-4 py-2.5 text-fg-secondary text-xs">{new Date(s.expires_at).toLocaleDateString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </Section>
    </div>
  );
}

// ============================================================
// 订单
// ============================================================

function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<any>(null);

  const refresh = () => {
    setLoading(true);
    const params = statusFilter === 'all' ? { limit: 100 } : { status: statusFilter, limit: 100 };
    adminApi.orders(params)
      .then((d: any) => setOrders(d.orders || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, [statusFilter]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        {['all', 'paid', 'pending', 'refunded'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs rounded border transition ${
              statusFilter === s
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-bg-panel border-border-soft text-fg-secondary hover:border-primary/40'
            }`}
          >
            {s === 'all' ? '全部' : s}
          </button>
        ))}
        <span className="ml-auto text-xs text-fg-faint">{orders.length} 笔</span>
      </div>

      {loading ? <Loading /> : orders.length === 0 ? <Empty icon="💳" text="暂无订单" /> : (
        <Panel>
          <table className="w-full text-sm">
            <thead className="bg-bg-occult text-fg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">订单 ID</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">用户</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">档位</th>
                <th className="px-4 py-3 text-right text-xxs uppercase tracking-wider">金额</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">时间</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border-soft hover:bg-bg-occult">
                  <td className="px-4 py-2.5 font-mono text-xs text-fg-secondary">{o.id.slice(0, 8)}…</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-fg-faint">{o.user_id?.slice(0, 8) || '-'}</td>
                  <td className="px-4 py-2.5 text-fg">{o.plan || o.spread_type || o.tier || '-'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-fg">¥{(o.amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-fg-faint">{new Date(o.created_at).toLocaleString('zh-CN', { hour12: false })}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => setSelected(o)} className="text-xs text-primary hover:text-primary-light">详情</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <OrderDetailModal order={selected} onClose={() => { setSelected(null); refresh(); }} />
    </div>
  );
}

function OrderDetailModal({ order, onClose }: { order: any; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (!order) return;
    setLoading(true);
    adminApi.orderDetail(order.id)
      .then(setDetail)
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [order?.id]);

  if (!order) return null;

  const handleRefund = async () => {
    const reason = prompt('退款原因：');
    if (!reason) return;
    try {
      await adminApi.refundOrder(order.id, reason);
      toast.show('已退款', 'success');
      onClose();
    } catch (e: any) {
      toast.show('退款失败：' + (e.message || ''), 'error');
    }
  };

  return (
    <>
      <Modal open={!!order} onClose={onClose} title={`订单详情 · ${order.id.slice(0, 12)}…`}>
      {loading ? <Loading /> : err ? <ErrorBox err={err} /> : detail && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-fg-faint text-xs">订单 ID：</span><span className="font-mono text-xs">{detail.order.id}</span></div>
            <div><span className="text-fg-faint text-xs">状态：</span><StatusBadge status={detail.order.status} /></div>
            <div><span className="text-fg-faint text-xs">金额：</span><span className="text-primary font-mono">¥{(detail.order.amount || 0).toFixed(2)}</span></div>
            <div><span className="text-fg-faint text-xs">档位：</span>{detail.order.tier || detail.order.spread_type || '-'}</div>
            <div><span className="text-fg-faint text-xs">用户：</span>{detail.user?.email || <span className="text-fg-faint">匿名</span>}</div>
            <div><span className="text-fg-faint text-xs">创建：</span>{new Date(detail.order.created_at).toLocaleString('zh-CN', { hour12: false })}</div>
            {detail.order.paid_at > 0 && (
              <div><span className="text-fg-faint text-xs">支付：</span>{new Date(detail.order.paid_at).toLocaleString('zh-CN', { hour12: false })}</div>
            )}
            {detail.order.refunded_at > 0 && (
              <div><span className="text-fg-faint text-xs">退款：</span>{new Date(detail.order.refunded_at).toLocaleString('zh-CN', { hour12: false })}</div>
            )}
          </div>

          {/* 时间线 */}
          <div>
            <h4 className="text-sm font-medium text-fg mb-2">时间线</h4>
            <div className="space-y-2 border-l-2 border-border-soft pl-4">
              <TimelineNode time={detail.order.created_at} label="创建订单" color="blue" />
              {detail.order.paid_at > 0 && <TimelineNode time={detail.order.paid_at} label="支付完成" color="green" />}
              {detail.order.interpreted_at > 0 && <TimelineNode time={detail.order.interpreted_at} label="解读完成" color="primary" />}
              {detail.order.refunded_at > 0 && <TimelineNode time={detail.order.refunded_at} label={`退款：${detail.order.refund_reason || ''}`} color="red" />}
            </div>
          </div>

          {detail.readings && detail.readings.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-fg mb-2">关联解读</h4>
              <div className="space-y-1 text-xs">
                {detail.readings.map((r: any) => (
                  <div key={r.id} className="p-2 bg-bg-occult rounded">
                    <span className="font-mono text-fg-faint">{r.id.slice(0, 8)}</span>
                    <span className="ml-2 text-fg-secondary">{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail.order.status === 'paid' && (
            <div className="pt-4 border-t border-border-soft flex gap-2">
              <button onClick={handleRefund} className="px-4 py-2 bg-secondary hover:bg-secondary-bright text-fg rounded text-sm">
                退款
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
    {toast.ToastView}
    </>
  );
}

function TimelineNode({ time, label, color }: { time: number; label: string; color: 'blue' | 'green' | 'primary' | 'red' }) {
  const colorMap = { blue: 'bg-blue-500', green: 'bg-green-500', primary: 'bg-primary', red: 'bg-secondary' };
  return (
    <div className="flex items-start gap-2 relative">
      <div className={`absolute -left-[1.4rem] top-1 w-3 h-3 rounded-full ${colorMap[color]}`} />
      <div className="text-xxs text-fg-faint font-mono w-32 shrink-0">
        {new Date(time).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-sm text-fg">{label}</div>
    </div>
  );
}

// ============================================================
// 订阅
// ============================================================

function SubscriptionsTab() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('all');
  const toast = useToast();

  const refresh = () => {
    setLoading(true);
    const params = tierFilter === 'all' ? {} : { tier: tierFilter };
    adminApi.subscriptions(params)
      .then((d: any) => setSubs(d.subscriptions || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, [tierFilter]);

  const handleExtend = async (id: string, days: number) => {
    if (!confirm(`续期 ${days} 天？`)) return;
    try {
      await adminApi.extendSubscription(id, days);
      toast.show(`已续期 ${days} 天`, 'success');
      refresh();
    } catch (e: any) {
      toast.show('续期失败：' + (e.message || ''), 'error');
    }
  };

  return (
    <>
      {toast.ToastView}
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-2">
          {['all', 'gold', 'silver'].map((t) => (
          <button
            key={t}
            onClick={() => setTierFilter(t)}
            className={`px-3 py-1.5 text-xs rounded border transition ${
              tierFilter === t
                ? 'bg-primary/20 border-primary text-primary'
                : 'bg-bg-panel border-border-soft text-fg-secondary hover:border-primary/40'
            }`}
          >
            {t === 'all' ? '全部' : t === 'gold' ? '金月' : '银月'}
          </button>
        ))}
        <span className="ml-auto text-xs text-fg-faint">{subs.length} 条</span>
      </div>

      {loading ? <Loading /> : subs.length === 0 ? <Empty icon="🌙" text="暂无订阅" /> : (
        <Panel>
          <table className="w-full text-sm">
            <thead className="bg-bg-occult text-fg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">用户</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">等级</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">到期</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">来源</th>
                <th className="px-4 py-3 text-right text-xxs uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-t border-border-soft hover:bg-bg-occult">
                  <td className="px-4 py-2.5 font-mono text-xs text-fg-secondary">{s.user_id?.slice(0, 8)}…</td>
                  <td className="px-4 py-2.5"><TierBadge tier={s.tier} /></td>
                  <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-fg-secondary">{new Date(s.expires_at).toLocaleDateString('zh-CN')}</td>
                  <td className="px-4 py-2.5 text-xs text-fg-faint">{s.source || '-'}</td>
                  <td className="px-4 py-2.5 text-right space-x-2">
                    <button onClick={() => handleExtend(s.id, 30)} className="text-xs text-primary hover:text-primary-light">+30天</button>
                    <button onClick={() => handleExtend(s.id, 90)} className="text-xs text-primary hover:text-primary-light">+90天</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      </div>
    </>
  );
}

// ============================================================
// 用户
// ============================================================

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  // debounce 搜索（300ms）
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const refresh = () => {
    setLoading(true);
    const params: any = { limit: 50 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (tierFilter !== 'all') params.tier = tierFilter;
    adminApi.users(params)
      .then((d: any) => setUsers(d.users || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, [debouncedSearch, tierFilter]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="搜索邮箱 / 昵称…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 bg-bg-panel border border-border-soft rounded text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-primary"
        />
        <div className="flex gap-1">
          {['all', 'gold', 'silver', 'registered', 'guest'].map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 text-xs rounded border transition ${
                tierFilter === t
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-bg-panel border-border-soft text-fg-secondary hover:border-primary/40'
              }`}
            >
              {t === 'all' ? '全部' : t === 'gold' ? '金月' : t === 'silver' ? '银月' : t === 'registered' ? '注册' : '访客'}
            </button>
          ))}
        </div>
        <span className="text-xs text-fg-faint">{users.length} 人</span>
      </div>

      {loading ? <Loading /> : users.length === 0 ? <Empty icon="👥" text="无匹配用户" /> : (
        <Panel>
          <table className="w-full text-sm">
            <thead className="bg-bg-occult text-fg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">邮箱</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">昵称</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">等级</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">邀请码</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">注册</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border-soft hover:bg-bg-occult">
                  <td className="px-4 py-2.5 text-fg">{u.email}</td>
                  <td className="px-4 py-2.5 text-fg-secondary text-xs">{u.nickname || '-'}</td>
                  <td className="px-4 py-2.5"><TierBadge tier={u.tier} /></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-fg-faint">{u.invite_code || '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-fg-faint">{new Date(u.created_at).toLocaleDateString('zh-CN')}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => setSelected(u)} className="text-xs text-primary hover:text-primary-light">详情</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <UserDetailModal user={selected} onClose={() => { setSelected(null); refresh(); }} />
    </div>
  );
}

function UserDetailModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newTier, setNewTier] = useState('silver');
  const [extendDays, setExtendDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'overview' | 'orders' | 'asks'>('overview');
  const toast = useToast();

  const loadDetail = () => {
    setLoadError(null);
    setDetail(null);
    adminApi.userDetail(user.id)
      .then((d: any) => {
        if (d?.error) setLoadError(d.message || d.error);
        else {
          setDetail(d);
          setNewTier(d.user.tier === 'guest' || d.user.tier === 'registered' ? 'silver' : d.user.tier);
        }
      })
      .catch((err: any) => setLoadError(err.message || '加载失败'));
  };

  useEffect(() => { if (user) loadDetail(); }, [user?.id]);

  const handleTierChange = async () => {
    setSaving(true);
    try {
      const expires_at = (newTier === 'silver' || newTier === 'gold')
        ? Date.now() + extendDays * 24 * 3600 * 1000
        : undefined;
      await adminApi.changeUserTier(user.id, newTier, expires_at, 'admin manual');
      toast.show(`已调整为 ${newTier}${expires_at ? '（' + extendDays + ' 天）' : ''}`, 'success');
      loadDetail();
    } catch (e: any) {
      toast.show('调整失败：' + (e.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleGrantQuota = async () => {
    setSaving(true);
    try {
      await adminApi.grantQuota(user.id, 'oracle_asks', 10, 'admin grant');
      toast.show('已赠送 10 次追问', 'success');
      loadDetail();
    } catch (e: any) {
      toast.show('赠送失败：' + (e.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {toast.ToastView}
      <Modal open={!!user} onClose={onClose} title={`用户详情 · ${user.email}`} width="max-w-3xl">
        {loadError ? <ErrorBox err={loadError} onRetry={loadDetail} /> : !detail ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-fg-faint text-xs">邮箱：</span><span className="text-fg">{detail.user.email}</span></div>
            <div><span className="text-fg-faint text-xs">昵称：</span><span className="text-fg">{detail.user.nickname || '-'}</span></div>
            <div><span className="text-fg-faint text-xs">等级：</span><TierBadge tier={detail.user.tier} /></div>
            <div><span className="text-fg-faint text-xs">邀请码：</span><code className="text-primary text-xs">{detail.user.invite_code}</code></div>
            <div><span className="text-fg-faint text-xs">注册：</span><span className="text-fg-secondary text-xs">{new Date(detail.user.created_at).toLocaleString('zh-CN', { hour12: false })}</span></div>
            <div><span className="text-fg-faint text-xs">积分：</span><span className="text-primary font-mono">{detail.user.points || 0}</span></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard label="追问次数" value={detail.stats.oracle_calls} sub={`成本 ¥${(detail.stats.oracle_cost || 0).toFixed(4)}`} color="purple" />
            <StatCard label="邀请人数" value={detail.stats.invites_sent} color="blue" />
            <StatCard label="订单数" value={detail.orders.length} color="primary" />
          </div>

          <div className="flex gap-2 border-b border-border-soft">
            {(['overview', 'orders', 'asks'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-xs ${tab === t ? 'text-primary border-b-2 border-primary' : 'text-fg-secondary'}`}>
                {t === 'overview' ? '调整' : t === 'orders' ? '订单' : '订阅'}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm text-fg mb-2">调整等级</h4>
                <div className="flex gap-2 items-center">
                  <select value={newTier} onChange={(e) => setNewTier(e.target.value)} className="px-3 py-2 bg-bg-occult border border-border-soft rounded text-sm text-fg">
                    <option value="registered">注册用户</option>
                    <option value="silver">银月</option>
                    <option value="gold">金月</option>
                    <option value="guest">访客</option>
                  </select>
                  {(newTier === 'silver' || newTier === 'gold') && (
                    <div className="flex items-center gap-1">
                      <input type="number" value={extendDays} onChange={(e) => setExtendDays(parseInt(e.target.value) || 30)}
                        className="w-20 px-2 py-2 bg-bg-occult border border-border-soft rounded text-sm text-fg" />
                      <span className="text-xs text-fg-faint">天</span>
                    </div>
                  )}
                  <button onClick={handleTierChange} disabled={saving}
                    className="px-4 py-2 bg-primary hover:bg-primary-light text-bg-canvas rounded text-sm font-medium disabled:opacity-50">
                    {saving ? '处理中…' : '应用'}
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-sm text-fg mb-2">赠送配额</h4>
                <button onClick={handleGrantQuota} disabled={saving}
                  className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/40 rounded text-sm disabled:opacity-50">
                  赠送 10 次追问
                </button>
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="space-y-1 text-xs max-h-60 overflow-y-auto">
              {detail.orders.length === 0 ? <Empty icon="💳" text="无订单" /> : detail.orders.map((o: any) => (
                <div key={o.id} className="flex justify-between p-2 bg-bg-occult rounded">
                  <span className="font-mono text-fg-faint">{o.id.slice(0, 8)}</span>
                  <span className="text-fg">{o.tier || o.spread_type || '-'}</span>
                  <span className="text-primary font-mono">¥{(o.amount || 0).toFixed(2)}</span>
                  <StatusBadge status={o.status} />
                </div>
              ))}
            </div>
          )}

          {tab === 'asks' && (
            <div className="space-y-1 text-xs">
              {detail.subscriptions.length === 0 ? <Empty icon="🌙" text="无订阅" /> : detail.subscriptions.map((s: any) => (
                <div key={s.id} className="flex justify-between p-2 bg-bg-occult rounded">
                  <TierBadge tier={s.tier} />
                  <span className="text-fg-secondary">到期 {new Date(s.expires_at).toLocaleDateString('zh-CN')}</span>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </Modal>
    </>
  );
}

// ============================================================
// AI 成本
// ============================================================

function AICostTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const refresh = () => {
    setLoading(true);
    setErr('');
    adminApi.aiCost().then(setData).catch((e: any) => setErr(e.message || '加载失败')).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;
  if (err) return <ErrorBox err={err} onRetry={refresh} />;
  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="成本概览">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="今日" value={`${data.today.calls} 次`} sub={`¥${(data.today.cost || 0).toFixed(4)}`} color="primary" />
          <StatCard label="本周" value={`${data.week.calls} 次`} sub={`¥${(data.week.cost || 0).toFixed(4)}`} color="blue" />
          <StatCard label="本月" value={`${data.month.calls} 次`} sub={`¥${(data.month.cost || 0).toFixed(4)}`} color="purple" />
        </div>
      </Section>

      <Section title="每日趋势（最近 30 天）">
        <Panel className="p-5">
          <LineChart data={[...(data.daily || [])].reverse()} xKey="day" yKey="cost" height={160} color="#c8985b" formatY={(v) => `¥${v.toFixed(2)}`} />
        </Panel>
      </Section>

      <Section title="Top 10 高调用用户（本月）">
        {data.top_users.length === 0 ? <Empty icon="🤖" text="本月无调用" /> : (
          <Panel>
            <table className="w-full text-sm">
              <thead className="bg-bg-occult text-fg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">用户</th>
                  <th className="px-4 py-3 text-right text-xxs uppercase tracking-wider">调用</th>
                  <th className="px-4 py-3 text-right text-xxs uppercase tracking-wider">成本</th>
                </tr>
              </thead>
              <tbody>
                {data.top_users.map((u: any) => (
                  <tr key={u.user_id} className="border-t border-border-soft hover:bg-bg-occult">
                    <td className="px-4 py-2.5 font-mono text-xs text-fg-faint">{u.user_id?.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg">{u.calls}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-primary">¥{(u.cost || 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </Section>
    </div>
  );
}

// ============================================================
// Yes/No
// ============================================================

function YesNoTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const refresh = () => {
    setLoading(true);
    setErr('');
    adminApi.yesnoStats().then(setData).catch((e: any) => setErr(e.message || '加载失败')).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;
  if (err) return <ErrorBox err={err} onRetry={refresh} />;
  if (!data) return null;

  const resultColors: any = { yes: '#22c55e', no: '#a83a3a', uncertain: '#e0b878' };
  const total = (data.by_result || []).reduce((s: number, b: any) => s + (b.cnt || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="结果分布">
        <div className="grid grid-cols-3 gap-4">
          {(['yes', 'no', 'uncertain'] as const).map((r) => {
            const item = (data.by_result || []).find((b: any) => b.result === r);
            const count = item?.cnt || 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            const labels: any = { yes: '✅ Yes', no: '❌ No', uncertain: '🤔 Uncertain' };
            return (
              <Panel key={r} className="p-5 text-center">
                <div className="font-display text-4xl mb-1" style={{ color: resultColors[r] }}>{count}</div>
                <div className="text-sm text-fg-secondary">{labels[r]}</div>
                <div className="text-xxs text-fg-faint mt-1">{pct.toFixed(1)}%</div>
              </Panel>
            );
          })}
        </div>
      </Section>

      {data.trend && data.trend.length > 0 && (
        <Section title="7 天趋势">
          <Panel className="p-5">
            <LineChart data={data.trend} xKey="day" yKey="cnt" height={140} color="#c8985b" area={false} formatY={(v) => v.toFixed(0)} />
          </Panel>
        </Section>
      )}

      {data.by_intent && data.by_intent.length > 0 && (
        <Section title="问题关键词 Top 10">
          <Panel>
            <table className="w-full text-sm">
              <thead className="bg-bg-occult text-fg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">关键词</th>
                  <th className="px-4 py-3 text-right text-xxs uppercase tracking-wider">次数</th>
                </tr>
              </thead>
              <tbody>
                {data.by_intent.map((item: any, i: number) => (
                  <tr key={i} className="border-t border-border-soft">
                    <td className="px-4 py-2.5 text-fg">{item.intent || '(无)'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-primary">{item.cnt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </Section>
      )}

      <StatCard label="总抽卡次数" value={data.total} color="primary" />
    </div>
  );
}

// ============================================================
// 敏感词告警
// ============================================================

function AlertsTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [err, setErr] = useState('');

  const refresh = () => {
    setLoading(true);
    setErr('');
    adminApi.sensitiveAlerts(showResolved)
      .then((d: any) => setAlerts(d.alerts || []))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, [showResolved]);

  const handleResolve = async (id: string) => {
    await adminApi.resolveAlert(id);
    refresh();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowResolved(false)}
          className={`px-3 py-1.5 text-xs rounded border ${!showResolved ? 'bg-primary/20 border-primary text-primary' : 'bg-bg-panel border-border-soft text-fg-secondary'}`}
        >未处理</button>
        <button
          onClick={() => setShowResolved(true)}
          className={`px-3 py-1.5 text-xs rounded border ${showResolved ? 'bg-primary/20 border-primary text-primary' : 'bg-bg-panel border-border-soft text-fg-secondary'}`}
        >已处理</button>
        <span className="ml-auto text-xs text-fg-faint">{alerts.length} 条</span>
      </div>

      {err && <ErrorBox err={err} onRetry={refresh} />}
      {loading ? <Loading /> : alerts.length === 0 ? <Empty icon="🎉" text="无告警" /> : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <Panel key={a.id} className={`p-4 ${a.resolved ? 'opacity-60' : 'border-secondary/40'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xxs text-fg-faint font-mono">{new Date(a.created_at).toLocaleString('zh-CN', { hour12: false })}</span>
                <span className="text-xxs text-secondary-bright font-medium uppercase tracking-wider">{a.action || '未分类'}</span>
              </div>
              <div className="text-sm text-fg">{a.content}</div>
              {a.flagged_keywords && (
                <div className="text-xxs text-fg-faint mt-2 font-mono">
                  关键词：{a.flagged_keywords}
                </div>
              )}
              {!a.resolved && (
                <button onClick={() => handleResolve(a.id)} className="mt-3 px-3 py-1.5 bg-primary hover:bg-primary-light text-bg-canvas rounded text-xs font-medium">
                  标记已处理
                </button>
              )}
              {a.resolved && (
                <span className="text-xxs text-green-400 mt-2 inline-block">✅ 已处理 · {new Date(a.resolved_at).toLocaleString('zh-CN', { hour12: false })}</span>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 反馈
// ============================================================

function FeedbackTab() {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [err, setErr] = useState('');

  const refresh = () => {
    setLoading(true);
    setErr('');
    const params: any = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    if (typeFilter !== 'all') params.type = typeFilter;
    adminApi.feedback(params)
      .then((d: any) => setFeedback(d.feedback || []))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, [statusFilter, typeFilter]);

  const handleHandle = async (id: string) => {
    const note = prompt('处理备注：');
    if (note === null) return;
    await adminApi.handleFeedback(id, note);
    refresh();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all', lbl: '全部状态' },
          { key: 'pending', lbl: '待处理' },
          { key: 'handled', lbl: '已处理' },
        ].map((s) => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            className={`px-3 py-1.5 text-xs rounded border ${statusFilter === s.key ? 'bg-primary/20 border-primary text-primary' : 'bg-bg-panel border-border-soft text-fg-secondary'}`}>
            {s.lbl}
          </button>
        ))}
        <span className="w-px h-4 bg-border-soft" />
        {[
          { key: 'all', lbl: '全部类型' },
          { key: 'bug', lbl: '🐛 Bug' },
          { key: 'suggestion', lbl: '💡 建议' },
          { key: 'praise', lbl: '❤️ 表扬' },
          { key: 'other', lbl: '📝 其他' },
        ].map((s) => (
          <button key={s.key} onClick={() => setTypeFilter(s.key)}
            className={`px-3 py-1.5 text-xs rounded border ${typeFilter === s.key ? 'bg-primary/20 border-primary text-primary' : 'bg-bg-panel border-border-soft text-fg-secondary'}`}>
            {s.lbl}
          </button>
        ))}
        <span className="ml-auto text-xs text-fg-faint">{feedback.length} 条</span>
      </div>

      {err && <ErrorBox err={err} onRetry={refresh} />}
      {loading ? <Loading /> : feedback.length === 0 ? <Empty icon="💬" text="无反馈" /> : (
        <div className="space-y-2">
          {feedback.map((f) => (
            <Panel key={f.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TypeBadge type={f.type} />
                  <span className="text-xs text-fg-faint">{f.email || '匿名'}</span>
                  <span className="text-xxs text-fg-faint">·</span>
                  <span className="text-xxs text-fg-faint font-mono">{new Date(f.created_at).toLocaleString('zh-CN', { hour12: false })}</span>
                </div>
                <StatusBadge status={f.status} />
              </div>
              <div className="text-sm text-fg whitespace-pre-wrap">{f.content}</div>
              {f.contact && <div className="text-xxs text-fg-faint mt-1.5">📧 {f.contact}</div>}
              {f.page_url && <div className="text-xxs text-fg-faint mt-0.5">来源: {f.page_url}</div>}
              {f.status === 'pending' && (
                <button onClick={() => handleHandle(f.id)} className="mt-3 px-3 py-1.5 bg-primary hover:bg-primary-light text-bg-canvas rounded text-xs font-medium">
                  标记已处理
                </button>
              )}
              {f.admin_note && (
                <div className="mt-2 p-2 bg-bg-occult rounded text-xxs text-fg-secondary">
                  处理备注：{f.admin_note}
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 匿名用户
// ============================================================

function AnonymousTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const refresh = () => {
    setLoading(true);
    setErr('');
    adminApi.anonymousStats().then(setData).catch((e: any) => setErr(e.message || '加载失败')).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  if (loading) return <Loading />;
  if (err) return <ErrorBox err={err} onRetry={refresh} />;
  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="匿名设备">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="设备数" value={data.total_devices} color="primary" />
          <StatCard label="发起订单" value={data.ordered_devices} color="blue" />
          <StatCard label="完成付费" value={data.paid_devices} color="green" />
          <StatCard
            label="付费转化"
            value={data.ordered_devices > 0 ? `${((data.paid_devices / data.ordered_devices) * 100).toFixed(1)}%` : '0%'}
            color="purple"
          />
        </div>
      </Section>

      {data.comparison && (
        <Section title="匿名 vs 登录">
          <div className="grid grid-cols-2 gap-4">
            <Panel className="p-5">
              <div className="text-xs text-fg-faint uppercase tracking-wider mb-1">登录用户</div>
              <div className="font-display text-3xl text-fg">{data.comparison.logged_in}</div>
              <div className="text-xxs text-fg-faint mt-1">付费率 {data.comparison.logged_in_rate}</div>
            </Panel>
            <Panel className="p-5">
              <div className="text-xs text-fg-faint uppercase tracking-wider mb-1">匿名用户</div>
              <div className="font-display text-3xl text-primary">{data.comparison.anonymous}</div>
              <div className="text-xxs text-fg-faint mt-1">付费率 {data.comparison.anonymous_rate}</div>
            </Panel>
          </div>
        </Section>
      )}

      {data.retention && data.retention.length > 0 && (
        <Section title="7 日留存">
          <Panel>
            <table className="w-full text-sm">
              <thead className="bg-bg-occult text-fg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">日期</th>
                  <th className="px-4 py-3 text-right text-xxs uppercase tracking-wider">新设备</th>
                  <th className="px-4 py-3 text-right text-xxs uppercase tracking-wider">活跃</th>
                  <th className="px-4 py-3 text-right text-xxs uppercase tracking-wider">次日留存</th>
                </tr>
              </thead>
              <tbody>
                {data.retention.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-border-soft hover:bg-bg-occult">
                    <td className="px-4 py-2.5 text-fg">{r.date}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg">{r.new_devices}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg">{r.active_devices}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={Number(r.retention_rate) >= 20 ? 'text-green-400' : Number(r.retention_rate) >= 10 ? 'text-primary' : 'text-secondary-bright'}>
                        {r.retention_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </Section>
      )}
    </div>
  );
}

// ============================================================
// 操作日志
// ============================================================

function ActionLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const refresh = () => {
    setLoading(true);
    setErr('');
    adminApi.actionLogs()
      .then((d: any) => setLogs(d.logs || []))
      .catch((e: any) => setErr(e.message || '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const actionLabels: Record<string, { lbl: string; color: string }> = {
    tier_change: { lbl: '改等级', color: 'text-primary' },
    quota_grant: { lbl: '赠配额', color: 'text-purple-400' },
    sub_extend: { lbl: '续期', color: 'text-blue-400' },
    order_refund: { lbl: '退款', color: 'text-secondary-bright' },
    alert_resolve: { lbl: '处理告警', color: 'text-yellow-400' },
    feedback_handle: { lbl: '处理反馈', color: 'text-green-400' },
  };

  const filtered = actionFilter === 'all' ? logs : logs.filter(l => l.action === actionFilter);

  const formatDetails = (s: string | null) => {
    if (!s) return '-';
    try {
      const obj = JSON.parse(s);
      return Object.entries(obj)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' · ');
    } catch {
      return s;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setActionFilter('all')} className={`px-3 py-1.5 text-xs rounded border ${actionFilter === 'all' ? 'bg-primary/20 border-primary text-primary' : 'bg-bg-panel border-border-soft text-fg-secondary'}`}>
          全部
        </button>
        {Object.entries(actionLabels).map(([k, v]) => (
          <button key={k} onClick={() => setActionFilter(k)} className={`px-3 py-1.5 text-xs rounded border ${actionFilter === k ? 'bg-primary/20 border-primary text-primary' : 'bg-bg-panel border-border-soft text-fg-secondary'}`}>
            {v.lbl}
          </button>
        ))}
        <button onClick={refresh} className="ml-auto px-3 py-1.5 text-xs text-fg-secondary hover:text-primary">↻ 刷新</button>
      </div>

      {err && <ErrorBox err={err} onRetry={refresh} />}
      {loading ? <Loading /> : filtered.length === 0 ? <Empty icon="📜" text="无操作记录" /> : (
        <Panel>
          <table className="w-full text-sm">
            <thead className="bg-bg-occult text-fg-secondary">
              <tr>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">时间</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">操作者</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">动作</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">目标</th>
                <th className="px-4 py-3 text-left text-xxs uppercase tracking-wider">详情</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const meta = actionLabels[l.action] || { lbl: l.action, color: 'text-fg-secondary' };
                return (
                  <tr key={l.id} className="border-t border-border-soft hover:bg-bg-occult">
                    <td className="px-4 py-2.5 text-xxs text-fg-faint font-mono whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('zh-CN', { hour12: false })}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-fg-secondary">{l.admin_user}</td>
                    <td className={`px-4 py-2.5 text-xs font-medium ${meta.color}`}>{meta.lbl}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="text-fg-faint">{l.target_type}:</span>{' '}
                      <span className="text-fg font-mono">{l.target_label || l.target_id?.slice(0, 8) || '-'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xxs text-fg-faint max-w-xs">
                      <span className="line-clamp-2">{formatDetails(l.details)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
