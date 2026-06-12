# Project Rules

Strict, actionable engineering rules enforced across the codebase. Every rule is derived from actual implementation evidence or explicitly documented standards.

---

## Module System

- **ESM only** — `"type": "module"` in `package.json`. No CommonJS.
- **Named exports only** — `export const`, `export function`, `export class`. Never `export default`.
- **Explicit `.js` extensions** — all local imports must include `.js`. Enforced by `import-x/extensions`.
- **`node:` protocol** for built-in modules is the target standard and is fully enforced across all files (e.g., `import crypto from 'node:crypto'`).

## Module Boundaries

- Every module exposes a public API through `index.js` (barrel file).
- Cross-module communication via exported services only. No importing repositories, controllers, or validators across modules.
- `eslint-plugin-boundaries` enforces dependency direction at lint time:
  - `shared` → `shared`, `infrastructure`
  - `iam` → `shared`, `iam`, `infrastructure`
  - `notes` → `shared`, `iam`, `notes`, `audit`, `infrastructure`
  - `audit` → `shared`, `audit`, `infrastructure`
  - `infrastructure` → `shared`, `infrastructure`, `iam`
  - `app` → `shared`, `iam`, `notes`, `infrastructure`, `docs`
- Internal module files may import siblings directly (avoid importing through `index.js` within the same module to prevent circular dependencies).
- explicit boundaries
- runtime stability
- minimal dependencies
- maintainability

---

# Core Rules

## Testing Architecture

Testing rules, ADRs, and the Testcontainer/Integration policies are formally defined in:

```txt
docs/TESTING_RULES.md
```

You MUST adhere to these rules when creating or modifying tests.

## Barrel File Rules

`index.js` files must expose only:

- Public services
- Module registration helpers

Must NOT expose:

- Repositories
- Validators (unless intentionally public)
- Internal utilities
- Use `export *` sparingly — prefer explicit named exports

## Folder Structure

- **Flat preferred** — avoid sub-folders unless justified by module size.
- `notes` module: flat (`note.controller.js`, `note.service.js`, etc.).
- `iam` module: sub-folders (`controllers/`, `services/`, `repositories/`, `routes/`, `validators/`) — justified by complexity (7 services, 2 controllers, 2 repositories, 2 routes, 3 validators).
- `audit` module: flat (3 files).

## Route Rules

- All routes aggregated through `src/modules/router.js`.
- `app.js` mounts only the centralized router at `/v1`.
- Routes are transport-layer concerns — not exported from barrel files.
- Module registration via `register*Module(router, options)` pattern.

## Controller Rules

- Orchestrate request/response flow only.
- Call services, never embed business logic.
- Use `catchAsync` wrapper for async error propagation.
- Set `res.locals.payload`, `res.locals.statusCode`, and `res.locals.serializer` — never call `res.send()` directly. The response interceptor middleware handles serialization.

## Service Layer

- Contains all business logic and transaction orchestration.
- Must call repositories for data access — never use `prisma` directly from services (except `runInTransaction` from infrastructure).
- Cross-module hooks for lifecycle events (e.g., `registerUserDeletionHook`).

## Repository Pattern

- All Prisma queries wrapped in repository functions.
- Repositories accept an optional `tx` parameter for transactional contexts.
- Never expose raw Prisma models to services or controllers.

## Validation

- **Zod** for all request validation (body, query, params).
- Validation middleware (`validate.middleware.js`) applied at the route level.
- Zod schemas defined in `*.validator.js` files per module.
- Config validation uses Zod with `safeParse` — app crashes on invalid config.

## Infrastructure Boundaries

All cross-cutting infrastructure lives in `src/infrastructure/`:

- `prisma.js` — Prisma client singleton with proxy, slow query telemetry
- `config.js` — Zod-validated environment configuration
- `logger.js` — Pino structured logger with ALS-aware proxy

- `als.js` — AsyncLocalStorage instance for request-scoped context
- `metrics.js` — In-process counters with periodic flush
- `passport.js` — JWT strategy setup
- `mailer.js` — Nodemailer transport
- `workers/` — Background cron jobs

Infrastructure must NOT live in `shared/`.

## Shared Layer

`src/shared/` contains only:

- `ApiError.js` — custom error class with `statusCode`, `isOperational`
- `CatchAsync.js` — async Express handler wrapper
- `CursorPaginate.js` — deterministic tuple cursor pagination engine
- `Paginate.js` — offset pagination utility
- `Pick.js` — object property picker

No infrastructure, business logic, or repositories in `shared/`.

## Middleware

