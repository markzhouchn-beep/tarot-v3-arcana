// PM2 配置 · 双进程（prod + test）
// 创建：2026-09-21 · v3.1
//
// 用法（在服务器上）：
//   cd /var/www/tarot-app-v3/server && pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      // 正式站 · 反代端口 3003
      name: 'tarot-v3-prod',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      cwd: '/var/www/tarot-app-v3/server',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        DB_PATH: '/var/www/tarot-app-v3/server/data/tarot_v3.db',
      },
      error_file: '/var/log/tarot-v3-prod/error.log',
      out_file: '/var/log/tarot-v3-prod/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      // 测试站 · 反代端口 3004
      name: 'tarot-v3-test',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      cwd: '/var/www/tarot-app-v3-test/server',
      env: {
        NODE_ENV: 'development', // 测试站跑开发模式，CORS 自动加 localhost
        PORT: 3004,
        DB_PATH: '/var/www/tarot-app-v3-test/server/data/tarot_v3.db',
      },
      error_file: '/var/log/tarot-v3-test/error.log',
      out_file: '/var/log/tarot-v3-test/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};