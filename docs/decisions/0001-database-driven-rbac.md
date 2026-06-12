# ADR 0001: Database-Driven Role-Based Access Control (RBAC)

## Status

Accepted & Implemented

## Context

The application initially relied on a hardcoded `LegacyRole` enum (`user`, `moderator`, `admin`) defined at the database schema level. As the application grew, the need for more granular, flexible permissions became apparent. Hardcoded enums required database migrations and application deployments to introduce new privilege tiers.

## Decision

We decided to implement a dynamic, database-driven RBAC system.

- **Permission Format**: We adopted an `action:resource:scope` naming convention (e.g., `update:notes:own`).
- **Junction Tables**: We introduced `UserRole` and `RolePermission` tables to allow many-to-many mappings.
- **Escalation Prevention**: We introduced a `level` integer on the `Role` model to establish a strict hierarchy, ensuring no user can grant a role with a higher level than their own maximum role.

## Consequences

- **Positive**: We can now define new granular permissions and custom roles without code changes or database migrations. The system supports complex authorization logic natively.
- **Negative**: Resolving a user's permissions now requires joining 4 tables (`User`, `UserRole`, `Role`, `RolePermission`).
- **Mitigation**: We rely on PostgreSQL composite indexes and a Direct-DB permission resolution strategy. Permissions are fully resolved via direct database queries on every request. Database query performance is monitored via `pg_stat_statements` and Prisma's slow query telemetry.