Global Express middleware in `src/middleware/`:

- `auth.middleware.js` — JWT auth + RBAC permission gate
- `error.middleware.js` — error converter + handler pipeline
- `pino-http.middleware.js` — structured request logging
- `rate-limiter.middleware.js` — rate limiting (auth, refresh, general)
- `response-interceptor.middleware.js` — canonical response envelope
- `validate.middleware.js` — Zod schema validation

## Error Handling

- All errors normalized through `ApiError`.
- Error pipeline: `errorConverter` → `errorHandler`.
- Prisma errors (P2002, P2025, P2003) mapped to HTTP status codes.
- Stack traces suppressed in production.
- `res.err` set for pino-http auto-logging.

## Logging

- **Pino** — structured JSON logging. No `console.log` (enforced by `no-console` ESLint rule).
- **ALS-aware proxy** — auto-injects `reqId` and `userId` from AsyncLocalStorage context.
- **Redaction** — passwords, tokens, cookies, authorization headers automatically redacted.
- **Log levels**: `silent` (test), `debug` (development), `info` (production).
- **Event taxonomy**: `{domain}.{action}` format (e.g., `auth.login`, `notes.created`).

## Testing

- **Vitest** — test runner with `pool: 'forks'`, `fileParallelism: false`.
- **Testcontainers** — real PostgreSQL 16 containers for integration tests.
- **Per-test truncation** — all tables truncated between tests.
- **No mocking of database** in integration tests — tests run against real Prisma + PostgreSQL.
- **Supertest** for HTTP-level E2E tests.
- **Factory fixtures** for test data generation.

## Linting & Formatting

- **ESLint v9 flat config** — no legacy `.eslintrc` or `.eslintignore`.
- **Prettier** — formatting only, runs separately.
- **Plugins**: `@eslint/js`, `eslint-plugin-security`, `eslint-plugin-n`, `eslint-plugin-import-x`, `eslint-plugin-boundaries`, `@vitest/eslint-plugin`.
- **Prettier + ESLint decoupled** — `eslint-config-prettier` disables conflicting rules.

## Dependency Policy

- Justify every new dependency: why needed, why native Node.js is insufficient, why existing deps can't solve it.
- Avoid dependency bloat, overlapping packages, unnecessary abstractions.

## Naming Conventions

- Files: `kebab-case` or `{entity}.{layer}.js` (e.g., `note.service.js`, `auth.middleware.js`).
- Shared utilities: `PascalCase.js` (e.g., `ApiError.js`, `CatchAsync.js`).
- Functions: `camelCase`.
- Constants: `SCREAMING_SNAKE_CASE`.
- Database tables: `snake_case` (via Prisma `@@map`).
- Prisma models: `PascalCase`.

## Refactor Safety

- Maximum 5–10 files per iteration.
- After every iteration: `npm run lint`, `npm run test`, `node src/index.js`.
- Validate: ESM resolution, runtime boot, route registration, Prisma boot, dependency graph stability.
- Use `npx madge --circular src/` after major structural refactors.

## Pagination Policy

- **Offset Pagination (`Paginate.js`)**: Approved **only** for administrative datasets (e.g., Users, Roles, Invitations).
- **Cursor Pagination (`CursorPaginate.js`)**: Mandatory for chronological, transactional datasets (e.g., Audit, Notes, Ledgers).
- **Deterministic Ordering**: Cursor pagination must use tuple sorting `(timestamp, id)` to prevent pagination drift under high concurrency. Single-field cursors on UUIDv4 primary keys are strictly forbidden.
- **Validation & Errors**: Malformed base64 cursors or invalid payloads must be gracefully caught and rejected as `400 Bad Request`. They must never trigger `500 Internal Server Error`.
- **Composite Indexes**: Any model utilizing Cursor Pagination MUST define a composite index covering the tuple fields with matching sort direction (e.g. `@@index([createdAt(sort: Desc), id(sort: Desc)])`) to ensure O(1) scalability.
- **Branch Isolation**: Cursor Pagination leverages Prisma delegates natively, ensuring full compatibility with the Silent Guardian middleware and Branch Isolation constraints without raw SQL bypasses.
- **Backward Pagination**: Intentionally deferred. Current ERP modules only require chronological forward feeds. Support for backward navigation (`take: -limit`) may be implemented in future revisions when Data Grid requirements arise.

---

## Changelog

### 2026-06-09

- Initial creation from codebase analysis, AGENTS.md, and existing standards docs
- Documented all enforced conventions with implementation evidence
- Updated standard built-in import rule to confirm full migration to `node:` prefix
