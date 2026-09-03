// ============================================================
// screens/Admin.tsx · 管理后台（Phase 5 + Phase 6）
// 创建：2026-09-02
// 7 个 Tab：Dashboard / Orders / Users / Subscriptions / AI Cost / Renewal / Feedback / Alerts
// 鉴权：Basic Auth（localStorage 存）
// ============================================================

import { useEffect, useState } from 'react';
import { adminApi } from '../lib/api';

type Tab = 'overview' | 'orders' | 'users' | 'subscriptions' | 'ai-cost' | 'renewal' | 'feedback' | 'alerts';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'overview', label: '总览', icon: '📊' },
  { key: 'orders', label: '订单', icon: '💳' },
  { key: 'users', label: '用户', icon: '👥' },
  { key: 'subscriptions', label: '订阅', icon: '🌙' },
  { key: 'ai-cost', label: 'AI 成本', icon: '🤖' },
  { key: 'renewal', label: '续费率', icon: '📈' },
  { key: 'feedback', label: '反馈', icon: '💬' },
  { key: 'alerts', label: '敏感词', icon: '⚠️' },
];

export default function Admin() {
  const [authed, setAuthed] = useState(adminApi.isAuthed());
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState('');

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
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-4">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">🔒</div>
            <h1 className="text-xl font-bold text-stone-800">ARCANA 管理后台</h1>
            <p className="text-sm text-stone-500 mt-1">仅限 Mark 访问</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-stone-600 mb-1">用户名</label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-amber-600"
                placeholder="mark"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-600 mb-1">密码</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-amber-600"
              />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            <button
              onClick={handleLogin}
              className="w-full py-2 bg-amber-700 hover:bg-amber-800 text-white rounded font-medium"
            >
              登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">✨</span>
          <h1 className="text-lg font-bold text-stone-800">ARCANA 管理后台</h1>
          <span className="text-xs text-stone-500 ml-2">v3.0 Phase 5+6</span>
        </div>
        <button onClick={handleLogout} className="text-sm text-stone-500 hover:text-red-600">
          退出
        </button>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-stone-200 px-2 overflow-x-auto">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                tab === t.key
                  ? 'text-amber-700 border-b-2 border-amber-700'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="p-4 max-w-6xl mx-auto">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'subscriptions' && <SubscriptionsTab />}
        {tab === 'ai-cost' && <AICostTab />}
        {tab === 'renewal' && <RenewalTab />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'alerts' && <AlertsTab />}
      </main>
    </div>
  );
}

