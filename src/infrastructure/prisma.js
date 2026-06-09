import { PrismaClient } from '@prisma/client';
import { config } from './config.js';
import { metrics } from './metrics.js';
import { logger } from './logger.js';

// ──────────────────────────────────────────────────────────────
// Prisma Client Dynamic Singleton Wrapper
// // TODO: INFRASTRUCTURE BOUNDARY
// // TODO: LEGACY PRISMA ACCESS
// // TODO: HIGH-RISK TRANSACTION COUPLING
// ──────────────────────────────────────────────────────────────

const omitConfig = {
  user: {
    password: true, // Natively exclude password globally for all queries
  },
};

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

  // Apply extension for Slow Query Telemetry
  const client = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
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
