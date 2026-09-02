// ============================================================
// screens/Community.tsx · /community — 精选追问匿名分享
// Phase 4 社区 MVP
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { communityApi } from '../lib/api';

interface FeaturedItem {
  id: string;
  session_id: string;
  question: string;
  answer: string;
  depth_layer?: number;
  featured_at: number;
}

export default function Community() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    communityApi.featured({ limit: 20 })
      .then((res: any) => {
        if (res.ok) {
          setItems(res.items || []);
          setTotal(res.total || 0);
        } else {
          setError(res.message || '加载失败');
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || '网络错误');
        setLoading(false);
      });
  }, []);

  return (
    <Layout size="md">
      <ScreenHeader back="/" title="社区" />

      <div className="panel p-lg mb-lg bg-bg-occult text-center">
        <div className="caps text-2xs text-primary mb-xs">— 星语社区 —</div>
        <p className="text-sm text-fg font-body italic">
          来自陌生人的追问与塔罗回答 · 已脱敏匿名
        </p>
        <p className="caps text-2xs text-fg-faint mt-sm">
          共 {total} 条精选
        </p>
      </div>

      {loading && (
        <div className="text-center py-3xl caps text-fg-faint animate-pulse">加载中</div>
      )}

      {error && (
        <div className="panel p-md text-center text-secondary">
          加载失败：{error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="panel p-lg text-center text-fg-faint">
          <div className="caps text-2xs mb-md">暂无精选</div>
          <p className="text-sm font-body mb-md">管理员还在筛选中，敬请期待</p>
          <Button onClick={() => navigate('/oracle')} variant="primary" size="md">
            开始我的追问
          </Button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-md">
          {items.map(item => (
            <FeaturedCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="mt-xl flex gap-md">
        <Button onClick={() => navigate('/oracle')} variant="primary" size="md" fullWidth>
          ✦ 提问 Oracle
        </Button>
        <Button onClick={() => navigate('/spreads')} variant="secondary" size="md" fullWidth>
          开始占卜
        </Button>
      </div>
    </Layout>
  );
}

function FeaturedCard({ item }: { item: FeaturedItem }) {
  const depthLabels = ['', '牌义', '关联', '行动'];
  return (
    <div className="panel p-md">
      <div className="caps text-2xs text-fg-faint mb-xs">— 匿名追问 —</div>
      <div className="text-sm text-fg font-body leading-relaxed mb-md">
        "{item.question}"
      </div>
      <div className="border-l-2 border-primary/40 pl-md">
        <div className="caps text-2xs text-primary mb-xs">
          — ARCANA · {item.depth_layer ? depthLabels[item.depth_layer] : '回答'} —
        </div>
        <div className="text-sm text-fg-secondary font-body leading-relaxed whitespace-pre-line">
          {item.answer}
        </div>
      </div>
    </div>
  );
}