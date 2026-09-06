// ============================================================
// App.tsx · v3.0 路由（代码分割版）
// 创建：2026-09-01 · 2026-09-06：React.lazy 代码分割
// ============================================================

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// 核心页面：首屏直出（不分割）
import Hero from './screens/Hero';
import Spreads from './screens/Spreads';
import YesNo from './screens/YesNo';
import Ask from './screens/Ask';
import Draw from './screens/Draw';
import Spread from './screens/Spread';
import Reading from './screens/Reading';
import Loading from './screens/Loading';

// 次要页面：懒加载（按需拉取）
const Auth = lazy(() => import('./screens/Auth'));
const AuthCallback = lazy(() => import('./screens/AuthCallback'));
const AuthSetPassword = lazy(() => import('./screens/AuthSetPassword'));
const AuthForgot = lazy(() => import('./screens/AuthForgot'));
const Membership = lazy(() => import('./screens/Membership'));
const Dashboard = lazy(() => import('./screens/Dashboard'));
const Checkout = lazy(() => import('./screens/Checkout'));
const Oracle = lazy(() => import('./screens/Oracle'));
const OracleChat = lazy(() => import('./screens/OracleChat'));
const Community = lazy(() => import('./screens/Community'));
const Cards = lazy(() => import('./screens/Cards'));
const CardDetail = lazy(() => import('./screens/CardDetail'));
const Admin = lazy(() => import('./screens/Admin'));

// 通用加载态（体积小，首屏可见）
function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-fg-faint caps text-sm animate-pulse">加载中…</div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        {/* 核心页面：首屏直出 */}
        <Route path="/" element={<Hero />} />
        <Route path="/spreads" element={<Spreads />} />
        <Route path="/yes-no" element={<YesNo />} />
        <Route path="/ask/:spread" element={<Ask />} />
        <Route path="/draw/:order_id" element={<Draw />} />
        <Route path="/draw/:orderId" element={<Draw />} />
        <Route path="/spread/:id" element={<Spread />} />
        <Route path="/reading/:id" element={<Reading />} />
        <Route path="/loading/:order_id" element={<Loading />} />
        <Route path="/loading/:orderId" element={<Loading />} />

        {/* 懒加载页面 */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/set-password" element={<AuthSetPassword />} />
        <Route path="/auth/forgot" element={<AuthForgot />} />
        <Route path="/membership" element={<Membership />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/checkout/:type" element={<Checkout />} />
        <Route path="/oracle" element={<Oracle />} />
        <Route path="/oracle/:readingId" element={<OracleChat />} />
        <Route path="/community" element={<Community />} />
        <Route path="/cards" element={<Cards />} />
        <Route path="/cards/:id" element={<CardDetail />} />
        <Route path="/admin" element={<Admin />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
