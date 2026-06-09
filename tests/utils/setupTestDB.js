/**
 * Per-File Test Lifecycle Hooks — Refactored for Global Container Architecture
 *
 * All container management and schema migration logic has been moved to
 * `globalSetup.js`. This module is now purely responsible for:
 *   1. Injecting the global DATABASE_URL into this worker's process.env
 *   2. Reconnecting the Prisma proxy to the shared container
 *   3. Truncating tables between tests for data isolation
 */
import { prisma } from '../../src/infrastructure/prisma.js';

const setupTestDB = () => {
  beforeEach(async () => {
    // Truncate all tables using actual PostgreSQL table names (@@map values)
    // to ensure complete data isolation between individual tests
    await prisma.$executeRaw`TRUNCATE TABLE "notes", "tokens", "users", "audit_logs", "user_roles", "role_permissions", "rbac_roles", "permissions" CASCADE;`;
  });

  afterAll(async () => {
    // Gracefully return connections to the pool; the container stays alive
    // until globalTeardown runs after ALL test files complete
    await prisma.$disconnect();
  });
};

export { setupTestDB };
