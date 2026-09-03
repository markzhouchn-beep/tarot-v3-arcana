# web/src/screens/Auth.tsx 改动说明

## 改动位置：在「登录 / 注册 切换」按钮（约第 76 行）之后，插入以下 2 个入口

**插入位置**：在 `flex justify-end mb-md` 那个按钮之后（"还没有账户？注册"那行）

```tsx
{/* 验证码登录入口 */}
<button
  onClick={() => navigate('/auth/code')}
  className="text-xs text-primary hover:text-primary-light mt-xs block mx-auto"
>
  ✦ 用验证码登录
</button>

{/* 忘记密码入口 */}
<div className="flex justify-end mb-md">
  <button
    onClick={() => navigate('/auth/forgot')}
    className="text-xs text-fg-faint hover:text-primary"
  >
    忘了密码？
  </button>
</div>
```

## 视觉效果（插入后的 Auth 页底部）

```
┌──────────────────────────────┐
│ 邮箱  [_____________]        │
│ 密码  [_____________]        │
│             还没有账户？注册 →│
│                              │
│      ✦ 用验证码登录           │
│                              │
│           忘了密码？          │
│                              │
│       [    登 录    ]        │
└──────────────────────────────┘
```

## 备注
- 邀请人提示横幅 (`{inviterInfo && ...}`) 在顶部不动
- 「已登录用户提示」 (`{loggedInUser && ...}`) 在底部不动
- "稍后再说" 链接不动
- 现有邮箱注册/登录逻辑 100% 不动
