# PROJECT OVERVIEW

The repository implements a **Pragmatic Modular Monolith** constructed on Node.js (ESM), Express.js, and PostgreSQL via Prisma ORM. The architecture is engineered around strict domain boundaries, specifically decoupling Identity & Access Management (IAM), Audit logging, and core Product workflows (currently "Notes").

**Backend Philosophy**: The codebase strictly adheres to flat directory structures, named exports only, centralized routing, and strict module boundaries enforced via barrel exports (`index.js`). The system avoids cyclic dependencies by utilizing a Composition Root (`router.js`) to orchestrate cross-domain events (e.g., cascading deletions).

**Business Direction / Proptech Context**:
While the prompt implies a complex ERP/CRM/Operations platform for short-term rental and proptech workflows, the **current codebase represents the foundational platform layer**. It contains production-ready Auth (IAM), immutable Audit Logging, and a generalized Notes/Entity system. The multitenant-ready RBAC schema suggests it is designed as the core skeleton upon which the proptech operational domains (bookings, reservations, leases) will be built.

---

# FILE DOCUMENTATION

---

# `src/index.js`

## PURPOSE

This file serves as the definitive process entrypoint and bootstrap orchestrator. It manages the runtime lifecycle from process launch to graceful termination.

## ROLE IN SYSTEM

It sits at the absolute top of the architectural hierarchy. It initializes telemetry, asserts database connectivity, mounts the HTTP server, spawns background workers, and registers OS-level signal handlers (`SIGINT`, `SIGTERM`).

## BUSINESS LOGIC

- **Event Loop Telemetry**: Continuously monitors the Node.js event loop for lag exceeding threshold values, logging warnings if the single thread blocks.
- **Dependency Assertion**: Enforces a strict `SELECT 1` database ping before opening the HTTP port, guaranteeing the app does not accept traffic while disconnected from the data tier.
- **Graceful Shutdown**: Orchestrates a reverse-order shutdown: stops accepting HTTP traffic -> stops cron jobs -> awaits active workers (max 5s) -> disconnects Prisma -> exits.

## IMPORTANT CODE EXAMPLES

```javascript
const eventLoopMonitor = monitorEventLoopDelay({ resolution: 10 });
eventLoopMonitor.enable();
setInterval(() => {
  const lagMs = eventLoopMonitor.max / 1e6; // Convert ns to ms
  if (lagMs > config.telemetry.eventLoopLagThresholdMs) {
    logger.warn({ event: 'system.event_loop.lagged', lagMs: Math.round(lagMs) }, 'Event loop lag exceeded threshold');
  }
  eventLoopMonitor.reset();
}, 5000).unref();
```

_Explanation_: This is enterprise-grade telemetry logic that detects synchronous blocking code, critical for Node.js backend stability under high load.

## DEPENDENCIES

- `monitorEventLoopDelay` (native `perf_hooks`)
- `app.js` (Express construction)
- `prisma.js` (Database client)
- `logger.js` (Pino)

## RELATED FILES

- `src/app.js` → Constructs the Express pipeline that `index.js` serves.
- `src/infrastructure/workers/token-cleanup.worker.js` → Started conditionally by `index.js`.

## ARCHITECTURAL PATTERNS

- **Composition Root**: Orchestrates the startup sequence.
- **Fail-Fast**: Exits process immediately if the database is unreachable on boot.

## RISKS / TECHNICAL DEBT

- **Monolithic Cron Execution**: Background workers are started directly in the web process (`config.enableBackgroundWorkers`). In a multi-node cluster, this risks race conditions if multiple nodes execute the cron simultaneously.

## IMPROVEMENT OPPORTUNITIES

- Extract background workers into a dedicated worker process or integrate a distributed queue (e.g., BullMQ) to ensure exactly-once execution across clusters.

---

# `src/modules/router.js`

## PURPOSE

Acts as the central network router and cross-domain event wireframe.

## ROLE IN SYSTEM

It prevents cross-module imports within the feature modules by centralizing all route registrations and inter-module event hooks into a single file.

## BUSINESS LOGIC

