# File Documentation

File:
`src/modules/audit/audit.service.js`

Domain:
Audit & Telemetry

Layer:
Domain Service Layer

Runtime Role:
The central nervous system for recording state changes across the entire application. It extracts context automatically from the runtime, recursively sanitizes metadata to prevent secrets from leaking into the database, and persists the log atomically.

Dependencies:

- `src/infrastructure/als.js` (AsyncLocalStorage)
- `src/infrastructure/logger.js` (Pino)
- `audit.repository.js`

---

# 2. PURPOSE

In Enterprise ERPs, "Who did what, and when?" is often the most important question during a security breach or compliance audit.

This file provides a unified `logEvent` API that other modules (`iam`, `notes`) call when mutating data. It automatically figures out _who_ triggered the action by inspecting the AsyncLocalStorage (ALS), meaning developers don't have to manually pass the `req.user.id` deep into every service layer function.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Exposes `logEvent` and `sanitizeMetadata`.
- Retrieves `actorId` (the user who made the request) and `reqId` (the trace ID) transparently from `asyncLocalStorage`.
- Runs incoming `metadata` through a recursive sanitization engine.
- Formats the data into a canonical Taxonomy (`event`, `entityType`, `entityId`, `action`).
- Passes the sanitized payload and the active transaction (`tx`) to the repository.
- Logs a system error and throws if the database write fails, ensuring the parent transaction rolls back.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `als.js`

Used for:

- Context extraction without prop-drilling.
  Coupling Level: HIGH (Tightly coupled to the specific ALS implementation defined in infrastructure).

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `logEvent`

The primary API used by every other module in the system.

### `sanitizeMetadata`

Exported primarily so it can be unit-tested in isolation, given its complexity.

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `logEvent`

1. Called by a service (e.g., `note.service.js`) inside a transaction: `await logEvent({ event: 'notes.created', ... }, tx)`.
2. Fetches `store` from ALS. Extracts `actorId` and `reqId`.
3. If `metadata` is provided, passes it to `sanitizeMetadata`.
4. `sanitizeMetadata` recursively walks the object:
   - If depth > 3, returns `[MAX_DEPTH_EXCEEDED]`.
   - If a string > 2000 chars, truncates it.
   - If an array > 50 items, slices it and appends a `[TRUNCATED]` tag.
   - If an object key matches the `FORBIDDEN_KEYS` (e.g., "password", "token"), replaces the value with `[REDACTED]`.
5. Builds the `canonicalPayload`.
6. Executes `audit.repository.js -> create(canonicalPayload, tx)`.
7. If Prisma throws an error, the `catch` block logs a critical `system.audit.failure` event to Pino, and re-throws the error so the parent transaction rolls back.

---

# 7. IMPORTANT CODE EXAMPLES

## Automatic Context Extraction

```javascript
const store = asyncLocalStorage.getStore();
const actorId = store?.userId || null;
const reqId = store?.reqId || null;
```

**Why this matters:**
Without ALS, every single repository or service function would need to accept `actorId` and `reqId` as arguments. By pulling it from the Node.js event loop context, the code remains perfectly clean, yet every single database mutation is automatically attributed to the correct user and trace ID.

## Recursive Sanitization Engine

```javascript
  if (Array.isArray(obj)) {
    if (obj.length > MAX_ARRAY_SIZE) {
      const truncated = obj.slice(0, MAX_ARRAY_SIZE).map((item) => sanitizeMetadata(item, depth + 1, maxDepth));
      truncated.push(`[TRUNCATED_${obj.length - MAX_ARRAY_SIZE}_ITEMS]`);
      return truncated;
    }
    // ...
```

**Why this matters:**
Developers often log full `req.body` or API responses into the `metadata` field. If a user uploads a 5MB base64 image array, the audit log table would explode in size. By strictly enforcing depth limits and array sizes, the database is protected from out-of-memory crashes. By enforcing a deny-list of keys, it prevents a developer from accidentally logging a user's plaintext password during a registration event.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/audit/index.js`

Responsibility: Module Barrel.
Relationship: Re-exports these functions to act as the public API for the Audit domain.

---

# 9. DATABASE INTERACTIONS

None directly. Defers to `audit.repository.js`.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
This file implements strict Data Loss Prevention (DLP) via `sanitizeMetadata`.

---

# 11. VALIDATION FLOW

Does not use Zod, but relies on the `canonicalPayload` shape to match the Prisma schema.

---

# 12. LOGGING & OBSERVABILITY

Logs critical failures to standard out using Pino if the database is unreachable.

---

# 13. ARCHITECTURAL RISKS

### Deny-List Evasion

The `sanitizeMetadata` function uses a deny-list (`FORBIDDEN_KEYS.has(lowerKey)`). If a developer introduces a new sensitive field named `secretKey` or `creditCard`, this function will _not_ redact it, and it will be leaked into the database. An allow-list approach is much safer but harder to implement for generic metadata.

---

# 14. EXTENSION POINTS

- **Data Warehousing**: Currently, audit logs are just written to Postgres. In a massive ERP, this table will eventually become hundreds of gigabytes. This service could be extended to publish these events to an AWS SQS queue or Kafka topic for ingestion into Snowflake/BigQuery instead of (or in addition to) Postgres.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Compliance & Forensics: Provides the raw data required for SOC2 compliance, user activity auditing, and post-breach analysis.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
Deny-list data scrubbing requires constant vigilance as the application schema evolves.
