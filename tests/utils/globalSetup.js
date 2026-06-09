/* eslint-disable no-console */
/**
 * Vitest Global Setup — Single Global Container Architecture
 *
 * Spins up ONE PostgreSQL Testcontainer for the entire test run,
 * pushes the Prisma schema once, and exposes the dynamic DATABASE_URL
 * to all worker processes via Vitest's provide/inject API.
 *
 * Both `setup` and `teardown` are co-located here so the container
 * reference is captured via closure — no globalThis hacks needed.
 */

import { GenericContainer, Wait } from 'testcontainers';
import { execSync } from 'child_process';

/** @type {import('testcontainers').StartedTestContainer | undefined} */
let container;

/**
 * Called once before any test files are loaded.
 * @param {import('vitest/node').TestProject} project
 */
export async function setup(project) {
  // Ryuk (the resource reaper) can cause issues on Windows / CI without Docker socket access
  process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

  console.log('\n[Global Setup] Starting PostgreSQL 16-alpine Testcontainer...');

  container = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'test',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
    .withStartupTimeout(60_000)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const databaseUrl = `postgresql://test:test@${host}:${port}/test?schema=public`;

  console.log(`[Global Setup] Container ready at ${host}:${port}`);

  // Inject into current process so the execSync child inherits it
  process.env.DATABASE_URL = databaseUrl;

  // Push the Prisma schema against the global container using db push
  // during Phase 2 to ensure the new RBAC tables are created despite missing migrations.
  console.log('[Global Setup] Syncing Prisma schema to container...');
  console.log(`[Global Setup - Diagnostic] Target DATABASE_URL for Prisma CLI: ${databaseUrl.replace(/:test@/, ':***@')}`);

  const fs = await import('fs');
  const path = await import('path');
  const envPath = path.resolve(process.cwd(), '.env');
  const envBakPath = path.resolve(process.cwd(), '.env.bak');

  let envRenamed = false;
  if (fs.existsSync(envPath)) {
    fs.renameSync(envPath, envBakPath);
    envRenamed = true;
  }

  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
    });
  } finally {
    if (envRenamed) {
      fs.renameSync(envBakPath, envPath);
    }
  }

  console.log('[Global Setup] Migration deploy complete.');

  // Expose DATABASE_URL to all Vitest worker forks via the provide/inject channel
  project.provide('DATABASE_URL', databaseUrl);
}

/**
 * Called once after all test suites have finished.
 * Gracefully stops the global PostgreSQL Testcontainer.
 */
export async function teardown() {
  if (container) {
    console.log('\n[Global Teardown] Stopping PostgreSQL Testcontainer...');
    await container.stop({ timeout: 10_000 });
    console.log('[Global Teardown] Container stopped.');
  }
}
