# Backlog

Prioritized future work. Separated by category. Derived from audit report findings, codebase analysis, and existing technical debt documentation.

---

## Critical — Security Fixes

_Must be resolved before any production deployment._

- [ ] **Rotate JWT secret** — Remove `.env` from git history, use `.env.example` with placeholders, inject via CI/CD vault
- [ ] **Increase bcrypt cost to 12** — Update `Password.js`, implement rehash-on-login migration for existing users
- [ ] **Add JSON body size limit** — `express.json({ limit: '10kb' })` and `express.urlencoded({ extended: false, limit: '10kb' })`
- [ ] **Fix `forgotPassword` user enumeration** — Return 204 regardless of email existence
- [ ] **Move password reset token from query param to request body** — Prevents token leakage via logs/referrer

---

## Technical Debt

_Existing debt that impacts maintainability or correctness._

- [ ] **Remove `LegacyRole` enum** — Finalize RBAC migration, drop `User.role` field and `LegacyRole` enum from Prisma schema
- [ ] **Fix `passport.js` deep import** — Import `findById` via IAM barrel file instead of directly from `user.repository.js`
- [ ] **Replace `export *` in `notes/index.js`** — Use explicit named exports to prevent God index file
- [ ] **Fix `ApiError.name` property** — Set `this.name = 'ApiError'` for meaningful error codes in responses
- [ ] **Fix `setupTestDB` default export** — Change to named export per project rules
- [ ] **Add RBAC tables to test truncation** — Include `rbac_roles`, `permissions`, `role_permissions`, `user_roles` in `setupTestDB.js`
- [ ] **Add `node:` protocol to built-in imports** — Standardize ~8 files to use `node:crypto`, `node:path`, `node:async_hooks`, etc.
- [ ] **Fix bare `catch` blocks in auth.service.js** — Preserve original error context for `resetPassword` and `verifyEmail`
- [ ] **Config-driven email URLs** — Replace hardcoded `http://link-to-app` with configurable `APP_URL` from env

---

## Future Systems

_New capabilities to build._

- [ ] **Redis-backed RBAC cache** — Replace `lru-cache` with Redis for horizontal scaling. `REDIS_URL` already in env
- [ ] **OpenTelemetry integration** — Structured metrics export via OTLP/Prometheus for production observability
- [ ] **Soft delete for Users and Notes** — Add `deletedAt` timestamp, update repositories and services
- [ ] **Idempotency key support** — Middleware for POST endpoint idempotency to prevent duplicate resource creation
- [ ] **Admin API for role/permission management** — CRUD endpoints for roles and permissions (currently seed-only)

---

## Scalability Improvements

- [ ] **Multi-stage Dockerfile** — Separate builder stage, pin Node version (`node:20-alpine3.19`), reduce image size ~60%
- [ ] **Expand `.dockerignore`** — Exclude `tests/`, `docs/`, `coverage/`, `.github/`, `.husky/`, `*.md`
- [ ] **Configure Prisma connection pool** — Explicit pool size configuration for production load
- [ ] **Distributed worker scheduling** — Migrate from `node-cron` to BullMQ/Redis for exactly-once cron execution across replicas
- [ ] **Add `.nvmrc` or `.node-version`** — Lock Node.js version for reproducible environments

---

## Testing Improvements

- [ ] **Unit tests for critical services** — `auth.service.js`, `token.service.js`, `permission.service.js`, `authorization.service.js`
- [ ] **RBAC-focused test suite** — Edge cases: scope escalation, wildcard matching, cache invalidation races, version bumping
- [ ] **Include `app.js` in coverage** — Remove from vitest exclude list
- [ ] **Add CI prettier check** — `npm run prettier` in GitHub Actions pipeline
- [ ] **Add `npm audit` to CI** — Dependency vulnerability scanning in pipeline

---

## Postponed Features

- [ ] **Google SSO** — OAuth2 integration for social login
- [ ] **Note sharing/collaboration** — Multi-user access to notes
- [ ] **Note folders/categories** — Hierarchical organization beyond tags
- [ ] **Real-time sync** — WebSocket or SSE for live note updates
- [ ] **File attachments** — Note-attached media with storage backend

---

## Changelog

### 2026-06-09

- Initial creation from AUDIT_REPORT.md findings, technical_debt_report.md, and codebase analysis
- Prioritized into: critical security, technical debt, future systems, scalability, testing, postponed
