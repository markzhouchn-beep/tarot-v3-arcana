// ============================================================
// routes/spreads.js · 牌阵元数据（4 主题 + 张数 + 权限）
// 创建：2026-09-01
// ============================================================

import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

/**
 * 牌阵元数据（Phase 1 由塔罗专家补全位置定义）
 */
const SPREADS = {
  // 感情主题
  'love-single': { name: '每日感情指引', theme: 'love', cards: 1, tier_required: 'registered', price: 1.9, original_price: 5, free_first: true },
  'love-3': { name: '过去 · 现在 · 未来', theme: 'love', cards: 3, tier_required: 'registered', price: 3.9, original_price: 10 },
  'love-cross-5': { name: '恋人十字', theme: 'love', cards: 5, tier_required: 'silver', positions: ['你眼中的关系', '对方眼中的关系', '潜在发展', '你内心的渴望', '塔罗的建议'] },
  'love-crush-5': { name: '暗恋透视', theme: 'love', cards: 5, tier_required: 'silver', positions: ['你的能量状态', '对方的能量状态', '连接质量', '潜在发展', '最佳行动策略'] },
  'love-chakra-7': { name: '七脉轮感情阵', theme: 'love', cards: 7, tier_required: 'gold', positions: ['海底轮', '脐轮', '太阳神经丛', '心轮', '喉轮', '眉心轮', '顶轮'] },

  // 事业主题
  'career-single': { name: '每日事业指引', theme: 'career', cards: 1, tier_required: 'registered', price: 1.9, original_price: 5 },
  'career-3': { name: '抉择十字', theme: 'career', cards: 3, tier_required: 'registered', price: 3.9 },
  'career-cross-5': { name: '职业十字', theme: 'career', cards: 5, tier_required: 'silver' },

  // 财运主题
  'money-single': { name: '财富流向', theme: 'money', cards: 1, tier_required: 'registered', price: 1.9 },
  'money-3': { name: '财富三张', theme: 'money', cards: 3, tier_required: 'registered', price: 3.9 },

  // 自我成长
  'self-single': { name: '内在映照', theme: 'self', cards: 1, tier_required: 'registered', price: 1.9 },
  'self-3': { name: '内在对话', theme: 'self', cards: 3, tier_required: 'registered', price: 3.9 },

  // 通用高级
  'celtic-10': { name: '凯尔特十字', theme: 'self', cards: 10, tier_required: 'gold', positions: ['现状', '挑战', '根基', '近期过去', '理想结果', '近期未来', '自我认知', '环境影响', '希望与恐惧', '最终结果'] },
};

const TIER_RANK = { guest: 0, registered: 1, silver: 2, gold: 3 };

/**
 * GET /api/spreads
 * 列出所有牌阵（含权限闸门）
 */
router.get('/', optionalAuth, (req, res) => {
  try {
    const userTier = req.user?.tier || 'guest';
    const userRank = TIER_RANK[userTier];

    const spreads = Object.entries(SPREADS).map(([id, info]) => {
      const requiredRank = TIER_RANK[info.tier_required] || 0;
      const accessible = userRank >= requiredRank;
      // v3.0.1 修复：访客可以进入 registered tier 牌阵（Ask 页会被 requireAuth 拦截）
      // 只有 silver/gold 高级牌阵需要预览锁
      const isHighTier = info.tier_required === 'silver' || info.tier_required === 'gold';
      const previewable = true;
      // 只有 high tier 且访客没权限时才真正锁住
      const locked = !accessible && isHighTier;

      return {
        id,
        ...info,
        accessible,
        previewable,
        locked,
      };
    });

    res.json({ spreads });
  } catch (err) {
    console.error('[spreads] error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

/**
 * GET /api/spreads/:id
 * 单个牌阵详情
 */
router.get('/:id', optionalAuth, (req, res) => {
  const info = SPREADS[req.params.id];
  if (!info) {
    return res.status(404).json({ error: 'SPREAD_NOT_FOUND' });
  }
  res.json({ id: req.params.id, ...info });
});

export default router;
