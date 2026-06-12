import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

import { PrismaClient } from '@prisma/client';

import { prisma } from '../../../../infrastructure/prisma.js';
import * as storage from '../../../../infrastructure/storage.js';
import { _test_executeWithLock, runAuditExport } from '../../../../infrastructure/workers/audit-export.worker.js';
import { metrics } from '../../../../infrastructure/metrics.js';

import { config } from '../../../../infrastructure/config.js';

const gunzipAsync = promisify(zlib.gunzip);

describe('Audit Domain - AUDIT-WRK-001: Event Forwarding Worker', () => {
  beforeEach(async () => {
    // Mock config
    config.cloudflare.bucketName = 'test-bucket';

    // Clear audit logs and cursor
    await prisma.auditLog.deleteMany({});
    await prisma.auditExportCursor.deleteMany({});

    // Reset metrics
    metrics.workers.active = 0;
    metrics.workers.completed = 0;
    metrics.workers.failed = 0;

    global.isShuttingDown = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully export a batch and advance the cursor', async () => {
    const uploadSpy = vi.spyOn(storage, 'uploadToR2').mockResolvedValue({});

    // 1. Create dummy audit logs
    await prisma.auditLog.createMany({
      data: [
        { event: 'test.event.1', action: 'CREATE' },
        { event: 'test.event.2', action: 'UPDATE' },
      ],
    });

    const logs = await prisma.auditLog.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

    // 2. Run the worker
    const result = await runAuditExport();
    expect(result.count).toBe(2);

    // 3. Verify upload
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    const [_bucket, key, body, contentType] = uploadSpy.mock.calls[0];

    expect(key).toMatch(/audit-logs\/\d{4}\/\d{2}\/\d{2}\/batch-\d+-[a-f0-9-]+\.ndjson\.gz/);
    expect(contentType).toBe('application/gzip');

    // Verify compression and NDJSON
    const uncompressed = await gunzipAsync(body);
    const ndjson = uncompressed.toString('utf-8');
    const lines = ndjson.trim().split('\n').map(JSON.parse);
    expect(lines).toHaveLength(2);
    const events = lines.map((l) => l.event);
    expect(events).toContain('test.event.1');
    expect(events).toContain('test.event.2');

    // 4. Verify cursor advanced
    const cursor = await prisma.auditExportCursor.findUnique({ where: { id: 'cloudflare-r2-export' } });
    expect(cursor).not.toBeNull();
    expect(cursor.lastExportedId).toBe(logs[1].id);
  });

  it('should not advance cursor if upload fails (At-Least-Once Delivery)', async () => {
    const _uploadSpy = vi.spyOn(storage, 'uploadToR2').mockRejectedValue(new Error('S3 Outage'));

    await prisma.auditLog.create({ data: { event: 'test.event.3', action: 'CREATE' } });

    await expect(runAuditExport()).rejects.toThrow('S3 Outage');

    // Verify cursor did NOT advance
    const cursor = await prisma.auditExportCursor.findUnique({ where: { id: 'cloudflare-r2-export' } });
    expect(cursor).toBeNull();
  });

  it('should prevent concurrent execution via advisory lock using real Session Scope', async () => {
    const uploadSpy = vi.spyOn(storage, 'uploadToR2').mockResolvedValue({});

    await prisma.auditLog.create({ data: { event: 'test.event.4', action: 'CREATE' } });

    // Create a truly separate PrismaClient to simulate a completely different worker session/process
    const secondaryPrisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
    await secondaryPrisma.$connect();

    try {
      // 1. Secondary process ACQUIRES the advisory lock first
      const lockResult = await secondaryPrisma.$queryRaw`SELECT pg_try_advisory_lock(880015) as acquired`;
      expect(lockResult[0].acquired).toBe(true);

      // 2. The main worker attempts to run but should SKIP because the lock is held
      const jobId = crypto.randomUUID();
      await _test_executeWithLock(jobId);

      // Verify the main worker did NOT upload anything because it was skipped
      expect(uploadSpy).toHaveBeenCalledTimes(0);
      expect(metrics.workers.completed).toBe(0); // Should be 0 since it skipped early
    } finally {
      // 3. Secondary process RELEASES the advisory lock
      await secondaryPrisma.$executeRaw`SELECT pg_advisory_unlock(880015)`;
      await secondaryPrisma.$disconnect();
    }
  });
});
