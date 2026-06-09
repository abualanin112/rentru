# Database Architecture Wiki

## Data Modeling Strategy

The data persistence layer is governed by Prisma ORM and backed by PostgreSQL. The schema (`schema.prisma`) represents a robust, normalized relational model designed for future scaling into a multi-tenant ERP system.

## Schema Intelligence

### 1. Identity & RBAC Models

The IAM domain implements a dynamic, junction-based RBAC system:

- `Role`: The core authority grouping. Features a `level` field (integer) specifically to enforce privilege escalation hierarchies.
- `Permission`: Granular capabilities defined by `action:resource:scope` strings.
- `UserRole` & `RolePermission`: Many-to-many junction tables to allow users to hold multiple roles, and roles to aggregate multiple permissions.
- **Migration Path**: `LegacyRole` is retained on the `User` model, explicitly marked as deprecated, indicating a transition to the dynamic `Role` system.

### 2. Auditing Strategy

- The `AuditLog` table stores generic JSON payloads and system events.
- **Architectural Decision**: It deliberately avoids explicit Foreign Keys (`@relation`) to `actorId` or `entityId`. It uses soft references instead. This guarantees that audit logs remain immutable and intact even if a parent user or note is hard-deleted from the database.
- **Indexing**: Heavily indexed on `actorId`, `entityType/entityId`, and `createdAt` to support complex pagination and timeline reconstruction.

### 3. Business Models (Notes)

- `Note`: Simple entity with core fields (`title`, `content`, `tags`, `archived`).
- **Data Protection**: The `ownerId` relation strictly uses `onDelete: Restrict`. This forces the application layer (Express services) to manually orchestrated cascading deletions (e.g. deleting all notes before deleting a user). This is a critical safety measure to prevent accidental massive data loss from a single deleted User record.

## Transactional Boundaries

Prisma is utilized for ACID guarantees. Although not deeply visible in the schema alone, cross-domain interactions (like user deletion) must operate within a `$transaction` block. This ensures that deleting a user and their corresponding notes succeeds or fails as an atomic unit.

## Indexing & Performance

Indexes are optimized for expected read patterns:

- Timestamp indices (`createdAt`) for temporal sorting (Users, AuditLogs).
- Composite indices (`ownerId`, `archived`) to optimize frequent scoped list queries in the Notes domain.
- `familyId` index on `Tokens` to enable rapid O(1) invalidation of entire user sessions.
