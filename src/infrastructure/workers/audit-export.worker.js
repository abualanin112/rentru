import cron from 'node-cron';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

import { als as asyncLocalStorage } from '../als.js';
import { metrics } from '../metrics.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';
import { uploadToR2 } from '../storage.js';
import { config } from '../config.js';

const gzipAsync = promisify(zlib.gzip);

const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes timeout
const PG_ADVISORY_LOCK_ID = 880015; // Unique lock ID for audit export
const CURSOR_ID = 'cloudflare-r2-export';
const BATCH_SIZE = 1000;

/**
 * Audit Export Worker
 * Fetches unsent audit logs and exports them to Cloudflare R2 via NDJSON.
 */
export const runAuditExport = async () => {
  if (!config.cloudflare.bucketName) {
    logger.warn('Cloudflare R2 Bucket Name is not configured. Skipping audit export.');
    return { count: 0 };
  }

  // 1. Get current cursor
  let cursor = await prisma.auditExportCursor.findUnique({
    where: { id: CURSOR_ID },
  });

  // 2. Fetch the next batch
  let logs;
  if (!cursor) {
    // Very first run: just fetch the oldest
    logs = await prisma.auditLog.findMany({
      take: BATCH_SIZE,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  } else {
    // Fetch using the tuple comparison for pagination
    logs = await prisma.auditLog.findMany({
      take: BATCH_SIZE,
      where: {
        OR: [
          { createdAt: { gt: cursor.lastExportedCreatedAt } },
          {
            createdAt: cursor.lastExportedCreatedAt,
            id: { gt: cursor.lastExportedId },
          },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  if (logs.length === 0) {
    return { count: 0 };
  }

  // 3. Serialize to NDJSON
  const ndjson = logs.map((log) => JSON.stringify(log)).join('\n') + '\n';

  // 4. Compress to GZIP
  const compressedData = await gzipAsync(Buffer.from(ndjson, 'utf-8'));

  // 5. Generate Filename & Upload
  const lastLog = logs[logs.length - 1];
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '/'); // YYYY/MM/DD
  const timestamp = Date.now();
  const batchId = crypto.randomUUID();
  const key = `audit-logs/${date}/batch-${timestamp}-${batchId}.ndjson.gz`;

  // Upload to R2 (throws if fails, which safely aborts before cursor update)
  await uploadToR2(config.cloudflare.bucketName, key, compressedData, 'application/gzip');

  // 6. Advance the cursor
  await prisma.auditExportCursor.upsert({
    where: { id: CURSOR_ID },
    update: {
      lastExportedCreatedAt: lastLog.createdAt,
      lastExportedId: lastLog.id,
    },
    create: {
      id: CURSOR_ID,
      lastExportedCreatedAt: lastLog.createdAt,
      lastExportedId: lastLog.id,
    },
  });

  return { count: logs.length };
};

const executeWithLock = async (jobId) => {
  let lockAcquired = false;

  try {
    const lockResult = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${PG_ADVISORY_LOCK_ID}) as acquired`;
    lockAcquired = lockResult[0]?.acquired;

    if (!lockAcquired) {
      logger.info({ event: 'system.worker.skipped', jobId }, 'Another instance is running audit export. Skipping.');
      return;
    }

    const start = performance.now();
    metrics.workers.active += 1;

    try {
      logger.info({ event: 'system.worker.started', jobId }, 'Starting audit export job');

      const executionPromise = runAuditExport();
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
        { event: 'system.worker.completed', jobId, exportedCount: result.count },
        `Audit export completed. Exported ${result.count} logs to R2.`,
      );
    } catch (error) {
      metrics.workers.failed += 1;
      logger.error({ event: 'system.worker.failed', jobId, err: error }, 'Failed to execute audit export job');
    } finally {
      metrics.workers.active -= 1;
      metrics.workers.totalDurationMs += performance.now() - start;
    }
  } finally {
    if (lockAcquired) {
      await prisma.$executeRaw`SELECT pg_advisory_unlock(${PG_ADVISORY_LOCK_ID})`;
    }
  }
};

let task;

export const startAuditExportJob = () => {
  task = cron.schedule(
    '*/5 * * * *', // Every 5 minutes
    () => {
      if (global.isShuttingDown) return;

      const jobId = crypto.randomUUID();

      const store = {
        reqId: `cron-audit-export-${jobId}`,
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

  logger.info('Audit export cron job initialized (runs every 5 minutes)');
  return task;
};

export const stopAuditExportJob = () => {
  if (task) {
    task.stop();
    task = null;
    logger.info('Audit export cron job stopped');
  }
};

export const _test_executeWithLock = executeWithLock;
