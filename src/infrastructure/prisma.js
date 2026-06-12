import { PrismaClient } from '@prisma/client';
import { config } from './config.js';
import { metrics } from './metrics.js';
import { logger } from './logger.js';
import { alsGetters } from './als.js';

// ──────────────────────────────────────────────────────────────
// Prisma Client Dynamic Singleton Wrapper
// // TODO: INFRASTRUCTURE BOUNDARY
// // TODO: LEGACY PRISMA ACCESS
// // TODO: HIGH-RISK TRANSACTION COUPLING
// ──────────────────────────────────────────────────────────────

const omitConfig = {};

/**
 * Factory function to instantiate the Prisma Client dynamically.
 * This evaluates the database connection URL in real-time, allowing
 * Testcontainers to inject a dynamic port during integration tests.
 */
const createClientInstance = () => {
  // If Testcontainers injected a dynamic URL in process.env, use it; otherwise fall back to config
  const activeDatabaseUrl = process.env.DATABASE_URL || config.prisma.url;

  const baseClient = new PrismaClient({
    datasources: {
      db: {
        url: activeDatabaseUrl,
      },
    },
    omit: omitConfig,
    log:
      config.env === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

  // In development, bind query logging to our pino logger
  if (config.env === 'development') {
    baseClient.$on('query', (e) => {
      // SECURITY WARNING: Never log e.params as it will leak passwords and PII
      logger.debug(
        {
          event: 'database.query',
          query: e.query,
          durationMs: e.duration,
        },
        'Prisma Query Executed',
      );
    });
  }

  // Apply extension for Slow Query Telemetry & Silent Guardian
  const client = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // --- SILENT GUARDIAN: Branch & Soft-Delete Isolation ---
          if (
            [
              'findUnique',
              'findUniqueOrThrow',
              'findFirst',
              'findFirstOrThrow',
              'findMany',
              'count',
              'update',
              'updateMany',
              'delete',
              'deleteMany',
            ].includes(operation)
          ) {
            // Reroute findUnique to findFirst to support non-unique where clauses (Soft Delete / Branch Isolation)
            if (operation === 'findUnique') {
              // eslint-disable-next-line security/detect-object-injection
              return prismaClient[model].findFirst(args);
            }
            if (operation === 'findUniqueOrThrow') {
              // eslint-disable-next-line security/detect-object-injection
              return prismaClient[model].findFirstOrThrow(args);
            }

            const isSuperAdmin = alsGetters.isSuperAdmin();
            const branchId = alsGetters.getBranchId();
            const userId = alsGetters.getUserId();

            args.where = args.where || {};
            const securityFilters = [];

            // 1. Soft Delete Injection (Global for User)
            if (model === 'User') {
              securityFilters.push({ deletedAt: null });
            }

            // 2. Branch Isolation Injection (For any model with branchId)
            // Super Admin bypasses this check completely.
            if (!isSuperAdmin) {
              if (['User', 'Invitation'].includes(model)) {
                if (branchId) {
                  securityFilters.push({ branchId });
                } else if (userId) {
                  // Null Branch Escape Prevention: If a regular authenticated user has no branchId, block cross-branch access
                  // by forcing a non-existent branch ID to prevent silent bypass. Unauthenticated requests bypass this.
                  securityFilters.push({ branchId: '00000000-0000-0000-0000-000000000000' });
                }
              }
            }

            // Apply security filters forcefully if any exist
            if (securityFilters.length > 0) {
              args.where = { AND: [args.where, ...securityFilters] };
            }
          }
          // -------------------------------------------------------

          const start = performance.now();
          const result = await query(args);
          const duration = performance.now() - start;

          if (duration >= config.prisma.slowQueryThresholdMs) {
            metrics.db.slowQueries += 1;
            logger.warn(
              {
                event: 'db.query.slow',
                model,
                operation,
                durationMs: Math.round(duration),
              },
              'Slow database query detected',
            );
          }

          return result;
        },
      },
    },
  });

  return client;
};

// Internal actual client holder
let prismaClient = createClientInstance();

/**
 * Prisma Client Export
 * Standard Singleton for all environments.
 */
const prisma = prismaClient;

const runInTransaction = (callback) => prisma.$transaction(callback);

export { prisma, runInTransaction };
