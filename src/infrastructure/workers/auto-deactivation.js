import cron from 'node-cron';
import crypto from 'node:crypto';

import { als as asyncLocalStorage } from '../als.js';
import { metrics } from '../metrics.js';
import { logger } from '../logger.js';
import { prisma, runInTransaction } from '../prisma.js';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout
const PG_ADVISORY_LOCK_ID = 880014; // Unique lock ID for auto deactivation

/**
 * Auto Deactivation Worker
 * Reaps accounts dormant for > 30 days, suspends them, and purges their sessions.
 * Each user is processed in an isolated transaction for atomicity.
 */
export const runAutoDeactivation = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const dormantUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [{ lastLoginAt: { lt: thirtyDaysAgo } }, { lastLoginAt: null, createdAt: { lt: thirtyDaysAgo } }],
    },
    select: { id: true },
  });

  if (dormantUsers.length === 0) return { deactivatedCount: 0 };

  let deactivatedCount = 0;

  for (const user of dormantUsers) {
    try {
      await runInTransaction(async (tx) => {
        // 1. Suspend User
        await tx.user.updateMany({
          where: { id: user.id },
          data: { isActive: false, updatedAt: new Date() },
        });

        // 2. Cascade Session Purge
        await tx.session.deleteMany({
          where: { userId: user.id },
        });

        // 3. Log Audit Event
        await tx.auditLog.create({
          data: {
            event: 'user.auto_deactivated',
            targetType: 'User',
            targetId: user.id,
            actorId: null,
            action: 'SUSPEND',
            ipAddress: '127.0.0.1',
            userAgent: 'system-worker',
            oldValues: { isActive: true },
            newValues: { isActive: false },
          },
        });
      });

      deactivatedCount++;
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to auto-deactivate dormant user.');
    }
  }

  return { deactivatedCount };
};

const executeWithLock = async (jobId) => {
  const lockResult = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${PG_ADVISORY_LOCK_ID}) as acquired`;
  const acquired = lockResult[0]?.acquired;

  if (!acquired) {
    logger.info({ event: 'system.worker.skipped', jobId }, 'Another instance is running auto deactivation. Skipping.');
    return;
  }

  const start = performance.now();
  metrics.workers.active += 1;

  try {
    logger.info({ event: 'system.worker.started', jobId }, 'Starting auto deactivation job');

    const executionPromise = runAutoDeactivation();
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
      { event: 'system.worker.completed', jobId, deactivatedCount: result.deactivatedCount },
      `Auto deactivation completed. Suspended ${result.deactivatedCount} dormant users.`,
    );
  } catch (error) {
    metrics.workers.failed += 1;
    logger.error({ event: 'system.worker.failed', jobId, err: error }, 'Failed to execute auto deactivation job');
  } finally {
    metrics.workers.active -= 1;
    metrics.workers.totalDurationMs += performance.now() - start;

    await prisma.$executeRaw`SELECT pg_advisory_unlock(${PG_ADVISORY_LOCK_ID})`;
  }
};

let task;

export const startAutoDeactivationJob = () => {
  task = cron.schedule(
    '30 3 * * *', // Daily at 03:30 UTC
    () => {
      if (global.isShuttingDown) return;

      const jobId = crypto.randomUUID();

      const store = {
        reqId: `cron-auto-deactivation-${jobId}`,
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

  logger.info('Auto deactivation cron job initialized (runs at 03:30 AM UTC daily)');
  return task;
};

export const stopAutoDeactivationJob = () => {
  if (task) {
    task.stop();
    logger.info('Auto deactivation cron job stopped');
  }
};
