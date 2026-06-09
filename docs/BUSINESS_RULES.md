# Business Rules

Confirmed business constraints and inferred assumptions derived from code, schema, and audit evidence.

---

## Confirmed Behavior

Rules verified from implementation.

### Users

- **Registration**: Users register with `name`, `email`, `password`. Email must be unique (DB unique constraint).
- **Password hashing**: bcrypt with configurable cost factor (currently 8 in code, target 12 per audit).
- **Email verification**: Optional flow — `isEmailVerified` defaults to `false`. Verification token generated on demand, confirms email atomically.
- **Email uniqueness**: Checked at service layer before creation. `isEmailTaken` rejects duplicates with 400 Bad Request.
- **User deletion**: Hard delete inside a transaction. Pre-deletion hooks execute first (note cleanup). Tokens cascade via FK. Audit log persists (no FK dependency).
- **Password never returned**: Prisma global `omit` config excludes `password` from all User queries. Explicit `includePassword: true` required for login verification.

### Authentication

- **Login**: Email + password → access token + refresh token pair.
- **Access tokens**: Short-lived JWT (default 30 minutes). Stateless — not stored in DB.
- **Refresh tokens**: Long-lived JWT (default 30 days). Hashed (SHA-256) and stored in DB. Belong to a `familyId`.
- **Token rotation**: On refresh, old token is blacklisted (not deleted), new token issued within same family.
- **Reuse detection**: If a blacklisted token is presented:
  - 2-second grace period (for frontend race conditions).
  - Beyond grace: entire token family revoked. Session terminated.
- **Logout**: Deletes the specific refresh token from DB. Returns 404 if token not found (note: audit recommends 204 always).
- **Password reset**: Token-based flow. Reset token generated, sent via email (placeholder URLs currently). Token verified atomically, password updated, all reset tokens for user deleted.

### Authorization (RBAC)

- **Permission format**: `action:resource:scope` (e.g., `update:notes:own`).
- **Scope rules**:
  - `:own` — actor owns the resource.
  - `:any` — actor can access any resource, regardless of ownership.
  - `:any` implicitly satisfies `:own`.
- **Wildcard**: `*:*:*` grants unrestricted access (super admin).
- **Escalation prevention**: An actor cannot assign a role whose `level` exceeds the actor's maximum role level.
- **Permission caching**: Resolved permissions cached per user for 5 minutes. Cache versioning enables global invalidation.
- **Permission resolution**: Route-level middleware checks required permissions (AND logic). Ownership resolution deferred to service layer (`assertScopedPermission`).

### Notes

- **Ownership**: Every note has an `ownerId` (FK to User). `onDelete: Restrict` at DB level — notes must be explicitly deleted before user deletion.
- **Fields**: `title` (max 200 chars, VARCHAR), `content` (TEXT), `archived` (boolean, default false), `tags` (string array, default empty).
- **CRUD access**: All note operations require authentication. Ownership-based authorization via `assertCanManageNote`.
- **Pagination**: Cursor-based for list queries (high performance for large datasets).
- **Full-text search**: PostgreSQL full-text search enabled via Prisma preview feature `fullTextSearchPostgres`.
- **Bulk deletion**: `deleteManyByOwnerId` triggered by user deletion hook. Runs within the user deletion transaction.
- **Archiving**: Notes can be archived (soft-archive via `archived` boolean). Archived notes are still queryable with a filter.

### Audit Logging

- **Mandatory for mutations**: All create, update, delete operations on Users and Notes are audited.
- **Auth events audited**: Login, logout, token refresh, token reuse detection, escalation attempts.
- **Decoupled storage**: AuditLog has no foreign keys. Uses soft references (`actorId`, `entityId`). Survives entity deletion.
- **Metadata sanitization**: Sensitive fields (password, token, authorization) redacted. Depth limited (3 levels), array size limited (50 items), string length limited (2000 chars).
- **Transactional**: Audit events participate in the same transaction as business operations — if the business op rolls back, the audit event is also rolled back.

---

## Inferred Assumptions

Behaviors inferred from code patterns but not explicitly documented as requirements.

### Single-Tenant System

- No tenant/organization model in schema.
- All users share the same permission namespace.
- RBAC roles are global, not scoped to tenants.

### API-Only Backend

- No server-side rendering or session cookies.
- Bearer token authentication model (localStorage/memory on client side).
- CORS configured for external frontend(s).

### No Soft Delete

- Users and notes are hard-deleted. Only the audit trail preserves history.
- This is a known gap — soft delete (`deletedAt` pattern) is a backlog item.

### Email Service is Optional

- SMTP config fields are optional in Zod schema.
- Email service logs a warning if transport verification fails but doesn't crash.
- Email URLs are placeholder values — not production-ready.

### Single-Node Worker Assumption

- Background workers (token cleanup) designed for single active node.
- Advisory locks provide distributed safety, but the `ENABLE_BACKGROUND_WORKERS` flag assumes manual worker node designation.

### Roles are System-Seeded

- The `isSystem` field on Role model suggests roles are seeded, not user-created.
- No admin UI or API for role management is visible (role CRUD is pending or internal-only).

---

## State Transitions

### User Lifecycle

```
Registered (isEmailVerified: false)
    → Email Verified (isEmailVerified: true)
    → [Optional] Roles Assigned
    → [Terminal] Deleted (hard delete, audit preserved)
```

### Token Lifecycle

```
Created (blacklisted: false)
    → [On rotation] Blacklisted (blacklisted: true)
    → [On reuse detection] Family Revoked (all family tokens deleted)
    → [On expiry] Cleaned up by cron worker
    → [On logout] Deleted
```

### Note Lifecycle

```
Created (archived: false)
    → Updated (title, content, tags)
    → Archived (archived: true)
    → Unarchived (archived: false)
    → [Terminal] Deleted (hard delete, audit preserved)
```

---

## Permission Restrictions

| Action             | Permission Required | Scope Logic                        |
| ------------------ | ------------------- | ---------------------------------- |
| Read own profile   | `read:users:own`    | Resolved via `assertCanReadUser`   |
| Read any user      | `read:users:any`    | Admin-level                        |
| Update own profile | `update:users:own`  | Resolved via `assertCanManageUser` |
| Update any user    | `update:users:any`  | Admin-level                        |
| Manage own notes   | `update:notes:own`  | Resolved via `assertCanManageNote` |
| Manage any notes   | `update:notes:any`  | Admin/moderator level              |
| Assign roles       | `assign:roles:any`  | Requires role level check          |

---

## Changelog

### 2026-06-09

- Initial creation from codebase analysis
- Documented confirmed user, auth, RBAC, notes, and audit business rules
- Documented inferred assumptions (single-tenant, API-only, no soft delete)
- Mapped state transitions and permission matrix
