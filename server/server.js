// ============================================================
// server.js · Express 入口
// 星语塔罗 v3.0 后端 · 端口 3003
// 创建：2026-09-01
// ============================================================

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

import { config } from './lib/config.js';
import db from './db.js';

// 路由
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import ordersRouter from './routes/orders.js';
import membershipRouter from './routes/membership.js';
import oracleRouter from './routes/oracle.js';
import yesNoRouter from './routes/yes-no.js';
import readingsRouter from './routes/readings.js';
import spreadsRouter from './routes/spreads.js';
import afdianWebhookRouter from './routes/afdian-webhook.js';
import adminRouter from './routes/admin.js';
import invitesRouter from './routes/invites.js';
import communityRouter from './routes/community.js';
import feedbackRouter from './routes/feedback.js';

// 后台任务
import { startReconcileLoop } from './lib/quota.js';
import { startDailyScheduler } from './lib/scheduler.js';
import { pingAfdian } from './lib/afdian.js';

const app = express();
// 信任 1 层代理（nginx/cloudflare），让 req.ip 拿到真实 IP
app.set('trust proxy', 1);
const PORT = config.PORT;

// ===== 中间件 =====
app.use(cors({
  origin: (origin, cb) => {
    // 允许同源 + 局域网访问（手机/其他设备预览）
    const allowed = [
      config.FRONTEND_URL,
      `http://${config.LAN_HOST}:5175`,
      `http://${config.LAN_HOST}:3003`,
      'http://localhost:5175',
      'http://localhost:3003',
    ];
    if (!origin || allowed.some(u => origin.startsWith(u.replace(/\/$/, '')))) {
      cb(null, true);
    } else {
      cb(null, true);  // 局域网开发放宽，实际生产收紧
    }
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 全局限流（防滥用）
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 100,             // 每分钟 100 次
  message: { error: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// ===== 路由 =====
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/membership', membershipRouter);
app.use('/api/oracle', (req, _res, next) => {
  console.log(`[oracle-api] ${req.method} ${req.path} body=${JSON.stringify(req.body || {}).slice(0,200)}`);
  next();
}, oracleRouter);
app.use('/api/yes-no', yesNoRouter);
app.use('/api/readings', readingsRouter);
app.use('/api/spreads', spreadsRouter);
app.use('/api/afdian', afdianWebhookRouter);
app.use('/api/admin', adminRouter);
app.use('/api/invites', invitesRouter);
app.use('/api/community', communityRouter);
app.use('/api/feedback', feedbackRouter);

// ===== 根路径（健康检查 banner） =====
app.get('/', (req, res) => {
  res.json({
    name: 'ARCANA ai · 星语塔罗 v3.0',
    status: 'alive',
    model: config.MINIMAX_MODEL,
    mock_mode: config.MOCK_MODE === '1',
    time: new Date().toISOString(),
  });
});

// ===== 404 =====
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `路径不存在: ${req.method} ${req.path}` });
});

// ===== 全局错误处理 =====
app.use((err, req, res, next) => {
  console.error('[server] 未捕获错误:', err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: config.NODE_ENV === 'development' ? err.message : '服务器内部错误',
  });
});

// ===== 启动 =====
app.listen(PORT, () => {
  console.log(`[server] ARCANA v3.0 listening on http://localhost:${PORT}`);
  console.log(`[server] mock_mode: ${config.MOCK_MODE === '1' ? 'ON（不调真 AI）' : 'OFF（真 AI）'}`);
  console.log(`[server] db: ${config.DB_PATH}`);

  // 启动定时 reconcile（每 60s 扫描 pending 订单）
  if (process.env.NODE_ENV !== 'test') {
    startReconcileLoop();
    startDailyScheduler(); // Phase 2：会员过期降级 + 续费提醒（启动跑一次 + 每 24h）
  }

  // 启动时 ping 爱发电验证 token + 签名是否正确（如果配了的话）
  if (config.AFDIAN_TOKEN && config.AFDIAN_USER_ID) {
    pingAfdian().then((r) => {
      if (r.ok) {
        console.log('[afdian] ✅ ping 成功：token + 签名验证通过');
      } else {
        console.warn(`[afdian] ⚠️ ping 失败：${r.em || r.error || JSON.stringify(r)}`);
        console.warn('[afdian] reconcile 会受影响！查询订单可能返 not_found');
      }
    }).catch((err) => console.warn('[afdian] ping 异常:', err.message));
  } else {
    console.warn('[afdian] ⚠️ AFDIAN_TOKEN / AFDIAN_USER_ID 未配置，reconcile 返空');
  }
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[server] 收到 SIGINT，正在关闭...');
  db.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('\n[server] 收到 SIGTERM，正在关闭...');
  db.close();
  process.exit(0);
});
