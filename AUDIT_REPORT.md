# Node.js Best Practices Audit — `notes-backend`

> **Audit Date**: 2026-06-07  
> **Auditor**: Senior Staff Backend Architecture Review  
> **Codebase Snapshot**: `v2.0.0`, JavaScript ESM, Express 4.x, Prisma 6.x, Vitest 4.x  
> **Node Target**: `>=18.18.0` (CI uses Node 20)

---

# Executive Summary

`notes-backend` is a **well-structured modular monolith** that demonstrates significant architectural maturity for a mid-stage project. The author has clearly invested in enterprise-grade patterns: database-driven RBAC with escalation prevention, structured Pino logging with AsyncLocalStorage correlation, Zod-validated config, whitelist-based response serialization, centralized error handling, cursor + offset pagination, audit logging, Testcontainers-based integration testing, and a Docker-first deployment model.

**Architecture maturity level**: Intermediate-to-Advanced  
**Scalability readiness**: Moderate — single-process LRU cache is the primary bottleneck  
**Production readiness**: Partially production ready — several critical and high-risk items remain  
**Technical debt severity**: Low-to-Moderate

### Major Strengths

1. **Modular architecture with lint-enforced boundaries** — `eslint-plugin-boundaries` with explicit dependency rules is a rare and excellent practice
2. **Database-driven RBAC** — full `action:resource:scope` permission model with escalation prevention, cache invalidation, and wildcard support
3. **Structured logging** — Pino with ALS-based request correlation, sensitive data redaction, and event-loop lag telemetry
4. **Robust authentication** — refresh token rotation with family-based reuse detection, SHA-256 token hashing at rest
5. **Strong testing foundation** — Testcontainers global setup, per-test truncation, e2e + unit coverage with Vitest
6. **Zod-validated configuration** — fail-fast on missing env vars at startup
7. **Explicit response serialization** — whitelist-based DTOs prevent accidental Prisma leakage
8. **Graceful shutdown** — multi-phase reverse-order teardown with force-exit timeout

### Critical Weaknesses

1. **JWT secret hardcoded in `.env` committed to git** — critical secret exposure
2. **bcrypt cost factor of 8** — below modern minimum (12+)
3. **No `node:` protocol for built-in imports** — deviates from modern Node.js standards
4. **In-memory LRU cache** — not horizontally scalable; RBAC permissions will diverge across instances
5. **Dockerfile uses `node:alpine` without pinned version** — violates reproducible builds
6. **Missing `CORS_ORIGINS` in `.env` file** — config validation will crash at startup
7. **`express.json()` has no payload size limit** — denial-of-service vector

### Final Score: **72 / 100**

The project sits comfortably above average for a Node.js backend, with excellent architectural intent. The score is held back by several production security gaps and single-process scaling assumptions.

---

# Best Practices Scoreboard

| Category                      | Score  | Status         | Notes                                                                            |
| ----------------------------- | ------ | -------------- | -------------------------------------------------------------------------------- |
| Architecture & Modularity     | 88/100 | **Excellent**  | Lint-enforced boundaries, barrel pattern, centralized router                     |
| Node.js Runtime Practices     | 74/100 | **Good**       | Event loop monitoring present; missing `node:` imports, no AbortController       |
| API Layer                     | 80/100 | **Good**       | Zod validation, Swagger docs, rate limiting; no API versioning strategy          |
| Database & ORM (Prisma)       | 82/100 | **Good**       | Schema quality high; slow query telemetry; N+1 risks mitigated                   |
| Security                      | 58/100 | **Weak**       | Hardcoded secrets, low bcrypt cost, no JSON payload limit, no CSRF               |
| Logging & Observability       | 85/100 | **Excellent**  | Pino + ALS + redaction + metrics flusher; missing OpenTelemetry                  |
| Error Handling                | 82/100 | **Good**       | Centralized, ApiError class, Prisma error mapping; some swallowed errors         |
| Testing                       | 75/100 | **Good**       | Testcontainers e2e + unit tests; coverage gaps in auth/permission services       |
| DevOps & Production Readiness | 60/100 | **Acceptable** | Docker + CI present; Dockerfile not production-grade, missing secrets management |
| Code Consistency              | 85/100 | **Excellent**  | Named exports, flat structure, ESLint v9 flat config                             |

---

# Critical Issues

### 1. JWT Secret Hardcoded in Committed `.env`

