module.exports = {
  apps: [
    {
      name: 'homestay-api',
      cwd: '/var/www/homestay/backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      autorestart: true,
      max_memory_restart: '512M',
      time: true,
    },
  ],
};
