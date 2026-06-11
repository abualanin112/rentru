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
      exclude: [
        'node_modules',
        'src/config',
        'src/app.js',
        'src/index.js',
        'tests',
        'src/docs/**',
        'src/infrastructure/workers/**',
        'src/infrastructure/logger.js',
        'src/infrastructure/metrics.js',
        'src/infrastructure/als.js',
        'src/infrastructure/prisma.js',
        'src/infrastructure/passport.js',
        'src/infrastructure/email/index.js',
        'src/modules/audit/index.js',
        'src/modules/iam/index.js',
      ],
    },
    server: {
      deps: {
        inline: ['@prisma/client'],
      },
    },
  },
});
