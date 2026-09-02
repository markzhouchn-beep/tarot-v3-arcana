// ============================================================
// screens/Loading.tsx · /loading/:order_id — 支付确认等待页
// v3.0.1：和 Spread 整合，这里做"loading 详情"页（手动访问时）
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { ordersApi } from '../lib/api';

export default function Loading() {
  const navigate = useNavigate();
  const params = useParams();
  const orderId = params.order_id || params.orderId;
  const [pollCount, setPollCount] = useState(0);
  const [status, setStatus] = useState<string>('pending');
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<any>(null);

  useEffect(() => {
    if (!orderId) return;
    let count = 0;
    pollRef.current = setInterval(async () => {
      count++;
      setPollCount(count);
      try {
        const res = await ordersApi.reconcile(orderId);
        setStatus(res.status);
        if (res.status === 'paid' || res.already || res.status === 'interpreted') {
          clearInterval(pollRef.current);
          navigate(`/reading/${orderId}`);
        } else if (count >= 72) {
          clearInterval(pollRef.current);
          setError('轮询超时');
        }
      } catch {}
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orderId, navigate]);

  return (
    <Layout size="sm">
      <div className="text-center py-3xl">
        <div className="relative w-20 h-20 mx-auto mb-lg">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
          <div className="absolute inset-4 rounded-full bg-primary/60" />
        </div>
        <h3 className="font-display text-2xl text-gradient-gold mb-sm">确认支付中</h3>
        <p className="text-xs text-fg-secondary font-body italic mb-lg">
          等待爱发电确认 · 后台每 5 秒查一次
        </p>
        <div className="caps text-2xs text-fg-faint">
          状态: {status} · 第 {pollCount} 次
        </div>
        {error && (
          <div className="mt-md">
            <div className="text-secondary text-sm">{error}</div>
            <Button onClick={() => navigate('/spreads')} variant="secondary" size="md" className="mt-md">
              返回牌阵
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}