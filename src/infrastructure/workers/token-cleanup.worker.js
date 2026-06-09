import cron from 'node-cron';
import crypto from 'node:crypto';

import { als as asyncLocalStorage } from '../als.js';
import { metrics } from '../metrics.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';
import { tokenService } from '../../modules/iam/index.js';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout
const PG_ADVISORY_LOCK_ID = 880011; // Unique lock ID for token cleanup

const executeWithLock = async (jobId) => {
  // Attempt to acquire distributed singleton lock via Postgres
  const lockResult = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${PG_ADVISORY_LOCK_ID}) as acquired`;
  const acquired = lockResult[0]?.acquired;

  if (!acquired) {
    logger.info({ event: 'system.worker.skipped', jobId }, 'Another instance is running this worker job. Skipping.');
    return;
  }

  const start = performance.now();
  metrics.workers.active += 1;

  try {
    logger.info({ event: 'system.worker.started', jobId }, 'Starting automated token cleanup job');

    // Timeout wrapper - does NOT cancel prisma query but prevents worker from hanging indefinitely
    const executionPromise = tokenService.deleteExpiredTokens();
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Worker timeout exceeded')), TIMEOUT_MS);
    });
    let result;
    try {
      result = await Promise.race([executionPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }

    metrics.workers.completed += 1;
    logger.info(
      { event: 'system.worker.completed', jobId, deletedCount: result.count },
      `Automated token cleanup completed. Deleted ${result.count} expired tokens.`,
    );
  } catch (error) {
    metrics.workers.failed += 1;
    logger.error({ event: 'system.worker.failed', jobId, err: error }, 'Failed to execute token cleanup job');
  } finally {
    metrics.workers.active -= 1;
    metrics.workers.totalDurationMs += performance.now() - start;

    // Release advisory lock
    await prisma.$executeRaw`SELECT pg_advisory_unlock(${PG_ADVISORY_LOCK_ID})`;
  }
};

const startTokenCleanupJob = () => {
  const task = cron.schedule(
    '0 3 * * *',
    () => {
      if (global.isShuttingDown) return;

      const jobId = crypto.randomUUID();

      // Establish isolated ALS context for worker logs
      const store = {
        reqId: `cron-${jobId}`,
        logger: logger.child({ jobId }),
      };

      const workerPromise = new Promise((resolve) => {
        asyncLocalStorage.run(store, async () => {
          try {
            await executeWithLock(jobId);
          } finally {
            resolve();
          }
        });
      });

      // Track active execution for graceful shutdown
      if (global.activeWorkers) {
        global.activeWorkers.add(workerPromise);
        workerPromise.finally(() => global.activeWorkers.delete(workerPromise));
      }
    },
    {
      timezone: 'UTC',
    },
  );

  logger.info('Token cleanup cron job initialized (runs at 03:00 AM UTC daily)');
  return task;
};

export { startTokenCleanupJob };
