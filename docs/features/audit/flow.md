# Audit Logging Flows

## 1. Event Dispatch Flow

1. **Trigger**: A business service (e.g., `note.service`) completes a mutation.
2. **Context Resolution**: The service calls `auditService.logEvent()`. The audit service uses AsyncLocalStorage (`als.js`) to automatically extract the `reqId` (trace ID) and `actorId` (the authenticated user making the request) without requiring them to be passed as explicit arguments.
3. **Sanitization**: The `metadata` payload passed to the event is recursively sanitized. Passwords, tokens, and authorization objects are redacted. Depth is truncated to 3 levels.
4. **Persistence**: The sanitized event is written to the `AuditLog` table using Prisma.

## 2. Transactional Audit Flow

1. **Trigger**: A complex mutation spanning multiple database calls is initiated (e.g., User Deletion).
2. **Transaction Start**: The service initiates a Prisma `$transaction`.
3. **Execution**: Business logic executes.
4. **Audit Injection**: The service calls `auditService.logEvent()` and passes the active Prisma transaction client (`tx`) as an optional parameter.
5. **Atomic Persistence**: The audit service uses the provided `tx` client instead of the global `prisma` client. The audit log is written as part of the transaction block.
6. **Commit/Rollback**: If the transaction succeeds, the business data and the audit log are committed together. If it fails, neither is committed.
