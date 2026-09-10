module.exports = {
  apps: [
    {
      name: 'aichat-backend',
      script: 'dist/main.js',
      cwd: '/opt/aichat/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
