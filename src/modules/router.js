import express from 'express';
import { registerIamModule } from './iam/index.js';

import { config } from '../infrastructure/config.js';
import * as rateLimiter from '../middleware/rate-limiter.middleware.js';
import { docsRoute } from '../docs/docs.route.js';
const router = express.Router();

// COMPOSITION ROOT: MODULE REGISTRATION POINT
registerIamModule(router, {
  authLimiter: config.env === 'production' ? rateLimiter.authLimiter : undefined,
});

// DEV Routes
/* istanbul ignore next */
if (config.env === 'development') {
  router.use('/docs', docsRoute);
}

export { router as v1Router };