// ============================================================
// 总览
// ============================================================

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.overview().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data) return null;

  const cards = [
    { label: '今日订单', value: data.orders, color: 'bg-amber-50 text-amber-700' },
    { label: '今日营收', value: `¥${data.revenue.toFixed(2)}`, color: 'bg-green-50 text-green-700' },
    { label: '活跃订阅', value: data.active_subs, color: 'bg-blue-50 text-blue-700' },
    { label: '今日追问', value: data.oracle_calls_today, color: 'bg-purple-50 text-purple-700' },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-800 mb-3">总览 · {data.today}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`p-4 rounded-lg ${c.color}`}>
            <div className="text-xs opacity-70">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      {data.pending_orders_warning > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-red-700">
            ⚠️ 有 <strong>{data.pending_orders_warning}</strong> 个 pending 订单超过 30 分钟，需要核查
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 订单
// ============================================================

function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.orders({ limit: 100 }).then((d: any) => setOrders(d.orders)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-800 mb-3">订单 · {orders.length} 笔</h2>
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="px-3 py-2 text-left">订单 ID</th>
              <th className="px-3 py-2 text-left">用户</th>
              <th className="px-3 py-2 text-left">档位</th>
              <th className="px-3 py-2 text-right">金额</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">时间</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-3 py-2 font-mono text-xs">{o.id.slice(0, 8)}...</td>
                <td className="px-3 py-2 text-xs">{o.user_id?.slice(0, 8) || '-'}</td>
                <td className="px-3 py-2">{o.plan || o.spread_type || '-'}</td>
                <td className="px-3 py-2 text-right">¥{o.amount?.toFixed(2) || '0.00'}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-3 py-2 text-xs text-stone-500">
                  {new Date(o.created_at).toLocaleString('zh-CN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 用户
// ============================================================

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const refresh = () => {
    setLoading(true);
    adminApi.users({ search, limit: 50 }).then((d: any) => setUsers(d.users)).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, [search]);

  if (loading) return <Loading />;

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-800 mb-3">用户 · {users.length}</h2>
      <input
        type="text"
        placeholder="搜索邮箱/昵称..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 mb-3 border border-stone-300 rounded"
      />
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="px-3 py-2 text-left">邮箱</th>
              <th className="px-3 py-2 text-left">等级</th>
              <th className="px-3 py-2 text-left">邀请码</th>
              <th className="px-3 py-2 text-left">注册时间</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2"><TierBadge tier={u.tier} /></td>
                <td className="px-3 py-2 font-mono text-xs">{u.invite_code || '-'}</td>
                <td className="px-3 py-2 text-xs text-stone-500">
                  {new Date(u.created_at).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => setSelected(u)} className="text-amber-700 hover:underline">
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && <UserDetailModal user={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function UserDetailModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newTier, setNewTier] = useState('silver');
  const [extendDays, setExtendDays] = useState(30);
  const [granting, setGranting] = useState(false);

  const loadDetail = () => {
    setLoadError(null);
    setDetail(null);
    adminApi.userDetail(user.id)
      .then((d: any) => {
        if (d?.error) {
          setLoadError(d.message || d.error);
        } else {
          setDetail(d);
        }
      })
      .catch((err: any) => setLoadError(err.message || '加载失败'));
  };

  useEffect(() => {
    loadDetail();
  }, [user.id]);

  const handleTierChange = async () => {
    const expires_at = (newTier === 'silver' || newTier === 'gold')
      ? Date.now() + extendDays * 24 * 3600 * 1000
      : undefined;
    await adminApi.changeUserTier(user.id, newTier, expires_at, 'admin manual');
    alert(`✅ 已将 ${user.email} 调整为 ${newTier}`);
    onClose();
  };

  const handleGrantQuota = async () => {
    setGranting(true);
    try {
      await adminApi.grantQuota(user.id, 'oracle_asks', 10, 'admin grant');
      alert(`✅ 已赠送 10 次追问`);
      onClose();
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-bold">用户详情</h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-800">×</button>
        </div>
        <div className="p-4 space-y-3">
          {loadError ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              ❌ 加载失败：{loadError}
              <button onClick={loadDetail} className="ml-2 underline text-red-900 hover:text-red-700">重试</button>
            </div>
          ) : !detail ? (
            <Loading />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-stone-500">邮箱：</span>{detail.user.email}</div>
                <div><span className="text-stone-500">等级：</span><TierBadge tier={detail.user.tier} /></div>
                <div><span className="text-stone-500">邀请码：</span><code>{detail.user.invite_code}</code></div>
                <div><span className="text-stone-500">注册：</span>{new Date(detail.user.created_at).toLocaleString('zh-CN')}</div>
              </div>
              <div className="p-3 bg-stone-50 rounded text-sm">
                <div>追问次数：{detail.stats.oracle_calls}（成本 ¥{detail.stats.oracle_cost.toFixed(4)}）</div>
                <div>邀请人数：{detail.stats.invites_sent}</div>
              </div>

              <div className="border-t pt-3">
                <h4 className="font-medium mb-2">调整等级</h4>
                <div className="flex gap-2">
                  <select value={newTier} onChange={(e) => setNewTier(e.target.value)} className="px-2 py-1 border rounded">
                    <option value="registered">注册用户</option>
                    <option value="silver">银月</option>
                    <option value="gold">金月</option>
                    <option value="guest">访客</option>
                  </select>
                  {(newTier === 'silver' || newTier === 'gold') && (
                    <input
                      type="number"
                      value={extendDays}
                      onChange={(e) => setExtendDays(parseInt(e.target.value))}
                      className="w-20 px-2 py-1 border rounded"
                    />
                  )}
                  <button onClick={handleTierChange} className="px-3 py-1 bg-amber-700 text-white rounded">
                    应用
                  </button>
                </div>
              </div>

              <div className="border-t pt-3">
                <h4 className="font-medium mb-2">赠送配额</h4>
                <button onClick={handleGrantQuota} disabled={granting} className="px-3 py-1 bg-purple-700 text-white rounded text-sm">
                  赠送 10 次追问
                </button>
              </div>

              <div className="border-t pt-3">
                <h4 className="font-medium mb-2">最近订单</h4>
                <div className="space-y-1 text-xs">
                  {detail.orders.slice(0, 5).map((o: any) => (
                    <div key={o.id} className="flex justify-between">
                      <span>{o.plan} ¥{o.amount}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 订阅
// ============================================================

function SubscriptionsTab() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    adminApi.subscriptions().then((d: any) => setSubs(d.subscriptions)).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const handleExtend = async (id: string, days: number) => {
    if (!confirm(`续期 ${days} 天？`)) return;
    await adminApi.extendSubscription(id, days);
    alert('✅ 已续期');
    refresh();
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-800 mb-3">订阅 · {subs.length} 条</h2>
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="px-3 py-2 text-left">用户</th>
              <th className="px-3 py-2 text-left">等级</th>
              <th className="px-3 py-2 text-left">状态</th>
              <th className="px-3 py-2 text-left">到期</th>
              <th className="px-3 py-2 text-left">来源</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="border-t border-stone-100">
                <td className="px-3 py-2 font-mono text-xs">{s.user_id.slice(0, 8)}</td>
                <td className="px-3 py-2"><TierBadge tier={s.tier} /></td>
                <td className="px-3 py-2"><StatusBadge status={s.status} /></td>
                <td className="px-3 py-2 text-xs">{new Date(s.expires_at).toLocaleDateString('zh-CN')}</td>
                <td className="px-3 py-2 text-xs">{s.source || '-'}</td>
                <td className="px-3 py-2 space-x-1">
                  <button onClick={() => handleExtend(s.id, 30)} className="text-xs text-amber-700 hover:underline">+30天</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// AI 成本
// ============================================================

function AICostTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.aiCost().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data) return null;

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-800 mb-3">AI 成本</h2>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="今日" calls={data.today.calls} cost={data.today.cost} color="bg-amber-50 text-amber-700" />
        <StatCard label="本周" calls={data.week.calls} cost={data.week.cost} color="bg-blue-50 text-blue-700" />
        <StatCard label="本月" calls={data.month.calls} cost={data.month.cost} color="bg-purple-50 text-purple-700" />
      </div>

      <h3 className="font-medium text-stone-800 mb-2">每日趋势（最近 30 天）</h3>
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr><th className="px-3 py-2 text-left">日期</th><th className="px-3 py-2 text-right">调用</th><th className="px-3 py-2 text-right">成本</th></tr>
          </thead>
          <tbody>
            {data.daily.map((d: any) => (
              <tr key={d.day} className="border-t border-stone-100">
                <td className="px-3 py-2">{d.day}</td>
                <td className="px-3 py-2 text-right">{d.calls}</td>
                <td className="px-3 py-2 text-right">¥{d.cost.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="font-medium text-stone-800 mb-2">Top 10 高调用用户（本月）</h3>
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr><th className="px-3 py-2 text-left">用户</th><th className="px-3 py-2 text-right">调用</th><th className="px-3 py-2 text-right">成本</th></tr>
          </thead>
          <tbody>
            {data.top_users.map((u: any) => (
              <tr key={u.user_id} className="border-t border-stone-100">
                <td className="px-3 py-2 font-mono text-xs">{u.user_id.slice(0, 8)}...</td>
                <td className="px-3 py-2 text-right">{u.calls}</td>
                <td className="px-3 py-2 text-right">¥{u.cost.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, calls, cost, color }: any) {
  return (
    <div className={`p-4 rounded-lg ${color}`}>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{calls} 次</div>
      <div className="text-sm opacity-80">¥{cost.toFixed(4)}</div>
    </div>
  );
}

// ============================================================
// 续费率
// ============================================================

function RenewalTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.renewal().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data) return null;

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-800 mb-3">续费率</h2>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {data.windows.map((w: any) => (
          <div key={w.window_days} className="p-4 bg-white border border-stone-200 rounded-lg">
            <div className="text-xs text-stone-500">{w.window_days} 天窗口</div>
            <div className="text-3xl font-bold text-amber-700 mt-1">{w.renewal_rate}%</div>
            <div className="text-xs text-stone-500 mt-1">{w.renewed} / {w.expired} 续订</div>
          </div>
        ))}
      </div>

      <h3 className="font-medium text-stone-800 mb-2">即将过期（7 天内）</h3>
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr><th className="px-3 py-2 text-left">用户</th><th className="px-3 py-2 text-left">等级</th><th className="px-3 py-2 text-left">到期</th></tr>
          </thead>
          <tbody>
            {data.expiring_soon.map((s: any) => (
              <tr key={s.id} className="border-t border-stone-100">
                <td className="px-3 py-2">{s.email}</td>
                <td className="px-3 py-2"><TierBadge tier={s.tier} /></td>
                <td className="px-3 py-2 text-xs">{new Date(s.expires_at).toLocaleDateString('zh-CN')}</td>
              </tr>
            ))}
            {data.expiring_soon.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-4 text-center text-stone-400">无</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// 反馈
// ============================================================

function FeedbackTab() {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    adminApi.feedback().then((d: any) => setFeedback(d.feedback)).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const handleHandle = async (id: string) => {
    const note = prompt('处理备注（可选）');
    await adminApi.handleFeedback(id, note || '');
    refresh();
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-800 mb-3">用户反馈 · {feedback.length} 条</h2>
      <div className="space-y-2">
        {feedback.map((f) => (
          <div key={f.id} className="bg-white border border-stone-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TypeBadge type={f.type} />
                <span className="text-xs text-stone-500">{f.email || '匿名'}</span>
                <span className="text-xs text-stone-400">{new Date(f.created_at).toLocaleString('zh-CN')}</span>
              </div>
              <StatusBadge status={f.status} />
            </div>
            <div className="text-sm text-stone-700 whitespace-pre-wrap">{f.content}</div>
            {f.contact && <div className="text-xs text-stone-500 mt-1">📧 {f.contact}</div>}
            {f.page_url && <div className="text-xs text-stone-400 mt-1">来源: {f.page_url}</div>}
            {f.status === 'pending' && (
              <button onClick={() => handleHandle(f.id)} className="mt-2 px-3 py-1 text-sm bg-amber-700 text-white rounded">
                标记已处理
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 敏感词告警
// ============================================================

function AlertsTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    adminApi.sensitiveAlerts(false).then((d: any) => setAlerts(d.alerts)).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const handleResolve = async (id: string) => {
    await adminApi.resolveAlert(id);
    refresh();
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h2 className="text-lg font-bold text-stone-800 mb-3">敏感词告警 · {alerts.length} 条</h2>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-stone-500">{new Date(a.created_at).toLocaleString('zh-CN')}</span>
              <span className="text-xs text-red-700 font-medium">{a.category || '未分类'}</span>
            </div>
            <div className="text-sm">{a.question || a.message}</div>
            {a.resolved ? (
              <span className="text-xs text-green-600 mt-2 inline-block">✅ 已处理</span>
            ) : (
              <button onClick={() => handleResolve(a.id)} className="mt-2 px-3 py-1 text-sm bg-amber-700 text-white rounded">
                标记已处理
              </button>
            )}
          </div>
        ))}
        {alerts.length === 0 && <div className="text-center text-stone-400 py-8">🎉 无告警</div>}
      </div>
    </div>
  );
}

// ============================================================
// 公共组件
// ============================================================

function Loading() {
  return <div className="text-center text-stone-400 py-8">加载中...</div>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    refunded: 'bg-red-100 text-red-700',
    active: 'bg-green-100 text-green-700',
    expired: 'bg-stone-100 text-stone-600',
    handled: 'bg-green-100 text-green-700',
    pending_status: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded ${colors[status] || 'bg-stone-100 text-stone-600'}`}>
      {status}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    gold: 'bg-yellow-100 text-yellow-700',
    silver: 'bg-stone-200 text-stone-700',
    registered: 'bg-blue-100 text-blue-700',
    guest: 'bg-stone-100 text-stone-500',
  };
  const labels: Record<string, string> = {
    gold: '金月',
    silver: '银月',
    registered: '注册',
    guest: '访客',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded ${colors[tier] || 'bg-stone-100'}`}>
      {labels[tier] || tier}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    bug: '🐛 Bug',
    suggestion: '💡 建议',
    praise: '❤️ 表扬',
    other: '📝 其他',
  };
  return (
    <span className="px-2 py-0.5 text-xs rounded bg-stone-100 text-stone-700">
      {labels[type] || type}
    </span>
  );
}