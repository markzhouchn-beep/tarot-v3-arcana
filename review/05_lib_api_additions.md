# web/src/lib/api.ts 改动说明

## 改动：在 export const authApi 对象里追加 4 个方法

原 authApi 对象（约 75-78 行）保持不动，只追加新方法：

```ts
export const authApi = {
  // === 原有方法（保留）===
  magicLink: (email: string, purpose = 'login', invite_code?: string) =>
    request('/auth/magic-link', {
      method: 'POST', body: JSON.stringify({ email, purpose, invite_code }),
    }),  // 保留，前端不再调用（C 方案上线后 30 天删除）
  register: (data: { email: string; password: string; invite_code?: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // === v3.0.1 C 方案新增 4 个方法 ===
  sendCode: (email: string, type: 'login' | 'reset' = 'login') =>
    request('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email, type }),
    }) as Promise<{
      ok: boolean;
      message: string;
      ttl_min: number;
      dev_code?: string;   // 仅开发模式存在
    }>,

  verifyCode: (email: string, code: string) =>
    request('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }) as Promise<{
      ok: boolean;
      is_new_user: boolean;
      has_password: boolean;
      temp_token: string;
      ttl_min: number;
      message: string;
    }>,

  setPassword: (temp_token: string, password: string) =>
    request('/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ temp_token, password }),
    }) as Promise<{
      ok: boolean;
      user: any;
      session_id: string;
      message: string;
    }>,

  resetPassword: (email: string, code: string, new_password: string) =>
    request('/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ email, code, new_password }),
    }) as Promise<{
      ok: boolean;
      message: string;
    }>,
};
```

## 关键返回字段解释

| 字段 | 含义 | 用在哪里 |
|------|------|----------|
| `is_new_user` | 是否新创建用户 | AuthSetPassword 文案 |
| `has_password` | 老用户是否已有密码 | 决定跳 set-password 还是直接登录 |
| `temp_token` | 10 分钟临时凭证 | set-password 接口参数 |
| `dev_code` | 开发模式明文码 | 本地测试用，生产不会出现 |