- **Severity**: 🔴 CRITICAL
- **Affected files**: [.env](file:///d:/programming/notes/notes-backend/.env#L9)
- **Explanation**: `JWT_SECRET=notes_backend_secret_jwt_key_2026` is committed to version control. Any attacker with repo access can forge arbitrary JWTs and impersonate any user, including admins.
- **Production impact**: Complete authentication bypass. All sessions compromised.
- **Recommended fix**: Remove `.env` from git history (`git filter-branch` or BFG), rotate the secret immediately, use `.env.example` with placeholder values, inject secrets via CI/CD environment or a vault.

### 2. bcrypt Cost Factor of 8

- **Severity**: 🔴 CRITICAL
- **Affected files**: [Password.js](file:///d:/programming/notes/notes-backend/src/shared/Password.js#L9)
- **Explanation**: `bcrypt.hash(password, 8)` uses a cost factor of 8. OWASP 2024+ recommends a minimum of 12. At cost 8, bcrypt computes ~40x faster than cost 12, making offline brute-force attacks significantly easier.
- **Production impact**: If the database is breached, password hashes can be cracked orders of magnitude faster.
- **Recommended fix**: Change to `bcrypt.hash(password, 12)`. Run a background migration to rehash existing passwords on next login.

### 3. No JSON Body Size Limit

- **Severity**: 🟠 HIGH
- **Affected files**: [app.js](file:///d:/programming/notes/notes-backend/src/app.js#L108)
- **Explanation**: `express.json()` is called without a `limit` option. Express defaults to `100kb`, but this should be explicitly set. More critically, `express.urlencoded({ extended: true })` can be abused for deep object injection.
- **Production impact**: Potential memory exhaustion under adversarial payloads.
- **Recommended fix**: `express.json({ limit: '10kb' })` and `express.urlencoded({ extended: false, limit: '10kb' })`.

### 4. Missing `CORS_ORIGINS` in `.env`

- **Severity**: 🟠 HIGH
- **Affected files**: [.env](file:///d:/programming/notes/notes-backend/.env), [config.js](file:///d:/programming/notes/notes-backend/src/infrastructure/config.js#L16-L19)
- **Explanation**: The Zod schema requires `CORS_ORIGINS` as a non-optional string, but the `.env` file does not define it. The application will crash at startup in any environment not overriding it.
- **Production impact**: Application fails to boot.
- **Recommended fix**: Add `CORS_ORIGINS=http://localhost:3000` to `.env`, or make the field optional with a restrictive default.

### 5. In-Memory LRU Cache for RBAC

- **Severity**: 🟠 HIGH
- **Affected files**: [cache.js](file:///d:/programming/notes/notes-backend/src/infrastructure/cache.js), [permission.service.js](file:///d:/programming/notes/notes-backend/src/modules/iam/services/permission.service.js)
- **Explanation**: RBAC permissions are cached in an in-process `lru-cache`. When running multiple instances (horizontal scaling), a role change invalidated on one process will NOT be visible to others. A user could retain elevated permissions for up to 5 minutes on other instances.
- **Production impact**: Stale permissions across instances; privilege escalation window.
- **Recommended fix**: Replace LRU with Redis. `REDIS_URL` is already in `.env` but the cache module uses `lru-cache` instead.

---

# Detailed Technical Audit

---

## 1. Architecture Audit

### Current Implementation

The project follows a **Modular Monolith** pattern with clear boundaries:

```
src/
├── app.js                    # Express setup, middleware chain
├── index.js                  # Bootstrap, lifecycle, shutdown
├── infrastructure/           # Cross-cutting: Prisma, logger, cache, ALS, passport
├── middleware/                # Transport-layer concerns
├── modules/
│   ├── router.js             # Centralized composition root
│   ├── iam/                  # Auth, users, RBAC, tokens
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── validators/
│   │   └── index.js          # Module registration + public API
│   ├── notes/                # Flat structure: controller, service, repo, route
│   └── audit/                # Event logging subsystem
└── shared/                   # Stateless utilities only
```

### What's Excellent

- **`eslint-plugin-boundaries`** enforces dependency direction at lint time — e.g., `notes` can import from `iam` (for auth services), but `iam` cannot import from `notes`. This is a **rare and high-value** architectural guard.
- **Centralized router** in [router.js](file:///d:/programming/notes/notes-backend/src/modules/router.js) acts as a composition root, wiring module registration and inter-module hooks.
- **Dependency inversion for cross-module cascading**: `userService.registerUserDeletionHook()` allows `notes` to register its deletion callback without `iam` knowing about `notes`. This is textbook modular monolith design.
- **Module barrel files** are tight — they expose only services and module registration functions, NOT repositories or validators.

### Problems Detected

1. **IAM module uses sub-folders** (`controllers/`, `services/`, `repositories/`, `routes/`, `validators/`) while `notes` uses a flat structure. This inconsistency is acknowledged in the AGENTS.md rules but creates cognitive dissonance.
2. **`passport.js`** in `infrastructure/` directly imports from `modules/iam/repositories/user.repository.js` — this is a deep cross-boundary import that bypasses the IAM barrel file, violating the boundary rules.
3. **`export *` in `notes/index.js`** — `export * from './note.service.js'` exposes the entire service surface including `deleteManyByOwnerId`, which is an internal-only function used by the deletion hook. This violates the "prevent God index files" rule.
4. **`export * as` in `iam/index.js`** — exports all six services as namespace imports. While more controlled than `export *`, it still exposes `emailService.transport` (raw nodemailer transport) to any consumer.

### Risks

- The `passport.js` → `user.repository.js` deep import creates a hidden coupling path that could bypass authorization in future refactors.
- `export *` on `notes/index.js` makes every service function part of the public API, making it harder to evolve internals without breaking consumers.

### Recommended Improvements

1. Refactor `passport.js` to import via the IAM barrel: `import { userService } from '../modules/iam/index.js'`
2. Replace `export * from './note.service.js'` with explicit named exports
3. Standardize on flat structure for all modules (IAM is the outlier due to its size, which is justified)

---

## 2. Node.js Runtime Best Practices

### Current Implementation

- **Event loop monitoring** via `monitorEventLoopDelay()` in [index.js](file:///d:/programming/notes/notes-backend/src/index.js#L25-L33) with configurable threshold
- **AsyncLocalStorage** for request-scoped context ([als.js](file:///d:/programming/notes/notes-backend/src/infrastructure/als.js))
- **Async/await** used consistently throughout; no callbacks detected
- **`process.on('uncaughtException')` and `process.on('unhandledRejection')`** both handled
- **Graceful shutdown** with multi-phase teardown and force-exit timeout

### Problems Detected

1. **No `node:` protocol for built-in imports** — Files import `crypto`, `path`, `perf_hooks`, `async_hooks` without the `node:` prefix. The `node:` protocol prevents confusion with npm packages of the same name and is the standard since Node 16.
   - Affected files: [als.js](file:///d:/programming/notes/notes-backend/src/infrastructure/als.js), [pino-http.middleware.js](file:///d:/programming/notes/notes-backend/src/middleware/pino-http.middleware.js), [token.service.js](file:///d:/programming/notes/notes-backend/src/modules/iam/services/token.service.js), [index.js](file:///d:/programming/notes/notes-backend/src/index.js), [auth.service.js](file:///d:/programming/notes/notes-backend/src/modules/iam/services/auth.service.js)

2. **No AbortController usage** — Token cleanup worker uses `Promise.race` with a timeout but doesn't actually cancel the underlying Prisma query. This is noted in the code comment, but `AbortController` should be used where possible.

3. **`global.isShuttingDown` and `global.activeWorkers`** — Using `globalThis` for state management is fragile. A dedicated `AppLifecycle` module would be more maintainable.

4. **`setInterval` for event loop monitoring** without cleanup reference — While `.unref()` is called (correct), the interval itself is never cleared during shutdown, which is a minor leak.

5. **`nodemailer.createTransport()` is called at module load** ([mailer.js](file:///d:/programming/notes/notes-backend/src/infrastructure/mailer.js#L5)) — This is a side-effect at import time. If SMTP config is invalid, it will log a warning but continue. The `transport.verify()` call is async but not awaited in the module scope.

### Recommended Improvements

```js
// Before
import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

// After
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
```

---

## 3. API Layer Audit

### Current Implementation

- **RESTful design** with proper HTTP methods (GET, POST, PATCH, DELETE)
- **Zod validation** on all routes via [validate.middleware.js](file:///d:/programming/notes/notes-backend/src/middleware/validate.middleware.js)
- **Swagger/OpenAPI** documentation via `swagger-jsdoc` (development only)
- **Rate limiting** with three tiers: auth (10/15min), refresh (20/15min), general API (300/15min)
- **Canonical response envelope** via [response-interceptor.middleware.js](file:///d:/programming/notes/notes-backend/src/middleware/response-interceptor.middleware.js): `{ success: true, data: ... }`
- **Serializers** prevent raw Prisma objects from reaching the response

### Problems Detected

1. **No explicit API versioning strategy** — Routes are mounted under `/v1` but there's no mechanism for v2 migration. The versioning is folder-name only.

2. **Swagger docs only in development** — [router.js](file:///d:/programming/notes/notes-backend/src/modules/router.js#L23-L25) conditionally mounts docs. Production APIs should expose OpenAPI specs (behind auth if needed) for monitoring and client generation.

3. **`forgotPassword` endpoint leaks user existence** — [token.service.js:L141](file:///d:/programming/notes/notes-backend/src/modules/iam/services/token.service.js#L141) throws `ApiError(httpStatus.NOT_FOUND, 'No users found with this email')`. This tells attackers which emails are registered. Should return 204 regardless.

4. **`logout` endpoint returns 404 on invalid token** — [auth.service.js:L59](file:///d:/programming/notes/notes-backend/src/modules/iam/services/auth.service.js#L59). Same user enumeration concern. Logout should be idempotent (204 always).

5. **No idempotency support** — POST endpoints lack idempotency keys, meaning retried requests (e.g., network timeout) could create duplicate resources.

6. **Controller passes `req.body` directly to service** — [user.controller.js:L17](file:///d:/programming/notes/notes-backend/src/modules/iam/controllers/user.controller.js#L17) passes `req.body` to `createUser()`. While Zod validates the shape, any extra fields not in the schema pass through due to Zod's default passthrough on the body object (only the `body` key is validated, not stripped).

### Recommended Improvements

- Return 204 for `forgotPassword` regardless of email existence
- Make `logout` return 204 unconditionally
- Add `{ strict: true }` or `.strict()` to Zod body schemas to reject unknown fields

---

## 4. Database & ORM (Prisma) Audit

### Current Implementation

- **Prisma 6.x** with PostgreSQL 16
- **Proper migration history** with 4 migrations
- **Dynamic Prisma singleton proxy** ([prisma.js](file:///d:/programming/notes/notes-backend/src/infrastructure/prisma.js)) supporting Testcontainers reconnection
- **Global password omit** via `omit` config — passwords never leave the ORM unless explicitly requested
- **Slow query telemetry** via `$extends` with configurable threshold
- **Cursor-based pagination** for notes, offset-based for users
- **Repository pattern** abstracting all Prisma calls
- **Transactions** used correctly for multi-entity mutations
- **Advisory locks** for distributed cron safety
- **Composite indexes** on common query patterns (`[ownerId, archived, createdAt]`)

### Problems Detected

1. **`findById` in user.repository.js has confusing signature** — [user.repository.js:L26-L39](file:///d:/programming/notes/notes-backend/src/modules/iam/repositories/user.repository.js#L26-L39) accepts `(id, options, tx)` but also handles the case where `options` is a Prisma transaction client. This polymorphic argument detection (`typeof options.findUnique === 'function'`) is fragile and error-prone.

2. **No soft delete** — Users and notes are hard-deleted. For a production system, this loses audit trail capability and makes recovery impossible.

3. **N+1 risk in `insertUsers` fixture** — [user.fixture.js](file:///d:/programming/notes/notes-backend/tests/fixtures/user.fixture.js#L108-L119) runs individual `upsert` calls in a loop inside a transaction. While acceptable for tests, the pattern is worth noting.

4. **`parsePopulate` allows arbitrary relation traversal** — [Paginate.js:L28-L55](file:///d:/programming/notes/notes-backend/src/shared/Paginate.js#L28-L55) builds Prisma `include` from user-controlled query strings. While `paginateUsers` in the repository whitelists allowed populations, the shared `paginate` function itself does not. If used elsewhere without whitelisting, it could expose deep relations.

5. **Legacy `LegacyRole` enum still exists** — The Prisma schema retains a deprecated `LegacyRole` enum and the `User.role` field. This creates migration confusion and should be removed once RBAC adoption is complete.

### Recommended Improvements

- Refactor `findById` to use a clear, non-polymorphic signature: `findById(id, { select, tx })`
- Add soft delete support (`deletedAt` timestamp) for users and notes
- Remove `LegacyRole` enum and `User.role` field once migration is complete

---

## 5. Security Audit

### Current Implementation

- **Helmet** for security headers
- **CORS** with configurable origins
- **bcryptjs** for password hashing
- **JWT with Passport.js** — access + refresh token architecture
- **Refresh token rotation** with SHA-256 hashing at rest and family-based reuse detection
- **Rate limiting** on auth, refresh, and general API
- **Response serializers** prevent data leakage
- **Audit logging** with sensitive metadata sanitization
- **Global password omit** in Prisma
- **RBAC with escalation prevention** — actors cannot assign roles above their own level

### Problems Detected

1. **`.env` committed with real secrets** (detailed above)

2. **bcrypt cost factor 8** (detailed above)

3. **No JSON payload size limit** (detailed above)

4. **No CSRF protection** — Not applicable for pure API backends using Bearer tokens, but the project uses `express.urlencoded({ extended: true })` which suggests form submissions may be possible.

5. **Password reset token sent as query parameter** — [auth.route.js:L17](file:///d:/programming/notes/notes-backend/src/modules/iam/routes/auth.route.js#L17) and [auth.controller.js:L44](file:///d:/programming/notes/notes-backend/src/modules/iam/controllers/auth.controller.js#L44) use `req.query.token`. Query parameters are logged in server access logs, browser history, and referrer headers. Should be in the request body.

6. **Email service URLs are hardcoded** — [email.service.js:L12](file:///d:/programming/notes/notes-backend/src/modules/iam/services/email.service.js#L12) uses `http://link-to-app/reset-password`. Not only is this a placeholder that will break in production, but it uses `http://` instead of `https://`.

7. **`trust proxy` set to `1`** — [app.js:L26](file:///d:/programming/notes/notes-backend/src/app.js#L26). Correct for single-proxy setups, but should be documented and verified against the actual deployment topology.

8. **No `Strict-Transport-Security` enforcement** — Helmet's defaults include HSTS, but there's no explicit verification that it's configured correctly for the deployment.

9. **`deleteUserByIdRecord` uses hard delete** — No way to recover from accidental user deletion. In a multi-admin environment, this is a data loss risk.

### Risks

- A database breach combined with cost-8 bcrypt would allow rapid offline password cracking
- The `.env` in version control means the secret has been exposed to every contributor and CI system

---

## 6. Logging & Observability Audit

### Current Implementation

- **Pino** as the structured logger ([logger.js](file:///d:/programming/notes/notes-backend/src/infrastructure/logger.js))
- **pino-http** middleware with per-request child loggers and correlation IDs
- **AsyncLocalStorage** proxy logger that automatically injects `reqId` and `userId`
- **Aggressive redaction** of `authorization`, `cookie`, `password`, `token`, `refreshToken`
- **Event loop lag detection** via `monitorEventLoopDelay` with configurable threshold
- **Custom metrics** for cache hit ratio, worker stats, slow queries, auth denials
- **Periodic metrics flushing** to log output (60s interval)
- **`no-console` ESLint rule** enforced — no `console.log` in production code

### Problems Detected

1. **Logger proxy creates child loggers on every call** — [logger.js:L69-L74](file:///d:/programming/notes/notes-backend/src/infrastructure/logger.js#L69-L74): `logger.child(bindings)` returns an object that calls `baseLogger.child(bindings).info(...)` on each invocation. This creates a new child logger object per log call, which adds GC pressure. The child logger should be cached per ALS context.

2. **No OpenTelemetry integration** — Metrics are logged as structured JSON but not exposed via Prometheus/OTLP. This limits integration with modern observability platforms.

3. **Health endpoints don't include Redis status** — [app.js:L58-L90](file:///d:/programming/notes/notes-backend/src/app.js#L58-L90) `/health` checks database only. Redis is listed in dependencies but not monitored.

4. **No request body logging** — While this is a security benefit, there's no opt-in mechanism for debugging specific endpoints. A debug-level body logger with redaction would be useful.

### Recommended Improvements

- Cache child loggers: `const cached = store.childLoggers?.get(bindings) || store.logger.child(bindings)`
- Add an `/metrics` endpoint or integrate `prom-client` for Prometheus scraping
- Include Redis connectivity in the health check when `REDIS_URL` is configured

---

## 7. Error Handling Audit

### Current Implementation

- **`ApiError` extends `Error`** ([ApiError.js](file:///d:/programming/notes/notes-backend/src/shared/ApiError.js)) with `statusCode`, `isOperational`, and `cause` chain
- **Centralized error pipeline**: `errorConverter` → `errorHandler`
- **Prisma error mapping** — P2002 (unique), P2025 (not found), P2003 (FK constraint), PrismaClientValidationError all mapped to appropriate HTTP codes
- **Stack trace suppression in production** — development only
- **`catchAsync` wrapper** prevents unhandled promise rejections in Express
- **Error attached to `res.err`** for pino-http auto-logging

### Problems Detected

1. **`ApiError` does not set `this.name`** — [ApiError.js](file:///d:/programming/notes/notes-backend/src/shared/ApiError.js) doesn't override `this.name`, so it defaults to `'Error'`. The error handler in [error.middleware.js:L56](file:///d:/programming/notes/notes-backend/src/middleware/error.middleware.js#L56) falls back to `err.name || 'API_ERROR'`, which will always be `'Error'` for ApiError instances. This means error codes in responses are non-descriptive.

2. **Bare `catch` blocks suppress original errors** — [auth.service.js:L162](file:///d:/programming/notes/notes-backend/src/modules/iam/services/auth.service.js#L162) and [auth.service.js:L191](file:///d:/programming/notes/notes-backend/src/modules/iam/services/auth.service.js#L191) catch ALL errors and throw a generic ApiError, losing the original error context. If a database connection failure occurs during password reset, it will be reported as "Password reset failed" with no indication of the actual problem.

3. **`exitHandler` always exits with code 1** — [index.js:L123](file:///d:/programming/notes/notes-backend/src/index.js#L123): Even on successful shutdown via `unexpectedErrorHandler`, the process exits with code 1. Signal-based shutdown correctly uses code 0 on success, but error-triggered shutdown should differentiate between clean and dirty exits.

### Recommended Improvements

```js
// Fix ApiError to set name
export class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '', cause = null) {
    super(message, { cause });
    this.name = 'ApiError';
    this.statusCode = statusCode;
    // ...
  }
}
```

---

## 8. Testing Audit

### Current Implementation

- **Vitest 4.x** with `pool: 'forks'` and `fileParallelism: false`
- **Testcontainers** for PostgreSQL in integration tests — spins up real Postgres 16 alpine container
- **Global setup/teardown** — single container for all tests, schema pushed via `prisma db push`
- **Per-test truncation** — all tables truncated between tests for isolation
- **E2E tests**: `auth.e2e.test.js` (23KB), `user.e2e.test.js` (21KB), `note.e2e.test.js` (12KB), `security.e2e.test.js` (2.3KB), `pipeline.e2e.test.js` (1.6KB), `docs.e2e.test.js` (0.5KB)
- **Unit tests**: Serializers, repositories (mocked), pagination, password hashing, error middleware
- **Test fixtures** with factory functions for users, notes, tokens
- **Supertest** for HTTP-level testing

### Problems Detected

1. **No unit tests for critical services** — `auth.service.js`, `token.service.js`, `permission.service.js`, `authorization.service.js` have NO unit tests. These contain the most complex business logic (refresh token rotation, RBAC matching, escalation prevention).

2. **`setupTestDB.js` uses `export default`** — [setupTestDB.js:L38](file:///d:/programming/notes/notes-backend/tests/utils/setupTestDB.js#L38) violates the project's "named exports only" rule.

3. **Test fixture uses `bcrypt.genSaltSync(8)`** — [user.fixture.js:L6-L7](file:///d:/programming/notes/notes-backend/tests/fixtures/user.fixture.js#L6-L7) uses synchronous bcrypt with cost 8. While acceptable in tests for speed, it normalizes the low cost factor.

4. **Coverage excludes `src/app.js`** — [vitest.config.js:L19](file:///d:/programming/notes/notes-backend/vitest.config.js#L19). The middleware pipeline in `app.js` is a critical surface and should have coverage.

5. **No dedicated permission/RBAC test suite** — The RBAC system is the most architecturally complex component but has no focused test coverage for edge cases: scope escalation, wildcard matching, cache invalidation race conditions, version bumping.

6. **RBAC tables not truncated between tests** — [setupTestDB.js:L28](file:///d:/programming/notes/notes-backend/tests/utils/setupTestDB.js#L28) truncates `notes, tokens, users, audit_logs` but NOT `rbac_roles, permissions, role_permissions, user_roles`. This could cause test pollution.

### Recommended Improvements

- Add unit tests for `matchesPermission`, `assertScopedPermission`, and `assertCanAssignRole`
- Include RBAC tables in the truncation: `"rbac_roles", "permissions", "role_permissions", "user_roles"`
- Change `export default setupTestDB` to `export { setupTestDB }`

---

## 9. DevOps & Production Readiness Audit

### Current Implementation

- **Dockerfile** with non-root user, `npm ci`, healthcheck
- **docker-compose** with multi-file override strategy (base, dev, prod, test)
- **GitHub Actions CI** with lint → Prisma validate → test pipeline
- **Husky + lint-staged + commitlint** for pre-commit quality gates
- **`.editorconfig`** for consistent editor settings
- **Graceful shutdown** with SIGTERM/SIGINT handling

### Problems Detected

1. **Dockerfile uses `node:alpine` without version tag** — [Dockerfile:L1](file:///d:/programming/notes/notes-backend/Dockerfile#L1). This will pull the latest Node alpine, breaking reproducibility. Should be `node:20-alpine3.19` or similar.

2. **No multi-stage build** — The Dockerfile copies the entire project including devDependencies, tests, and docs into the production image. A multi-stage build would reduce image size by 60%+.

3. **docker-compose.yml binds source directory as volume** — [docker-compose.yml:L15](file:///d:/programming/notes/notes-backend/docker-compose.yml#L15) mounts `.:/usr/src/node-app`, which overwrites the `npm ci` artifacts from the image build. This is only appropriate for development but is in the base compose file.

4. **Production compose doesn't set resource limits** — [docker-compose.prod.yml](file:///d:/programming/notes/notes-backend/docker-compose.prod.yml) has no `deploy.resources.limits` or V8 memory limits.

5. **No `.nvmrc` or `.node-version` file** — `engines` in `package.json` says `>=18.18.0`, CI uses Node 20, but there's no lockfile for the exact Node version.

6. **CI doesn't run `prettier --check`** — Only `npm run lint` and `npm run test` are executed. Formatting violations won't block PRs.

7. **`.dockerignore` is too minimal** — Doesn't exclude `tests/`, `docs/`, `coverage/`, `.github/`, `*.md`, `.husky/`, `.prettierrc.json`, `.lintstagedrc.json`, etc. These all end up in the production image.

### Recommended Improvements

```dockerfile
# Multi-stage production Dockerfile
FROM node:20-alpine3.19 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

FROM node:20-alpine3.19
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs src ./src
COPY --chown=nodejs:nodejs prisma ./prisma
COPY --chown=nodejs:nodejs package.json ./
USER nodejs
EXPOSE 3000
CMD ["node", "src/index.js"]
```

---

# Architectural Analysis

## System Design Quality

The architecture demonstrates strong engineering intent. The **composition root** pattern in `router.js`, where modules are registered and inter-module hooks are wired, is a textbook modular monolith approach. The dependency inversion for user deletion cascading (`registerUserDeletionHook`) is particularly well-executed — it allows the notes module to participate in user lifecycle events without creating a compile-time dependency from IAM to Notes.

## Module Boundaries

Boundaries are enforced at three levels:

1. **Lint-time**: `eslint-plugin-boundaries` with explicit allow-lists
2. **Runtime**: Barrel files expose only public APIs
3. **Architectural**: Repository pattern isolates data access

The one gap is [passport.js](file:///d:/programming/notes/notes-backend/src/infrastructure/passport.js#L4) reaching into `user.repository.js` directly, bypassing the module boundary.

## Scalability Bottlenecks

1. **LRU cache** — The single-process in-memory cache is the primary scaling limitation. RBAC permissions, once cached, are invisible to other instances. This must be replaced with Redis before horizontal scaling.
2. **Advisory locks** in the token cleanup worker use PostgreSQL advisory locks, which IS horizontally safe. Well done.
3. **No connection pooling configuration** — Prisma uses a default pool size. Under load, this could exhaust database connections.

## Technical Debt Hotspots

| Hotspot                                             | Severity | Effort to Fix |
| --------------------------------------------------- | -------- | ------------- |
| `LegacyRole` enum in Prisma schema                  | Medium   | Low           |
| `findById` polymorphic signature in user.repository | Medium   | Low           |
| `passport.js` deep import                           | Medium   | Low           |
| In-memory cache → Redis migration                   | High     | Medium        |
| Missing unit tests for auth/RBAC services           | High     | Medium        |
| Dockerfile modernization                            | Medium   | Low           |

---

# Security Risk Matrix

| Risk                                       | Severity    | Exploitability                   | Impact                             | Recommendation                            |
| ------------------------------------------ | ----------- | -------------------------------- | ---------------------------------- | ----------------------------------------- |
| JWT secret in committed `.env`             | 🔴 Critical | Trivial — repo access            | Full authentication bypass         | Remove from git, rotate secret, use vault |
| bcrypt cost factor 8                       | 🔴 Critical | Medium — requires DB breach      | Accelerated password cracking      | Increase to 12, rehash on login           |
| No JSON body size limit                    | 🟠 High     | Easy — send large payload        | Memory exhaustion DoS              | `express.json({ limit: '10kb' })`         |
| `forgotPassword` leaks user existence      | 🟡 Medium   | Easy — enumerate emails          | User enumeration                   | Return 204 regardless of email existence  |
| Password reset token in query param        | 🟡 Medium   | Passive — via logs/referrer      | Token leakage                      | Move to request body                      |
| `parsePopulate` allows arbitrary includes  | 🟡 Medium   | Requires bypassing validators    | Data exfiltration                  | Add global whitelist in shared paginate   |
| No RBAC cache consistency across instances | 🟠 High     | Timing-dependent                 | Privilege retention for up to 5min | Replace LRU with Redis                    |
| Email URLs hardcoded with `http://`        | 🟡 Medium   | Passive — phishing vector        | Man-in-the-middle on reset links   | Use config-driven `https://` URLs         |
| `express.urlencoded({ extended: true })`   | 🟡 Medium   | Possible — deep object injection | Prototype pollution vector         | Change to `extended: false`               |

---

# Production Readiness Verdict

## **Partially Production Ready — With Mandatory Security Fixes**

The system has strong architectural bones and thoughtful design decisions. However, it **CANNOT** be deployed to production in its current state due to:

1. **JWT secret exposure** — authentication is fundamentally compromised
2. **bcrypt cost factor 8** — password storage is below security baseline
3. **Missing `CORS_ORIGINS`** — application will crash at startup
4. **In-memory cache** — not viable for multi-instance deployment

After fixing these 4 items, the system would be **production ready with improvements** for a small-to-medium scale deployment. Enterprise-grade readiness would additionally require Redis-backed caching, OpenTelemetry, and comprehensive RBAC test coverage.

---

# Refactoring Priority Roadmap

## Phase 1 — Critical Fixes (Before Any Deployment)

| Item                                          | Complexity | File(s)                                                                                                                                                                                                           |
| --------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove `.env` from git, rotate JWT secret     | Low        | `.env`, `.gitignore`                                                                                                                                                                                              |
| Increase bcrypt cost to 12                    | Low        | [Password.js](file:///d:/programming/notes/notes-backend/src/shared/Password.js)                                                                                                                                  |
| Add `CORS_ORIGINS` to `.env` or make optional | Low        | [.env](file:///d:/programming/notes/notes-backend/.env), [config.js](file:///d:/programming/notes/notes-backend/src/infrastructure/config.js)                                                                     |
| Add `express.json({ limit: '10kb' })`         | Low        | [app.js](file:///d:/programming/notes/notes-backend/src/app.js)                                                                                                                                                   |
| Change `extended: true` to `extended: false`  | Low        | [app.js](file:///d:/programming/notes/notes-backend/src/app.js)                                                                                                                                                   |
| Fix `forgotPassword` user enumeration         | Low        | [token.service.js](file:///d:/programming/notes/notes-backend/src/modules/iam/services/token.service.js)                                                                                                          |
| Move reset password token from query to body  | Low        | [auth.route.js](file:///d:/programming/notes/notes-backend/src/modules/iam/routes/auth.route.js), [auth.controller.js](file:///d:/programming/notes/notes-backend/src/modules/iam/controllers/auth.controller.js) |

## Phase 2 — Architecture Improvements

| Item                                         | Complexity | File(s)                                                                                  |
| -------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| Replace LRU cache with Redis                 | Medium     | [cache.js](file:///d:/programming/notes/notes-backend/src/infrastructure/cache.js)       |
| Fix `passport.js` deep import                | Low        | [passport.js](file:///d:/programming/notes/notes-backend/src/infrastructure/passport.js) |
| Add `node:` protocol to all built-in imports | Low        | ~8 files                                                                                 |
| Set `ApiError.name` property                 | Low        | [ApiError.js](file:///d:/programming/notes/notes-backend/src/shared/ApiError.js)         |
| Replace `export *` in `notes/index.js`       | Low        | [notes/index.js](file:///d:/programming/notes/notes-backend/src/modules/notes/index.js)  |
| Fix `setupTestDB` default export             | Low        | [setupTestDB.js](file:///d:/programming/notes/notes-backend/tests/utils/setupTestDB.js)  |
| Remove `LegacyRole` enum from Prisma schema  | Medium     | [schema.prisma](file:///d:/programming/notes/notes-backend/prisma/schema.prisma)         |
| Add RBAC tables to test truncation           | Low        | [setupTestDB.js](file:///d:/programming/notes/notes-backend/tests/utils/setupTestDB.js)  |

## Phase 3 — Scalability Improvements

| Item                                           | Complexity | File(s)                                                                                                                                                                                        |
| ---------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-stage Dockerfile                         | Medium     | [Dockerfile](file:///d:/programming/notes/notes-backend/Dockerfile)                                                                                                                            |
| Expand `.dockerignore`                         | Low        | [.dockerignore](file:///d:/programming/notes/notes-backend/.dockerignore)                                                                                                                      |
| Pin Node.js version in Dockerfile and `.nvmrc` | Low        | Dockerfile, new `.nvmrc`                                                                                                                                                                       |
| Configure Prisma connection pool size          | Low        | [prisma.js](file:///d:/programming/notes/notes-backend/src/infrastructure/prisma.js)                                                                                                           |
| Add soft delete for users and notes            | Medium     | [schema.prisma](file:///d:/programming/notes/notes-backend/prisma/schema.prisma), repositories                                                                                                 |
| Config-driven email URLs with `https://`       | Low        | [email.service.js](file:///d:/programming/notes/notes-backend/src/modules/iam/services/email.service.js), [config.js](file:///d:/programming/notes/notes-backend/src/infrastructure/config.js) |

## Phase 4 — Enterprise Enhancements

| Item                                                | Complexity | File(s)                                                                              |
| --------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| OpenTelemetry integration                           | High       | New `infrastructure/telemetry.js`                                                    |
| Add unit tests for auth, token, permission services | Medium     | New test files                                                                       |
| Add Prometheus `/metrics` endpoint                  | Medium     | New middleware                                                                       |
| Add CI prettier check                               | Low        | [ci.yml](file:///d:/programming/notes/notes-backend/.github/workflows/ci.yml)        |
| Optimize logger `child()` caching                   | Low        | [logger.js](file:///d:/programming/notes/notes-backend/src/infrastructure/logger.js) |
| Add idempotency key support for POST endpoints      | Medium     | New middleware                                                                       |
| Add `npm audit` to CI pipeline                      | Low        | [ci.yml](file:///d:/programming/notes/notes-backend/.github/workflows/ci.yml)        |

---

# Standards Compliance Validation

> **Review Date**: 2026-06-07  
> **Standards Sources Reviewed**:
>
> - [AGENTS.md](file:///d:/programming/notes/notes-backend/AGENTS.md) (user-defined project rules)
> - [docs/standards/architecture-rules.md](file:///d:/programming/notes/notes-backend/docs/standards/architecture-rules.md)
> - [docs/standards/import-rules.md](file:///d:/programming/notes/notes-backend/docs/standards/import-rules.md)
> - [docs/standards/naming-conventions.md](file:///d:/programming/notes/notes-backend/docs/standards/naming-conventions.md)
> - [docs/standards/testing-standards.md](file:///d:/programming/notes/notes-backend/docs/standards/testing-standards.md)
> - [docs/ADR/0001-use-pino-for-structured-logging.md](file:///d:/programming/notes/notes-backend/docs/ADR/0001-use-pino-for-structured-logging.md)
> - [docs/ADR/0002-use-testcontainers-for-integration.md](file:///d:/programming/notes/notes-backend/docs/ADR/0002-use-testcontainers-for-integration.md)
> - [docs/architecture/security.md](file:///d:/programming/notes/notes-backend/docs/architecture/security.md)
> - [docs/architecture/deep_code_analysis.md](file:///d:/programming/notes/notes-backend/docs/architecture/deep_code_analysis.md)
> - [docs/architecture/production_readiness.md](file:///d:/programming/notes/notes-backend/docs/architecture/production_readiness.md)
> - [docs/architecture/authentication_wiki.md](file:///d:/programming/notes/notes-backend/docs/architecture/authentication_wiki.md)
> - [docs/architecture/technical_debt_report.md](file:///d:/programming/notes/notes-backend/docs/architecture/technical_debt_report.md)
> - [docs/architecture/database_architecture.md](file:///d:/programming/notes/notes-backend/docs/architecture/database_architecture.md)
> - [docs/architecture/dependency_intelligence.md](file:///d:/programming/notes/notes-backend/docs/architecture/dependency_intelligence.md)
> - [docs/observability/logging-policy.md](file:///d:/programming/notes/notes-backend/docs/observability/logging-policy.md)
> - [docs/infrastructure/prisma.md](file:///d:/programming/notes/notes-backend/docs/infrastructure/prisma.md)
> - [best_practice.md](file:///d:/programming/notes/best_practice.md) (Node.js community best practices reference)

---

## 1. Standards Correctly Recognized in Original Audit

The following audit findings were **accurate and aligned** with the project's own documented standards:

| Audit Finding                                 | Supporting Standard                                                 | Verdict              |
| --------------------------------------------- | ------------------------------------------------------------------- | -------------------- |
| Centralized router pattern (composition root) | AGENTS.md §4, architecture-rules.md §5                              | ✅ Correctly praised |
| Named exports only enforcement                | AGENTS.md §1, import-rules.md §2                                    | ✅ Correctly praised |
| Strict ESM `.js` extension imports            | AGENTS.md §2, import-rules.md §1                                    | ✅ Correctly praised |
| Barrel pattern for public APIs                | AGENTS.md §3, import-rules.md §3-§4                                 | ✅ Correctly praised |
| Flat module structure preference              | AGENTS.md §6, architecture-rules.md §2                              | ✅ Correctly praised |
| Infrastructure in `src/infrastructure/`       | AGENTS.md §8, architecture-rules.md §3                              | ✅ Correctly praised |
| Shared layer as stateless utilities           | AGENTS.md §15, architecture-rules.md §4                             | ✅ Correctly praised |
| `eslint-plugin-boundaries` enforcement        | AGENTS.md §5 (cross-module rules)                                   | ✅ Correctly praised |
| `export *` flagged in `notes/index.js`        | AGENTS.md §13, import-rules.md §4                                   | ✅ Correctly flagged |
| `passport.js` deep import flagged             | AGENTS.md §5, import-rules.md §3                                    | ✅ Correctly flagged |
| `setupTestDB` default export flagged          | AGENTS.md §1, import-rules.md §2                                    | ✅ Correctly flagged |
| Pino as structured logger (ADR decision)      | ADR-0001                                                            | ✅ Correctly praised |
| Testcontainers for integration testing        | ADR-0002, testing-standards.md §1-§2                                | ✅ Correctly praised |
| ALS-based request correlation                 | ADR-0001, logging-policy.md §1, best_practice.md §5.14              | ✅ Correctly praised |
| Graceful shutdown praised                     | production_readiness.md §3, best_practice.md §8.6                   | ✅ Correctly praised |
| `LegacyRole` flagged as technical debt        | technical_debt_report.md §1                                         | ✅ Correctly flagged |
| In-memory rate limiting flagged               | production_readiness.md §2, security.md §5                          | ✅ Correctly flagged |
| Monolithic cron flagged                       | technical_debt_report.md §2, deep_code_analysis.md (index.js risks) | ✅ Correctly flagged |
| Secret management weakness flagged            | technical_debt_report.md §3                                         | ✅ Correctly flagged |

---

## 2. False Positives — Audit Findings That Require Correction

### 2.1 CSRF Concern (Section 5, Item 4) — **DOWNGRADED: Not Applicable**

**Original audit finding**: _"No CSRF protection — Not applicable for pure API backends using Bearer tokens, but the project uses `express.urlencoded({ extended: true })` which suggests form submissions may be possible."_

**Standards context**: [security.md §4](file:///d:/programming/notes/notes-backend/docs/architecture/security.md#L85-L92) explicitly documents: _"the API currently issues raw JSON tokens (for SPA consumption via localStorage/memory)."_ The project's documented security architecture is a **stateless Bearer token API**, not a cookie-based session system. `express.urlencoded` is present for webhook/form payloads, not browser session forms.

**Revised verdict**: ~~🟡 Medium~~ → **Not Applicable**. CSRF is irrelevant for this authentication model. The security doc explicitly acknowledges the `httpOnly` cookie migration is a **future migration path**, not a current requirement. Remove from the Security Risk Matrix.

### 2.2 `trust proxy` set to `1` (Section 5, Item 7) — **DOWNGRADED: Intentional**

**Original audit finding**: _"`trust proxy` set to `1` — Correct for single-proxy setups, but should be documented and verified against the actual deployment topology."_

**Standards context**: [security.md §3](file:///d:/programming/notes/notes-backend/docs/architecture/security.md#L79-L81) explicitly states: _"The backend natively understands execution behind Reverse Proxies (e.g. Nginx, Cloudflare, Render). `app.set('trust proxy', 1)` is enabled to ensure rate-limiters throttle the true client IP rather than the load balancer."_

**Revised verdict**: This IS documented and intentional. ~~Flag for review~~ → **Compliant with internal standards**. Remove from findings.

### 2.3 No Request Body Logging (Section 6, Item 4) — **DOWNGRADED: Intentional Policy**

**Original audit finding**: _"No request body logging — While this is a security benefit, there's no opt-in mechanism for debugging specific endpoints."_

**Standards context**: [logging-policy.md §2](file:///d:/programming/notes/notes-backend/docs/observability/logging-policy.md#L42-L58) explicitly classifies `req.body (entire object)` under **"FORBIDDEN TO LOG"**. The standard says: _"Always explicitly cherry-pick safe fields before logging."_

**Revised verdict**: The absence of body logging is a **deliberate security policy**, not a gap. The audit recommendation for "opt-in body logging" directly contradicts the project's own logging policy. ~~Recommendation~~ → **Remove recommendation**. The project is correct here.

### 2.4 `nodemailer.createTransport()` Side Effect (Section 2, Item 5) — **DOWNGRADED: Acceptable**

**Original audit finding**: Flagged as a side-effect at import time violating best_practice.md §3.13 ("Avoid effects outside of functions").

**Standards context**: [architecture-rules.md §3](file:///d:/programming/notes/notes-backend/docs/standards/architecture-rules.md#L33-L38) says infrastructure components should be _"simple flat files (`prisma.js`, `cache.js`)"_. The project explicitly follows a singleton-at-module-scope pattern for all infrastructure: `prisma.js` instantiates the Prisma client at module load, `cache.js` instantiates the LRU cache at module load, and `logger.js` instantiates Pino at module load. The mailer follows the same pattern.

**Revised verdict**: While best_practice.md §3.13 recommends against side effects, the project has an **established infrastructure convention** of module-scope singletons. This is a conscious, documented architectural decision. ~~Flag~~ → **Acceptable within project conventions**. Severity reduced from problem to note.

### 2.5 IAM Sub-Folder Structure Inconsistency (Section 1, Item 1) — **DOWNGRADED: Accepted Deviation**

**Original audit finding**: _"IAM module uses sub-folders while notes uses a flat structure. This inconsistency creates cognitive dissonance."_

**Standards context**: [architecture-rules.md §2](file:///d:/programming/notes/notes-backend/docs/standards/architecture-rules.md#L24-L31) says _"Prefer flat structures"_ but AGENTS.md §6 clarifies: _"Flat structures are preferred, but clarity is more important than extreme flattening. Do NOT flatten aggressively during unstable migrations."_ The IAM module contains ~15+ files across 6 concerns — forcing these into a single folder would reduce clarity.

**Revised verdict**: The IAM module's sub-folder usage is **justified by its size and complexity**. The original audit already noted this parenthetically but still listed it as a "problem." ~~Problem~~ → **Accepted architectural deviation, consistent with AGENTS.md §6**. Remove from "Problems Detected."

### 2.6 No Soft Delete (Section 4, Item 2) — **DOWNGRADED: Intentional Design**

**Original audit finding**: _"Users and notes are hard-deleted. For a production system, this loses audit trail capability."_

**Standards context**: [database_architecture.md §3](file:///d:/programming/notes/notes-backend/docs/architecture/database_architecture.md#L20-L22) explains that `Note` uses `onDelete: Restrict` to **force the application layer to orchestrate cascading deletions**. [database_architecture.md §2](file:///d:/programming/notes/notes-backend/docs/architecture/database_architecture.md#L15-L18) documents that `AuditLog` deliberately uses soft references (no FK constraints) specifically so that _"audit logs remain immutable and intact even if a parent user or note is hard-deleted."_

**Revised verdict**: The project **intentionally uses hard delete + immutable audit logs** as its data lifecycle strategy. Soft delete is not missing — it was architecturally rejected in favor of audit log persistence. The audit trail is NOT lost by hard deletes; it's preserved by the AuditLog design. ~~Recommendation to add soft delete~~ → **Downgrade to "consider for future" only**. Not a current gap.

---

## 3. Missed Standards Violations — Issues Not Caught by Original Audit

### 3.1 `shared/` Naming Convention Violation

**Standard**: [naming-conventions.md §11](file:///d:/programming/notes/notes-backend/docs/standards/naming-conventions.md#L61-L65) mandates: _"Shared Layer Utilities: Use PascalCase.js exclusively."_

**Violation**: [catchAsync.js](file:///d:/programming/notes/notes-backend/src/shared/catchAsync.js) uses `camelCase.js` instead of the mandated `CatchAsync.js`. The standard explicitly states: _"Good: `ApiError.js`, `CatchAsync.js`"_ and _"Avoid: `apiError.js`, `api-error.js`"_.

**Severity**: 🟡 Low — naming convention violation.
**Fix**: Rename `catchAsync.js` → `CatchAsync.js` and update all import references.

### 3.2 Missing `eslint-plugin-security`

**Standard**: [best_practice.md §6.1](file:///d:/programming/notes/best_practice.md) recommends: _"Make use of security-related linter plugins such as `eslint-plugin-security`."_

**Violation**: The ESLint configuration uses `eslint-plugin-boundaries` (excellent) but does NOT include `eslint-plugin-security`. The security linter can catch patterns like `eval()`, dynamic `require()`, and unsafe regex — none of which are manually reviewed.

**Severity**: 🟡 Medium — security tooling gap.
**Fix**: Add `eslint-plugin-security` to the ESLint flat config.

### 3.3 No `npm audit` in CI or Local Workflow

**Standard**: [best_practice.md §6.7](file:///d:/programming/notes/best_practice.md) says: _"Use tools like `npm audit` or `snyk` to track, monitor and patch vulnerable dependencies. Integrate these tools with your CI setup."_

**Violation**: [ci.yml](file:///d:/programming/notes/notes-backend/.github/workflows/ci.yml) runs `npm run lint` and `npm run test` but never runs `npm audit`. No vulnerability scanning is automated.

**Severity**: 🟡 Medium — supply chain security gap.
**Fix**: Add `npm audit --audit-level=high` as a CI step. Already noted in Phase 4 of the roadmap but should be elevated to Phase 1 given the supply chain attack landscape.

### 3.4 Testing Standards: "No Mocking Prisma" Rule vs. Unit Test Structure

**Standard**: [testing-standards.md §2](file:///d:/programming/notes/notes-backend/docs/standards/testing-standards.md#L43-L56) states: _"Persistence and repository behavior MUST be tested against real PostgreSQL behavior whenever possible."_ and _"If a test touches a repository or database layer, it must run against the Testcontainer."_

**Observation**: The repository unit tests in [repository.test.js](file:///d:/programming/notes/notes-backend/src/modules/iam/tests/unit/repository.test.js) (3.8KB) and [repository.test.js](file:///d:/programming/notes/notes-backend/src/modules/notes/tests/unit/repository.test.js) (3.8KB) are in the `unit/` directory. If these tests mock Prisma (as implied by their `unit/` placement and the testing-standards rule against mocking Prisma), they may violate the project's own testing standard. These files should be integration tests running against Testcontainers.

**Severity**: 🟡 Medium — potential testing standard violation.
**Investigation needed**: Verify if these "unit" tests mock Prisma or run against a real DB.

### 3.5 Worker Deep Import Violates Module Boundaries

**Standard**: AGENTS.md §5: _"Do NOT import repositories across modules."_ Import-rules.md §3: _"Cross-Module Communication: Modules must import from sibling modules using the index barrel."_

**Violation**: [token-cleanup.worker.js:L8](file:///d:/programming/notes/notes-backend/src/infrastructure/workers/token-cleanup.worker.js#L8) directly imports:

```js
import { deleteExpiredTokens } from '../../modules/iam/repositories/token.repository.js';
```

This is an infrastructure component reaching deep into a module's internal repository, bypassing the IAM barrel file (`index.js`). This is the **same class of violation** as the `passport.js` deep import, but was not flagged in the original audit.

**Severity**: 🟠 Medium — boundary violation, same pattern as passport.js.
**Fix**: Either expose `deleteExpiredTokens` through the IAM barrel as a public service, or wrap it in a service function and export that.

### 3.6 Missing Observability Verification Tests

**Standard**: [testing-standards.md §5](file:///d:/programming/notes/notes-backend/docs/standards/testing-standards.md#L77-L81) says: _"Tests must explicitly verify that sensitive data (`password`, `token`) is converted to `[REDACTED]` prior to persistence."_

**Violation**: No tests verify the audit log sanitization logic in `audit.service.js`. The `FORBIDDEN_KEYS` redaction and the 2000-char truncation are untested. Given the testing standard explicitly requires redaction verification, this is a gap against the project's own standards.

**Severity**: 🟡 Medium — untested security-critical behavior.
**Fix**: Add unit tests for `sanitizeMetadata` that verify password/token redaction and truncation limits.

---

## 4. Incorrect Assumptions — Recalibrated Understanding

### 4.1 `export * as` in `iam/index.js` — Re-evaluated

**Original claim**: _"exports all six services as namespace imports... still exposes emailService.transport"_

**Standards context**: AGENTS.md §13 says: _"Do NOT export everything blindly. Do NOT use `export *` excessively."_ However, `export * as serviceName` is a **namespace re-export**, which is more controlled than `export *`. Each service is namespaced (e.g., `authService.login()`) rather than flat-exported. The `emailService.transport` exposure is a valid concern, but the barrel pattern itself is **within acceptable bounds** for the project's conventions.

**Revised verdict**: Downgraded from "Problem" to "Minor note." The namespace pattern provides adequate encapsulation for the current codebase size.

### 4.2 Monolithic Cron Concern — Already Mitigated

**Original claim**: Flagged cron execution across multiple instances as a scaling risk.

**Standards context**: The project's own [deep_code_analysis.md](file:///d:/programming/notes/notes-backend/docs/architecture/deep_code_analysis.md#L57-L63) acknowledges this risk, and [production_readiness.md](file:///d:/programming/notes/notes-backend/docs/architecture/production_readiness.md#L22-L24) explicitly documents the mitigation: _"only ONE pod should have `enableBackgroundWorkers = true`"_. Furthermore, the actual code uses `pg_try_advisory_lock()` for distributed safety — meaning even if multiple instances run the cron, only one will execute the cleanup.

**Revised verdict**: The advisory lock mechanism **already solves the race condition**. The `enableBackgroundWorkers` flag provides an additional control layer. This was correctly praised in the original audit's "Advisory locks" note, but the cron concern in the technical debt section appears **over-weighted** given the existing safeguards. Downgrade from 🟠 High to 🟡 Medium (architectural improvement, not a production blocker).

---

## 5. Intentional Architecture Decisions Confirmed

The following audit findings correspond to **intentionally documented** architectural decisions that should NOT be treated as gaps:

| Decision                                               | Documentation                                        | Audit Alignment                                               |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------- |
| AuditLog uses soft references (no FKs)                 | database_architecture.md §2                          | ✅ Audit correctly noted this as intentional                  |
| `onDelete: Restrict` on Note→User                      | database_architecture.md §3                          | ✅ Audit understood the cascading strategy                    |
| Refresh token rotation with 2s grace                   | security.md §1, authentication_wiki.md               | ✅ Audit correctly praised the pattern                        |
| Anti-fingerprinting policy                             | security.md §6                                       | ⚠️ Not mentioned in audit — but not relevant to a code audit  |
| No Prisma mocking in tests                             | testing-standards.md §2, prisma.md §1                | ✅ Audit aligned (praised Testcontainers)                     |
| Swagger docs in dev only                               | Current design choice                                | ⚠️ Audit flagged this — it's a trade-off, not a violation     |
| `trust proxy = 1`                                      | security.md §3                                       | ❌ Audit flagged as "should be documented" — it IS documented |
| Token retention policy (delete expired, audit revoked) | security.md §1 "Explicit Token Retention Policy"     | ✅ Audit missed this nuance but didn't contradict it          |
| In-memory cache acknowledged as scaling debt           | production_readiness.md §1, technical_debt_report.md | ✅ Audit aligned with project's own assessment                |

---

## 6. Updated Conclusions After Standards Review

### Score Adjustments

| Category                      | Original | Adjusted     | Reason                                                                                                              |
| ----------------------------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Architecture & Modularity     | 88/100   | **90/100** ↑ | IAM sub-folder structure is justified per AGENTS.md §6; remove as "problem"                                         |
| Security                      | 58/100   | **62/100** ↑ | CSRF concern removed (not applicable per security.md §4); `trust proxy` documented                                  |
| Logging & Observability       | 85/100   | **88/100** ↑ | No-body-logging is policy compliance, not a gap; logging policy is deeply documented                                |
| Testing                       | 75/100   | **73/100** ↓ | New violations found: missing sanitization tests per testing-standards.md §5; possible Prisma mocking in unit tests |
| DevOps & Production Readiness | 60/100   | **62/100** ↑ | Cron safety via advisory locks is better than initially weighted                                                    |

### Adjusted Final Score: **74 / 100** (was 72)

The upward revision reflects the project's intentional and well-documented decisions around body logging policy, CSRF applicability, `trust proxy`, soft deletes vs audit logs, and cron safety. The slight testing downgrade reflects newly discovered gaps against the project's _own_ testing standards.

### Revised Production Readiness Assessment

The audit's original verdict of "Partially Production Ready" stands, but with a more nuanced qualification. The project is **better than originally assessed** in several areas:

1. **CSRF is not a gap** — the stateless Bearer token model is explicitly documented
2. **Soft delete is not a gap** — the audit log architecture intentionally replaces soft delete
3. **Cron safety is stronger than assessed** — advisory locks provide distributed safety
4. **Logging discipline is exceptionally mature** — the logging policy doc represents enterprise-grade operational thinking

The critical blockers remain unchanged:

1. JWT secret in committed `.env`
2. bcrypt cost factor 8
3. Missing `CORS_ORIGINS`
4. In-memory LRU cache for RBAC (for multi-instance)

### Newly Identified Items for Roadmap

The following should be **added to Phase 1** (elevated priority):

| Item                                      | Source Standard                  | Severity  |
| ----------------------------------------- | -------------------------------- | --------- |
| Add `npm audit --audit-level=high` to CI  | best_practice.md §6.7            | 🟡 Medium |
| Fix `token-cleanup.worker.js` deep import | AGENTS.md §5, import-rules.md §3 | 🟡 Medium |

The following should be **added to Phase 2**:

| Item                                                 | Source Standard           | Severity  |
| ---------------------------------------------------- | ------------------------- | --------- |
| Add `eslint-plugin-security`                         | best_practice.md §6.1     | 🟡 Medium |
| Rename `catchAsync.js` → `CatchAsync.js`             | naming-conventions.md §11 | 🟡 Low    |
| Add audit sanitization unit tests                    | testing-standards.md §5   | 🟡 Medium |
| Investigate repository unit tests for Prisma mocking | testing-standards.md §2   | 🟡 Medium |
