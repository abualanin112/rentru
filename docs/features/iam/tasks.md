# IAM Tasks & Backlog

## Completed

- `[x]` Implement Password hashing (bcrypt)
- `[x]` Implement JWT issuance (Access + Refresh tokens)
- `[x]` Implement Token rotation and reuse detection
- `[x]` Implement `action:resource:scope` RBAC authorization middleware
- `[x]` Hook-based cascading data deletion (Notes)

## In Progress

- `[-]` Migration from legacy `Role` enum to dynamic database-driven `UserRole` relations. (The Prisma schema currently retains the legacy enum marked as `@deprecated` for fallback).

## Planned

- `[ ]` **Soft Deletion**: Implement `deletedAt` for Users instead of hard deletions, resolving the cascading complexity and preserving data integrity for compliance.
- `[ ]` **Admin UI Role Management**: Create a suite of API routes (`/v1/roles`, `/v1/permissions`) to allow super admins to dynamically construct and assign roles through a UI, replacing the current system-seeded approach.
