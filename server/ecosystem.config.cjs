// PM2 配置 · CommonJS 格式（PM2 不支持 ESM ecosystem 文件）
module.exports = {
  apps: [{
    name: 'tarot-v3',
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
    error_file: '/var/log/tarot-v3/error.log',
    out_file: '/var/log/tarot-v3/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
