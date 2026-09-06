module.exports = {
  apps: [{
    name: 'tarot-v3',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3003,
    },
    error_file: '/root/.pm2/logs/tarot-v3-error.log',
    out_file: '/root/.pm2/logs/tarot-v3-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
