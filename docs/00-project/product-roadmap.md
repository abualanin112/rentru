# Product Roadmap

This roadmap outlines the discovered features and their logical progression phases based on the current implementation, schema analysis, and architectural decisions.

## Phase 1: Security & Identity Foundation (Completed)

This phase established the core security boundaries, user management, and access control mechanisms.

### Existing Features

- **Authentication**: Login, token issuance, token rotation, reuse detection, logout, password reset via email.
- **Users**: Registration, profile management, email verification.
- **RBAC**: Dynamic database-driven roles and permissions (`action:resource:scope`), permission resolution, escalation prevention.
- **Audit Logging**: Immutable event logging decoupled from business entities (`AuditLog` without FK constraints).
- **Background Workers**: Cron-based token cleanup using advisory locks.

## Phase 2: Core Domain (Completed)

This phase focused on the primary business value of the application.

### Existing Features

- **Notes Management**: Create, read, update, delete (CRUD).
- **Note Organization**: Tagging and archiving capabilities.
- **Note Discovery**: Cursor-based pagination and PostgreSQL full-text search.
- **Data Cascading**: Hook-based deletion cascading (User deletion triggers Note deletion).

## Phase 3: Enhanced Management & Operations (Planned/Missing)

This phase focuses on improving administrative workflows, data retention policies, and multi-tenant capabilities (if required).

### Planned Features (High Confidence)

- **Soft Deletion**: Implementing a `deletedAt` pattern to prevent hard deletion of users and notes (noted as deferred/backlog).
- **Role & Permission Management UI/API**: Currently, roles appear to be system-seeded (`isSystem: true`). An admin API for dynamic role creation and permission assignment is implicitly planned.

### Missing / Potential Features (Low Confidence)

- **Multi-Tenancy / Organizations**: The current schema is strictly single-tenant. If B2B expansion is desired, an `Organization` or `Tenant` domain will be needed.
- **Note Sharing / Collaboration**: Currently, notes are strictly tied to an `ownerId`. Enabling shared access between users would require a junction table (e.g., `NoteCollaborator`).
