// PM2 配置 · 阿里云部署用（本地开发用 node server.js）
// 部署命令：pm2 start ecosystem.config.js
// ⚠️ 本地不部署，仅供 Phase 5+ 上线使用

export default {
  apps: [{
    name: 'tarot-v3',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3003,
    },
    error_file: '/var/log/tarot-v3/error.log',
    out_file: '/var/log/tarot-v3/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
