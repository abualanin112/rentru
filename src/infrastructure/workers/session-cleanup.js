import cron from 'node-cron';
import crypto from 'node:crypto';

import { als as asyncLocalStorage } from '../als.js';
import { metrics } from '../metrics.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout
const PG_ADVISORY_LOCK_ID = 880012; // Unique lock ID for session cleanup

/**
 * Session Cleanup Worker
 * Deletes all sessions where expiresAt is in the past.
 * Atomic via deleteMany — safe under concurrency.
 */
export const runSessionCleanup = async () => {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result;
};

const executeWithLock = async (jobId) => {
  const lockResult = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${PG_ADVISORY_LOCK_ID}) as acquired`;
  const acquired = lockResult[0]?.acquired;

  if (!acquired) {
    logger.info({ event: 'system.worker.skipped', jobId }, 'Another instance is running session cleanup. Skipping.');
    return;
  }

  const start = performance.now();
  metrics.workers.active += 1;

  try {
    logger.info({ event: 'system.worker.started', jobId }, 'Starting session cleanup job');

    const executionPromise = runSessionCleanup();
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
      `Session cleanup completed. Deleted ${result.count} expired sessions.`,
    );
  } catch (error) {
    metrics.workers.failed += 1;
    logger.error({ event: 'system.worker.failed', jobId, err: error }, 'Failed to execute session cleanup job');
  } finally {
    metrics.workers.active -= 1;
    metrics.workers.totalDurationMs += performance.now() - start;

    await prisma.$executeRaw`SELECT pg_advisory_unlock(${PG_ADVISORY_LOCK_ID})`;
  }
};

let task;

export const startSessionCleanupJob = () => {
  task = cron.schedule(
    '0 3 * * *', // Daily at 03:00 UTC
    () => {
      if (global.isShuttingDown) return;

      const jobId = crypto.randomUUID();

      const store = {
        reqId: `cron-session-cleanup-${jobId}`,
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

      if (global.activeWorkers) {
        global.activeWorkers.add(workerPromise);
        workerPromise.finally(() => global.activeWorkers.delete(workerPromise));
      }
    },
    {
      timezone: 'UTC',
    },
  );

  logger.info('Session cleanup cron job initialized (runs at 03:00 AM UTC daily)');
  return task;
};

export const stopSessionCleanupJob = () => {
  if (task) {
    task.stop();
    task = null;
    logger.info('Session cleanup cron job stopped');
  }
};

export const _test_executeWithLock = executeWithLock;
