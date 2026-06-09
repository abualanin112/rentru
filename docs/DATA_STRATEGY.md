# Data Strategy

Database design patterns, data lifecycle rules, and schema evolution strategy.

To be documented as the project evolves.

---

## Current Database

- **Engine**: PostgreSQL 16
- **ORM**: Prisma 6.x with `@prisma/client`
- **Preview Features**: `fullTextSearchPostgres`
- **ID Strategy**: CUID (`@default(cuid())`)
- **Timestamps**: `createdAt` / `updatedAt` with `@map` to `snake_case`

## Schema Summary

| Model            | Table              | Purpose                         |
| ---------------- | ------------------ | ------------------------------- |
| `User`           | `users`            | User accounts                   |
| `Note`           | `notes`            | User-owned notes                |
| `Token`          | `tokens`           | JWT refresh/reset/verify tokens |
| `AuditLog`       | `audit_logs`       | Decoupled event audit trail     |
| `Role`           | `rbac_roles`       | RBAC role definitions           |
| `Permission`     | `permissions`      | Granular permissions            |
| `RolePermission` | `role_permissions` | Role ↔ Permission junction      |
| `UserRole`       | `user_roles`       | User ↔ Role junction            |

## Deletion Strategy

- **Users**: Hard delete. Notes deleted first via pre-deletion hook. Tokens cascade via FK. Audit logs preserved (no FK).
- **Notes**: Hard delete. `onDelete: Restrict` on User FK prevents orphaned cascade.
- **Tokens**: Cascade on user deletion. Cron cleanup for expired/blacklisted tokens.
- **Audit logs**: Never deleted. No FK constraints.

## Known Schema Debt

- `LegacyRole` enum retained during RBAC migration. To be removed once all users are on `UserRole` system.

---

## Changelog

### 2026-06-09

- Initial creation with database overview, schema summary, and deletion strategy
