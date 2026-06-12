import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      CORS_ORIGINS: '*',
      ENABLE_BACKGROUND_WORKERS: 'false',
      JWT_SECRET: 'testsecret',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_USERNAME: 'test@gmail.com',
      SMTP_PASSWORD: 'testpassword',
      EMAIL_FROM: 'support@rentru.com',
      GOOGLE_CLIENT_ID: 'test-google-id',
      GOOGLE_CLIENT_SECRET: 'test-google-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost:3000/v1/auth/google/callback',
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
        'src/infrastructure/logger.js',
        'src/infrastructure/metrics.js',
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
