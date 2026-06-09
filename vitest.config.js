import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      CORS_ORIGINS: '*',
      ENABLE_BACKGROUND_WORKERS: 'false',
      REDIS_URL: '',
      JWT_SECRET: 'testsecret',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_USERNAME: 'test@gmail.com',
      SMTP_PASSWORD: 'testpassword',
      EMAIL_FROM: 'support@rentru.com',
    },
    restoreMocks: true,
    fileParallelism: false,
    pool: 'forks',
    setupFiles: ['./tests/utils/setupEnv.js'],
    globalSetup: ['./tests/utils/globalSetup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'clover', 'html'],
      exclude: ['node_modules', 'src/config', 'src/app.js', 'tests'],
    },
    server: {
      deps: {
        inline: ['@prisma/client'],
      },
    },
  },
});