- Mounts IAM and Notes routes onto the Express `v1Router`.
- **Domain Decoupling**: Dynamically registers a deletion hook: when a User is deleted in the IAM module, the router triggers `deleteManyByOwnerId` in the Notes module.

## IMPORTANT CODE EXAMPLES

```javascript
// INTER-MODULE ORCHESTRATION: Wire deletion cascading
if (typeof userService.registerUserDeletionHook === 'function' && typeof deleteManyByOwnerId === 'function') {
  userService.registerUserDeletionHook((userId, tx) => deleteManyByOwnerId(userId, tx));
}
```

_Explanation_: This prevents the `iam` module from directly importing the `notes` module. Instead, the composition root injects the dependency, maintaining strict domain isolation.

## DEPENDENCIES

- `iam/index.js`
- `notes/index.js`
- `express.Router`

## RELATED FILES

- All `*.route.js` files across modules.

## ARCHITECTURAL PATTERNS

- **Composition Root / Event Bus Adapter**: Orchestrates domain dependencies without tight coupling.

## RISKS / TECHNICAL DEBT

- As the ERP scales to handle Bookings, Payments, and Leases, this single hook system will become a massive bottleneck of callbacks.

## IMPROVEMENT OPPORTUNITIES

- Transition from direct callback registration to an Event Emitter or distributed Event Bus pattern (e.g., emitting a generic `USER_DELETED` event that all modules subscribe to independently).

---

# `src/modules/iam/services/auth.service.js`

## PURPOSE

Owns the core authentication workflows: login, logout, token refresh, and credential recovery.

## ROLE IN SYSTEM

It sits in the Service Layer of the IAM Bounded Context. Controllers delegate business execution to this file. It orchestrates Repositories, Token generation, and Audit logging.

## BUSINESS LOGIC

- **Login**: Validates credentials via bcrypt, logs the attempt, and generates token families.
- **Refresh Token Rotation**: Implements strict token rotation. If a blacklisted/used token is presented during refresh, it assumes the session is compromised and immediately revokes the entire `familyId` (all devices).
- **Grace Periods**: Implements a 2-second grace period for token reuse to handle frontend React/SPA race conditions during simultaneous network requests.

## IMPORTANT CODE EXAMPLES

```javascript
      if (refreshTokenDoc.blacklisted) {
        // Evaluate strict grace period for frontend race conditions (2 seconds maximum)
        if (Date.now() - refreshTokenDoc.updatedAt.getTime() < 2000) {
          throw new ApiError(httpStatus.UNAUTHORIZED, 'Concurrent refresh request detected');
        }

        // REUSE DETECTED! Threat protocol.
        await deleteManyTokens({ familyId: refreshTokenDoc.familyId }, tx);
```

_Explanation_: Advanced security protocol demonstrating Token Rotation with reuse detection. The 2-second grace period prevents false-positive security lockouts caused by modern UI frameworks firing parallel requests.

## DEPENDENCIES

- `user.repository.js`
- `token.repository.js`
- `infrastructure/prisma.js` (Transactions)
- `shared/Password.js` (bcrypt wrappers)

## RELATED FILES

- `auth.controller.js` → Calls this service.
- `passport.js` → Consumes the JWTs generated by workflows in this service.

## ARCHITECTURAL PATTERNS

- **Unit of Work**: Utilizes `runInTransaction` to ensure token rotation and user updates are atomic.
- **Service Layer**: Pure business logic agnostic of Express `req/res`.

## RISKS / TECHNICAL DEBT

- Tight coupling to Prisma transactions. While isolated to `runInTransaction`, deep transaction nesting could cause deadlocks under high concurrency.

## IMPROVEMENT OPPORTUNITIES

- Move token storage to Redis for high-performance O(1) revocation instead of relying entirely on PostgreSQL for ephemeral session data.

---

# `src/modules/iam/repositories/user.repository.js`

## PURPOSE

Abstracts all database access related to the `User` entity.

## ROLE IN SYSTEM

Forms the Data Access Layer for IAM. Services interact with this file rather than calling Prisma directly.

## BUSINESS LOGIC

- Safely excludes the `password` field from standard `findUnique` queries unless explicitly requested via `{ includePassword: true }`.
- Implements dynamic cursor/offset pagination bridging.

