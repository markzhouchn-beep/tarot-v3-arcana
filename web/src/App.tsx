// ============================================================
// App.tsx · v3.0 路由（Phase 1：先做 4 个核心页面骨架）
// 创建：2026-09-01
// ============================================================

import { Routes, Route, Navigate } from 'react-router-dom';
import Hero from './screens/Hero';
import Spreads from './screens/Spreads';
import YesNo from './screens/YesNo';
import Auth from './screens/Auth';
import AuthCallback from './screens/AuthCallback';
import AuthCode from './screens/AuthCode';
import AuthSetPassword from './screens/AuthSetPassword';
import AuthForgot from './screens/AuthForgot';
import Ask from './screens/Ask';
import Draw from './screens/Draw';
import Spread from './screens/Spread';
import Reading from './screens/Reading';
import Loading from './screens/Loading';
import Membership from './screens/Membership';
import Dashboard from './screens/Dashboard';
import Checkout from './screens/Checkout';
import Oracle from './screens/Oracle';
import OracleChat from './screens/OracleChat';
import Community from './screens/Community';
import Admin from './screens/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Hero />} />
      <Route path="/spreads" element={<Spreads />} />
      <Route path="/yes-no" element={<YesNo />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      {/* v3.0.1 C 方案 */}
      <Route path="/auth/code" element={<AuthCode />} />
      <Route path="/auth/set-password" element={<AuthSetPassword />} />
      <Route path="/auth/forgot" element={<AuthForgot />} />

      <Route path="/ask/:spread" element={<Ask />} />
      <Route path="/draw/:order_id" element={<Draw />} />
      <Route path="/draw/:orderId" element={<Draw />} />
      <Route path="/spread/:id" element={<Spread />} />
      <Route path="/reading/:id" element={<Reading />} />

      {/* Phase 1.6 已交付 */}
      <Route path="/loading/:order_id" element={<Loading />} />
      <Route path="/loading/:orderId" element={<Loading />} />
      <Route path="/membership" element={<Membership />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/checkout/:type" element={<Checkout />} />
      <Route path="/oracle" element={<Oracle />} />
      <Route path="/oracle/:readingId" element={<OracleChat />} />
      <Route path="/community" element={<Community />} />
      <Route path="/admin" element={<Admin />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-md text-center">
      <div className="caps text-fg-faint mb-md">— Phase 1 后续 —</div>
      <h2 className="text-3xl font-display text-gradient-gold mb-2xl">{name}页 即将上线</h2>
      <a href="/" className="btn-secondary">
        返回首页
      </a>
    </div>
  );
}
