# web/src/App.tsx 改动说明

## 改动 1：文件顶部追加 3 个 import

原 import 区块（约 7-23 行）末尾追加：

```tsx
import AuthCode from './screens/AuthCode';
import AuthSetPassword from './screens/AuthSetPassword';
import AuthForgot from './screens/AuthForgot';
```

## 改动 2：路由表里 `/auth` 路由后追加 3 条

原路由：
```tsx
<Route path="/auth" element={<Auth />} />
<Route path="/auth/callback" element={<AuthCallback />} />
```

追加：
```tsx
<Route path="/auth/code" element={<AuthCode />} />
<Route path="/auth/set-password" element={<AuthSetPassword />} />
<Route path="/auth/forgot" element={<AuthForgot />} />
```

## 完整新路由表（auth 部分）

```tsx
<Route path="/auth" element={<Auth />} />
<Route path="/auth/callback" element={<AuthCallback />} />
<Route path="/auth/code" element={<AuthCode />} />
<Route path="/auth/set-password" element={<AuthSetPassword />} />
<Route path="/auth/forgot" element={<AuthForgot />} />
```

## 备注
- 其他路由全部不动
- `/auth/callback` 保留（兼容旧的 magic link 回调，C 方案完全取代后可删）
- 没有用 `<Navigate>` 重定向——所有 auth 子页面都是独立入口