## IMPORTANT CODE EXAMPLES

```javascript
const findByEmail = async (email, { includePassword = false } = {}, tx = prisma) => {
  return tx.user.findUnique({
    where: { email },
    omit: { password: !includePassword },
  });
};
```

_Explanation_: Data protection at the repository boundary. Prevents accidental leakage of password hashes into DTOs or logs by enforcing an opt-in requirement.

## DEPENDENCIES

- `infrastructure/prisma.js`
- `shared/Paginate.js`

## RELATED FILES

- `user.service.js` → primary consumer.

## ARCHITECTURAL PATTERNS

- **Repository Pattern**: Wraps the ORM to standardize data access shapes.
- **Transaction Injection**: Accepts `tx` as an optional parameter to participate in upstream transactions.

## RISKS / TECHNICAL DEBT

- `ALLOWED_POPULATIONS = ['notes']` hardcoded in `paginateUsers`. IAM repository inherently knows about the `notes` domain via Prisma relations. This is a slight violation of strict domain boundaries at the database level.

## IMPROVEMENT OPPORTUNITIES

- Strictly isolate domain schemas if migrating to microservices, removing cross-domain `@relation` tags in Prisma.

---

# `src/modules/audit/audit.service.js`

## PURPOSE

Provides an immutable, secure, and decoupled logging mechanism for critical business events.

## ROLE IN SYSTEM

A cross-cutting concern utilized by almost all other services in the system (Auth, Notes) to record state transitions.

## BUSINESS LOGIC

- **Deep Sanitization**: Recursively sanitizes JSON metadata before persistence.
- **Threat Mitigation**: Hard-truncates strings > 2000 chars, limits arrays to 50 items, and masks specific keys (`password`, `token`) to prevent log-injection or data leakage.
- **Correlation**: Automatically extracts `reqId` and `userId` from `AsyncLocalStorage` without requiring them to be passed manually through function arguments.

## IMPORTANT CODE EXAMPLES

```javascript
if (FORBIDDEN_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('token')) {
  return { ...sanitized, [key]: '[REDACTED]' };
}
```

_Explanation_: Critical security enforcement protecting the audit log from inadvertently persisting PII or credential data embedded in dynamic metadata payloads.

## DEPENDENCIES

- `infrastructure/als.js` (AsyncLocalStorage context)
- `audit.repository.js`

## RELATED FILES

- `schema.prisma` (`AuditLog` model).

## ARCHITECTURAL PATTERNS

- **Thread-Local Storage**: Uses ALS to implicitly pass request context down to the persistence layer.
- **Decorator/Interceptor**: Acts as a safe wrapper around database writes.

## RISKS / TECHNICAL DEBT

- Synchronous recursive sanitization could block the event loop if a massive, deeply nested object is accidentally passed into the `metadata` payload.

## IMPROVEMENT OPPORTUNITIES

- Offload audit persistence to a non-blocking message queue (e.g., Kafka or RabbitMQ) rather than writing to the primary PostgreSQL database synchronously during request lifecycles.

---

# `prisma/schema.prisma`

## PURPOSE

Defines the relational database architecture, constraints, and index strategy for the entire monolith.

## ROLE IN SYSTEM

The definitive source of truth for entity structures and database constraints.

## BUSINESS LOGIC

- **Dynamic RBAC**: Replaces hardcoded enums with `Role` and `Permission` tables, utilizing a `level` field to prevent privilege escalation.
- **Orphan Prevention**: The `Note` to `User` relationship enforces `onDelete: Restrict`. The database physically rejects user deletion if notes exist, forcing the application code to handle cascades gracefully.

## IMPORTANT CODE EXAMPLES

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?  @map("actor_id") // Soft reference to User.id
  entityId   String   @map("entity_id") // Soft reference to target entity
