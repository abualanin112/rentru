# File Documentation

File:
`src/infrastructure/workers/token-cleanup.worker.js`

Domain:
Background Workers / Infrastructure

Layer:
Infrastructure / Scheduling Layer

Runtime Role:
Executes a daily cron job to delete expired JWT Refresh Tokens and Reset Password Tokens from the database, preventing indefinite database growth. Implements distributed concurrency locks.

Dependencies:

- `node-cron`
- `crypto`
- `src/infrastructure/als.js`
- `src/infrastructure/metrics.js`
- `src/infrastructure/logger.js`
- `src/infrastructure/prisma.js`
- `token.repository.js`

---

# 2. PURPOSE

If expired tokens are never deleted, the `tokens` table will grow endlessly, eventually degrading database performance.

Because this backend is designed as a distributed Modular Monolith (running across multiple Docker containers/pods), a simple `setInterval` or standard Cron job would execute simultaneously on every pod, causing deadlocks or duplicate work. This file uses advanced PostgreSQL features to ensure only a single pod ever executes the cleanup script at a time.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Schedules a job for 03:00 AM UTC.
- Acquires a Postgres distributed lock (`pg_try_advisory_lock`).
- Instantiates a localized AsyncLocalStorage (ALS) context for trace IDs.
- Tracks metrics (`workers.active`, `workers.completed`, `workers.failed`).
- Executes the `deleteExpiredTokens` batch query.
- Uses `Promise.race` to enforce a strict 5-minute timeout.
- Unlocks the Postgres lock on completion or failure.
- Registers the active promise with `global.activeWorkers` to prevent the Docker container from terminating mid-cleanup during deployments.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `prisma`

Used for:

- Executing the raw SQL required for Postgres Advisory Locks (which Prisma does not natively support via its standard API).
  Coupling Level: HIGH (Coupled to PostgreSQL specifically).

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `startTokenCleanupJob`

Called by:

- `src/index.js` (The main entrypoint boots the workers alongside the HTTP server).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: Trigger at 03:00 AM UTC

1. Cron fires on all 5 active pods simultaneously.
2. Pod 1 executes `prisma.$queryRaw(SELECT pg_try_advisory_lock(880011))`.
   - Postgres grants the lock to Pod 1. It returns `acquired: true`.
3. Pod 2, 3, 4, and 5 execute the same query milliseconds later.
   - Postgres sees the lock is held. It returns `acquired: false` immediately.
4. Pods 2, 3, 4, 5 log `"Another instance is running this worker job. Skipping."` and go back to sleep.
5. Pod 1 sets up an ALS context, generating a trace ID `cron-abcd...`.
6. Pod 1 calls `deleteExpiredTokens()`.
7. Once finished, Pod 1 executes `SELECT pg_advisory_unlock(880011)`.

---

# 7. IMPORTANT CODE EXAMPLES

## Distributed Locking

```javascript
// Attempt to acquire distributed singleton lock via Postgres
const lockResult = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${PG_ADVISORY_LOCK_ID}) as acquired`;
const acquired = lockResult[0]?.acquired;

if (!acquired) {
  logger.info({ event: 'system.worker.skipped', jobId }, 'Another instance is running this worker job. Skipping.');
  return;
}
```

**Why this matters:**
This is the most critical piece of infrastructure for background jobs in a clustered Node.js application. Instead of relying on Redis (which requires another piece of infrastructure to maintain) or a dedicated job queue like BullMQ (which adds heavy dependencies), it utilizes PostgreSQL's native session-level advisory locks. This keeps the architecture incredibly simple and robust.

## Graceful Shutdown Tracking

```javascript
// Track active execution for graceful shutdown
if (global.activeWorkers) {
  global.activeWorkers.add(workerPromise);
  workerPromise.finally(() => global.activeWorkers.delete(workerPromise));
}
```

**Why this matters:**
If Kubernetes deploys a new version of the app at 03:02 AM, it will send a `SIGTERM` to the container. If the worker is halfway through deleting a batch of tokens, terminating the process immediately could cause issues. By adding this promise to `global.activeWorkers`, `src/index.js` knows to wait for the worker to finish before closing the database connection and exiting.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/iam/repositories/token.repository.js`

Responsibility: The actual database query.
Relationship: The worker is just the scheduler; the repository does the work.

---

# 9. DATABASE INTERACTIONS

Touched Models:

- Raw SQL (`pg_try_advisory_lock`, `pg_advisory_unlock`)

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
None. System-level execution.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

Emits highly structured telemetry (`system.worker.started`, `system.worker.completed`) containing execution duration and row counts.

---

# 13. ARCHITECTURAL RISKS

### Orphaned Locks

If the Node.js process crashes (e.g., Out Of Memory `SIGKILL`) _after_ acquiring the lock but _before_ executing `pg_advisory_unlock`, the lock will remain held until the PostgreSQL connection drops. Because Prisma uses a connection pool, that specific connection might remain alive and return to the pool, holding the lock forever. A robust fix involves using transaction-level locks (`pg_try_advisory_xact_lock`) which are automatically released when the transaction ends, regardless of connection pooling.

---

# 14. EXTENSION POINTS

- **Job Queueing**: As more background jobs are added (e.g., nightly billing runs, email digest generation), this single-file cron pattern will become hard to manage. It should be refactored into a generic `WorkerManager` that accepts a schedule and a callback.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- System Health: Prevents the database from running out of disk space.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
MEDIUM (Requires Postgres).

Scalability:
HIGH (Explicitly designed for multi-node deployments).

Primary Concern:
The session-level advisory lock is vulnerable to being orphaned if the process crashes. Transaction-level locks are safer.
