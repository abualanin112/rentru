import cron from 'node-cron';
import crypto from 'node:crypto';

import { als as asyncLocalStorage } from '../als.js';
import { metrics } from '../metrics.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout
const PG_ADVISORY_LOCK_ID = 880013; // Unique lock ID for invitation cleanup

/**
 * Invitation Cleanup Worker
 * Transitions all PENDING invitations that have expired to EXPIRED status.
 * Atomic via updateMany — safe under concurrency.
 */
export const runInvitationCleanup = async () => {
  const result = await prisma.invitation.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: {
        lt: new Date(),
      },
    },
    data: {
      status: 'EXPIRED',
      updatedAt: new Date(),
    },
  });

  return result;
};

const executeWithLock = async (jobId) => {
  const lockResult = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${PG_ADVISORY_LOCK_ID}) as acquired`;
  const acquired = lockResult[0]?.acquired;

  if (!acquired) {
    logger.info({ event: 'system.worker.skipped', jobId }, 'Another instance is running invitation cleanup. Skipping.');
    return;
  }

  const start = performance.now();
  metrics.workers.active += 1;

  try {
    logger.info({ event: 'system.worker.started', jobId }, 'Starting invitation cleanup job');

    const executionPromise = runInvitationCleanup();
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
      { event: 'system.worker.completed', jobId, expiredCount: result.count },
      `Invitation cleanup completed. Marked ${result.count} expired invitations as EXPIRED.`,
    );
  } catch (error) {
    metrics.workers.failed += 1;
    logger.error({ event: 'system.worker.failed', jobId, err: error }, 'Failed to execute invitation cleanup job');
  } finally {
    metrics.workers.active -= 1;
    metrics.workers.totalDurationMs += performance.now() - start;

    await prisma.$executeRaw`SELECT pg_advisory_unlock(${PG_ADVISORY_LOCK_ID})`;
  }
};

let task;

export const startInvitationCleanupJob = () => {
  task = cron.schedule(
    '15 3 * * *', // Daily at 03:15 UTC
    () => {
      if (global.isShuttingDown) return;

      const jobId = crypto.randomUUID();

      const store = {
        reqId: `cron-invitation-cleanup-${jobId}`,
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

  logger.info('Invitation cleanup cron job initialized (runs at 03:15 AM UTC daily)');
  return task;
};

export const stopInvitationCleanupJob = () => {
  if (task) {
    task.stop();
    task = null;
    logger.info('Invitation cleanup cron job stopped');
  }
};

export const _test_executeWithLock = executeWithLock;
