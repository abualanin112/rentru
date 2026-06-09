# Decisions Log

Architectural and engineering decisions documented as they become clear. Evidence-based only — no speculative entries.

---

## ADR-001: Pino for Structured Logging

**Decision**: Use Pino as the sole logging library.  
**Date**: Pre-2026-06-09 (documented in `docs/ADR/0001-use-pino-for-structured-logging.md`)  
**Reason**: High-performance structured JSON logging. Pino's serializer architecture avoids the overhead of Winston's transport system. Native support for child loggers and redaction.  
**Tradeoffs**: Less ecosystem support than Winston for exotic transports. Requires `pino-pretty` for development readability.  
**Future**: OpenTelemetry integration planned for production observability.

---

## ADR-002: Testcontainers for Integration Testing

**Decision**: Use Testcontainers with real PostgreSQL containers instead of mocks or SQLite.  
**Date**: Pre-2026-06-09 (documented in `docs/ADR/0002-use-testcontainers-for-integration.md`)  
**Reason**: Eliminates ORM behavior divergence between test and production databases. PostgreSQL-specific features (full-text search, advisory locks) require real PostgreSQL.  
**Tradeoffs**: Slower test execution. Requires Docker available in CI. Higher resource usage.  
**Future**: Container-per-suite (not per-test) balances isolation vs. speed.

---

## ADR-003: Database-Driven RBAC over Hardcoded Roles

**Decision**: Migrate from hardcoded `LegacyRole` enum to database-driven RBAC with `Role`, `Permission`, `RolePermission`, `UserRole` tables.  
**Date**: Pre-2026-06-09 (evidenced by schema and permission service)  
**Reason**: Hardcoded enums cannot support dynamic permission management, multi-role users, or granular access control. The `action:resource:scope` model enables fine-grained authorization.  
**Tradeoffs**: Higher query complexity for permission resolution. Requires caching layer. Migration period with dual role systems (`LegacyRole` retained as fallback).  
**Future**: Remove `LegacyRole` enum and `User.role` field once all users are migrated to the `UserRole` join table.

---

## ADR-004: In-Memory LRU Cache for RBAC Permissions

**Decision**: Use `lru-cache` (in-memory) for RBAC permission caching.  
**Date**: Pre-2026-06-09 (evidenced by `cache.js`)  
**Reason**: Simplicity. No Redis dependency for early-stage single-node deployment. 5-minute TTL with version-based invalidation provides acceptable consistency for development/staging.  
**Tradeoffs**: Not horizontally scalable. Permissions diverge across instances. Stale permissions possible for up to 5 minutes on other nodes.  
**Future**: Replace with Redis when horizontal scaling is required. `REDIS_URL` env var already present in `.env` but unused by cache module.

---

## ADR-005: Token Family Rotation with Reuse Detection

**Decision**: Implement refresh token rotation using token families and blacklisting.  
**Date**: Pre-2026-06-09 (evidenced by `auth.service.js` and `Token` schema)  
**Reason**: Prevents token replay attacks. If a refresh token is stolen and reused, the entire token family is revoked, forcing re-authentication. 2-second grace period handles legitimate concurrent frontend requests.  
**Tradeoffs**: Increased DB writes per token refresh (blacklist + create). Storage of blacklisted tokens until cron cleanup.  
**Future**: Consider sliding window or JWT ID (jti) revocation list for stateless approaches at scale.

---

## ADR-006: Audit Log Decoupling (No Foreign Keys)

**Decision**: AuditLog table has no foreign key constraints. Uses soft references (`actorId`, `entityId`).  
**Date**: Pre-2026-06-09 (evidenced by schema comments)  
**Reason**: Audit logs must survive entity deletion. If a user is deleted, their audit trail must remain intact. Foreign keys would cascade-delete or block audit records.  
**Tradeoffs**: No referential integrity enforcement. Orphaned references possible. Cannot JOIN directly to entity tables without manual correlation.  
**Future**: Consider a separate audit database or event store for high-volume systems.

---

## ADR-007: Composition Root for Module Registration

**Decision**: Use `src/modules/router.js` as the composition root for module registration and inter-module wiring.  
**Date**: Pre-2026-06-09 (evidenced by `router.js`)  
**Reason**: Centralizes all module initialization, route mounting, and cross-module hook wiring in a single location. Prevents hidden coupling between modules.  
**Tradeoffs**: Single file grows as modules are added. Must be manually updated for new modules.  
**Future**: Consider a module registry pattern if module count exceeds 8-10.

---

## ADR-008: Response Serialization via Interceptor Middleware

**Decision**: Use a response interceptor middleware pattern instead of direct `res.send()` in controllers.  
**Date**: Pre-2026-06-09 (evidenced by `response-interceptor.middleware.js`)  
**Reason**: Enforces canonical response envelope (`{ success: true, data: ... }`) across all endpoints. Enables centralized serializer application, preventing accidental Prisma object leakage.  
**Tradeoffs**: Controllers must use `res.locals` instead of `res.send()` — non-standard Express pattern. Health check endpoints bypass the interceptor.  
**Future**: Stable. No changes planned.

---

## Changelog

### 2026-06-09

- Initial creation from codebase analysis, existing ADRs, and audit report
- Documented 8 architectural decisions with evidence, tradeoffs, and future considerations
