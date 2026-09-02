// ============================================================
// lib/api.ts · API 客户端（v3.0）
// 创建：2026-09-01
// ============================================================

const BASE = '/api';

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const healthApi = {
  check: () => request('/health'),
};

export const spreadsApi = {
  list: () => request('/spreads'),
  get: (id: string) => request(`/spreads/${id}`),
};

export const ordersApi = {
  create: (data: any) => request('/orders/create', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request(`/orders/${id}`),
  list: (params: { user_id?: string; device_id?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.user_id) qs.append('user_id', params.user_id);
    if (params.device_id) qs.append('device_id', params.device_id);
    if (params.limit) qs.append('limit', String(params.limit));
    return request(`/orders${qs.toString() ? '?' + qs.toString() : ''}`);
  },
  reconcile: (id: string) => request(`/orders/${id}/reconcile`, { method: 'POST' }),
  // v3.0.1 补充：调用 AI 生成解读
  interpret: (id: string) => request(`/orders/${id}/interpret`, { method: 'POST' }),
  // ❌ v3.0 已删除 trustPaid（PD v0.8：不允前端直接标 paid）
};

export const yesNoApi = {
  quota: (deviceId: string) => request('/yes-no/quota', { headers: { 'X-Device-Id': deviceId } }),
  draw: (question: string, deviceId?: string) => request('/yes-no/draw', {
    method: 'POST',
    body: JSON.stringify({ question }),
    headers: deviceId ? { 'X-Device-Id': deviceId } : {},
  }),
};

export const authApi = {
  magicLink: (email: string, purpose = 'login', invite_code?: string) => request('/auth/magic-link', {
    method: 'POST',
    body: JSON.stringify({ email, purpose, invite_code }),
  }),
  verify: (token: string, purpose = 'login', invite_code?: string) =>
    request(`/auth/verify?token=${token}&purpose=${purpose}${invite_code ? `&invite_code=${encodeURIComponent(invite_code)}` : ''}`),
  register: (data: { email: string; password: string; invite_code?: string }) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  login: (data: { email: string; password: string }) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
};

export const membershipApi = {
  status: () => request('/membership/status'),
  subscribe: (plan: string) => request('/membership/subscribe', { method: 'POST', body: JSON.stringify({ plan }) }),
};

export const oracleApi = {
  ask: (data: { question?: string; content?: string; reading_id?: string; session_id?: string; preset_question_id?: string }) => request('/oracle/ask', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  sessions: () => request('/oracle/sessions'),
  presetQuestions: (params?: { spread_type?: string; tier?: string }) => {
    const q = new URLSearchParams();
    if (params?.spread_type) q.set('spread_type', params.spread_type);
    if (params?.tier) q.set('tier', params.tier);
    const qs = q.toString();
    return request(`/oracle/preset-questions${qs ? `?${qs}` : ''}`);
  },
  createSession: (reading_id: string) => request('/oracle/session', {
    method: 'POST',
    body: JSON.stringify({ reading_id }),
  }),
  getMessages: (session_id: string) => request(`/oracle/session/${session_id}/messages`),
  resolveMessage: (message_id: string) => request(`/oracle/message/${message_id}/resolve`, {
    method: 'POST',
  }),
};

export const readingsApi = {
  get: (id: string, accessToken?: string) => request(`/readings/${id}${accessToken ? `?access_token=${accessToken}` : ''}`),
  resolve: (id: string, isResolved: boolean) => request(`/readings/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ is_resolved: isResolved ? 1 : 0 }),
  }),
};

// ============================================================
// Phase 4：邀请系统 API
// ============================================================
export const invitesApi = {
  // 我的邀请统计 + 记录 + 奖励
  me: () => request('/invites/me'),
  // 查询邀请码对应的邀请人（脱敏）
  lookup: (code: string) => request(`/invites/lookup/${encodeURIComponent(code)}`),
  // 手动标记有效动作（一般自动）
  markEffective: () => request('/invites/effective', { method: 'POST' }),
};

// ============================================================
// Phase 4：社区 MVP 精选追问 API
// ============================================================
export const communityApi = {
  featured: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    const qs = q.toString();
    return request(`/community/featured${qs ? `?${qs}` : ''}`);
  },
};

export default {
  health: healthApi,
  spreads: spreadsApi,
  orders: ordersApi,
  yesNo: yesNoApi,
  auth: authApi,
  membership: membershipApi,
  oracle: oracleApi,
  readings: readingsApi,
  invites: invitesApi,
  community: communityApi,
};

// ============================================================
// Admin API（Phase 5 · Phase 6）
// Basic Auth：进入后台时输入用户名密码
// ============================================================

const ADMIN_AUTH_KEY = 'arcana_admin_auth';

function getAdminAuthHeader(): Record<string, string> {
  const stored = localStorage.getItem(ADMIN_AUTH_KEY);
  if (!stored) return {};
  return { 'Authorization': `Basic ${stored}` };
}

export const adminApi = {
  setAuth: (username: string, password: string) => {
    localStorage.setItem(ADMIN_AUTH_KEY, btoa(`${username}:${password}`));
  },
  clearAuth: () => localStorage.removeItem(ADMIN_AUTH_KEY),
  isAuthed: () => !!localStorage.getItem(ADMIN_AUTH_KEY),

  // Stats
  overview: () => request('/admin/stats/overview', { headers: getAdminAuthHeader() }),
  aiCost: () => request('/admin/stats/ai-cost', { headers: getAdminAuthHeader() }),
  renewal: () => request('/admin/stats/renewal', { headers: getAdminAuthHeader() }),
  feedbackStats: () => request('/admin/stats/feedback', { headers: getAdminAuthHeader() }),

  // Orders
  orders: (params?: { status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    return request(`/admin/orders${qs.toString() ? '?' + qs : ''}`, { headers: getAdminAuthHeader() });
  },
  orderDetail: (id: string) => request(`/admin/orders/${id}`, { headers: getAdminAuthHeader() }),
  refundOrder: (id: string, reason: string) => request(`/admin/orders/${id}/refund`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    headers: getAdminAuthHeader(),
  }),

  // Subscriptions
  subscriptions: (params?: { status?: string; tier?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.tier) qs.set('tier', params.tier);
    return request(`/admin/subscriptions${qs.toString() ? '?' + qs : ''}`, { headers: getAdminAuthHeader() });
  },
  extendSubscription: (id: string, days: number) => request(`/admin/subscriptions/${id}/extend`, {
    method: 'POST',
    body: JSON.stringify({ days }),
    headers: getAdminAuthHeader(),
  }),

  // Users
  users: (params?: { search?: string; tier?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.tier) qs.set('tier', params.tier);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    return request(`/admin/users${qs.toString() ? '?' + qs : ''}`, { headers: getAdminAuthHeader() });
  },
  userDetail: (id: string) => request(`/admin/users/${id}`, { headers: getAdminAuthHeader() }),
  changeUserTier: (id: string, tier: string, expires_at?: number, reason?: string) => request(`/admin/users/${id}/tier`, {
    method: 'POST',
    body: JSON.stringify({ tier, expires_at, reason }),
    headers: getAdminAuthHeader(),
  }),
  grantQuota: (id: string, quota_type: string, amount: number, reason?: string) => request(`/admin/users/${id}/grant-quota`, {
    method: 'POST',
    body: JSON.stringify({ quota_type, amount, reason }),
    headers: getAdminAuthHeader(),
  }),

  // Sensitive word alerts
  sensitiveAlerts: (resolved?: boolean) => {
    const qs = resolved !== undefined ? `?resolved=${resolved}` : '';
    return request(`/admin/alerts/sensitive${qs}`, { headers: getAdminAuthHeader() });
  },
  resolveAlert: (id: string) => request(`/admin/alerts/sensitive/${id}/resolve`, {
    method: 'POST',
    headers: getAdminAuthHeader(),
  }),

  // Feedback
  feedback: (params?: { status?: string; type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.type) qs.set('type', params.type);
    return request(`/admin/feedback${qs.toString() ? '?' + qs : ''}`, { headers: getAdminAuthHeader() });
  },
  handleFeedback: (id: string, admin_note: string) => request(`/admin/feedback/${id}/handle`, {
    method: 'POST',
    body: JSON.stringify({ admin_note }),
    headers: getAdminAuthHeader(),
  }),
};

// ============================================================
// Feedback API（Phase 6 · 用户端）
// ============================================================

export const feedbackApi = {
  submit: (data: { type: string; content: string; contact?: string; page_url?: string; device_info?: string }) =>
    request('/feedback', { method: 'POST', body: JSON.stringify(data) }),
  mine: () => request('/feedback/mine'),
};