```

_Explanation_: The intentional omission of `@relation` foreign keys guarantees that the Audit trail survives the deletion of the original user or entity, fulfilling enterprise compliance requirements.

## DEPENDENCIES

- `postgresql` provider.

## ARCHITECTURAL PATTERNS

- **Relational Normalization**.
- **Junction Tables**: `UserRole`, `RolePermission` for flexible many-to-many RBAC modeling.

## RISKS / TECHNICAL DEBT

- Soft-references in `AuditLog` mean standard Prisma nested queries cannot be used to fetch the Actor's current details.

---

# CROSS-MODULE ANALYSIS

## SYSTEM WORKFLOWS

**The Session Rotation Lifecycle**:

1. Client logs in via `auth.controller.js`.
2. `auth.service.js` generates a short-lived JWT and a long-lived Refresh Token grouped by `familyId`.
3. Client requests a protected Note resource. `auth.middleware.js` uses `passport.js` to validate the JWT.
4. JWT expires. Client calls `/v1/auth/refresh`.
5. `auth.service.js` initiates a Prisma Transaction, verifies the refresh token is not blacklisted, blacklists it, and issues a new pair under the same `familyId`. If reuse is detected, the entire `familyId` is wiped.

**The Domain Teardown Workflow**:

1. Admin triggers User deletion.
2. `iam/services/user.service.js` begins a transaction.
3. It triggers the event hook registered by `router.js`.
4. `notes/note.service.js` (`deleteManyByOwnerId`) executes within the same transaction.
5. `User` is deleted. Transaction commits.

## MODULE RELATIONSHIPS

- **Coupling Strategy**: Modules are highly cohesive internally but loosely coupled externally. Dependencies point strictly inwards (Services depend on Repositories, Controllers depend on Services).
- **Communication**: Cross-domain communication is currently handled synchronously via Composition Root hooks and shared Prisma transactions.

## BACKEND ARCHITECTURE ANALYSIS

- **Architecture Style**: Strict Modular Monolith.
- **Strengths**: Incredibly easy to test, reason about, and deploy. The flat structure and strict barrel exports prevent spaghetti code.
- **Weaknesses**: Synchronous inter-module communication means slow operations in one domain will impact the API response time of the caller domain.
- **Enterprise Readiness**: Very high. The use of ALS for request tracing, Pino for structured logging, Zod for boundary guarantees, and Prisma transactions for ACID compliance sets a strong foundation.

## INFRASTRUCTURE ANALYSIS

- **PostgreSQL**: Central state store.
- **Node.js/Express**: Stateless execution tier.
- **Lack of Redis**: A notable omission for an ERP platform. Rate limiting, caching, and token storage currently rely on memory or PostgreSQL, which will bottleneck horizontal scaling.

## AUTHENTICATION & SECURITY ANALYSIS

- **Passport.js**: Robust, standard implementation.
- **RBAC**: The schema is future-proofed with dynamic Roles and Permissions, though code implementation seems partially transitional (`LegacyRole` still exists).
- **Vulnerabilities**: If `node-cron` token cleanup fails across cluster nodes, the database will accumulate massive amounts of expired refresh tokens.

## DATABASE ANALYSIS

- **Tenancy**: Currently Single-Tenant. To pivot into a Proptech ERP (e.g., managing multiple properties or agencies), a `TenantId` column and Row-Level Security (RLS) policies must be introduced to all core entities.

---

# REQUIRED QUESTIONS

1. **Missing Domain Logic**: The prompt specifies this is a "complex ERP / CRM / Operations platform for short-term rental and proptech workflows." However, the codebase only contains `iam`, `audit`, and a generalized `notes` domain. **Where are the property, booking, reservation, and financial domain modules?** Are they housed in a separate repository or pending implementation?
2. **Event Architecture Pivot**: The system uses synchronous Composition Root callbacks (`registerUserDeletionHook`). Given the planned complexity (ERP/CRM), is there a roadmap to integrate a message broker (RabbitMQ/Kafka) to decouple these domain cascades asynchronously?
3. **RBAC Migration State**: `schema.prisma` retains a `@deprecated LegacyRole` enum, but implements a dynamic `Role` table. Is the system currently enforcing security via the legacy enum or the dynamic junction tables? What is the cutover strategy?
4. **Rate Limiting Scalability**: Rate limiting is handled in-memory. As the platform scales to handle heavy Proptech integrations (e.g., syncing listings with Airbnb/Booking.com), when will Redis be introduced to centralize rate limit tracking across the Kubernetes cluster?
