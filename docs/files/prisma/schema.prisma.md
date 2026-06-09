# File Documentation

File:
`prisma/schema.prisma`

Domain:
Database Architecture

Layer:
Infrastructure / Database Schema

Runtime Role:
The definitive source of truth for the application's database structure. Defines tables, columns, indexes, foreign keys, cascading deletion rules, and relationships used by the Prisma Client.

Dependencies:

- `postgresql`

---

# 2. PURPOSE

This file establishes the foundation of the Modular Monolith's data layer.

It explicitly defines the RBAC boundaries (Roles, Permissions), core domain models (Users, Notes), ephemeral session models (Tokens), and the immutable Audit Log. It heavily utilizes PostgreSQL-specific optimizations (like `db.VarChar`) and complex indexing to support the high-performance queries written in the Repositories.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Compiles into the TypeScript/JavaScript Prisma Client, generating the `prisma.note`, `prisma.user`, etc. delegates.
- Generates database migrations (`.sql` files) when modified.
- Enforces referential integrity (e.g., `onDelete: Cascade` vs `onDelete: Restrict`).
- Maps camelCase application properties (`ownerId`) to snake_case database columns (`owner_id`) via `@map`.

---

# 4. IMPORT ANALYSIS

This is a Prisma DSL file, not JavaScript.

---

# 5. EXPORT ANALYSIS

N/A.

---

# 6. INTERNAL EXECUTION FLOW

N/A. This is a declarative schema.

---

# 7. IMPORTANT CODE EXAMPLES

## Foreign Key Deletion Guards

```prisma
model Note {
  ...
  // Relation — core business data, prevent accidental cascade
  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Restrict)
  ownerId String @map("owner_id")
}
```

**Why this matters:**
This is a critical architectural decision. In many fast-moving startups, everything defaults to `onDelete: Cascade`. If an admin accidentally deletes a User, all of that user's Notes are instantly and irrevocably destroyed. By setting this to `Restrict`, the database physically blocks the User deletion. The backend is forced to manually delete the notes _first_ (which is handled by the explicit `deleteManyByOwnerId` hooks in `user.service.js`). This makes destruction a deliberate, multi-step process rather than an accidental cascade.

Conversely, the `Token` model uses `Cascade` because tokens are ephemeral session data with no business value; if a user is deleted, their tokens should vanish instantly.

## Audit Log Separation

```prisma
model AuditLog {
  ...
  actorId    String?  @map("actor_id") // Soft reference to User.id
  entityId   String   @map("entity_id") // Soft reference to target entity

  // Explicitly avoiding @relation foreign keys. This is an intentional architectural
  // decision to guarantee audit logs survive the deletion or archival of parent entities.
```

**Why this matters:**
If `actorId` was a formal foreign key linked to the `User` table, deleting a user would either fail (if `Restrict`) or delete the audit logs (if `Cascade`). An audit log must be immutable. By using a "Soft Reference" (just storing the string ID without a foreign key constraint), the system guarantees that even if a User is deleted, the record of _what they did_ remains permanently in the system.

## Query Pattern Indexing

```prisma
  // Indexes for query patterns:
  // - All notes queries filter by owner
  // - Archived filter is a common secondary filter
  @@index([ownerId])
  @@index([ownerId, archived])
  @@index([ownerId, archived, createdAt])
```

**Why this matters:**
PostgreSQL processes queries left-to-right through composite indexes. Because the `note.controller.js` hardcodes `ownerId` into every single query, every index must start with `ownerId`. These composite indexes specifically support the `?archived=true&sortBy=createdAt` pagination queries executed by the frontend.

---

# 8. CROSS-FILE RELATIONSHIPS

### All Repositories

Responsibility: Data Access.
Relationship: Every repository is intimately tied to the exact schema defined here.

---

# 9. DATABASE INTERACTIONS

This _is_ the database definition.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Defines the `Role`, `Permission`, and `RolePermission` tables that power the entire RBAC engine.

---

# 11. VALIDATION FLOW

Enforces strict database-level validation (e.g., `@unique`, `@db.VarChar(100)`).

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Full Text Search Migration

The schema explicitly lists `previewFeatures = ["fullTextSearchPostgres"]`. However, as noted in the `note.repository.js` documentation, the application currently uses `contains: search, mode: 'insensitive'` which generates an `ILIKE` query, not a true Full Text Search query. The `previewFeature` is enabled, but not actually being utilized by the Prisma Client in the repositories.

---

# 14. EXTENSION POINTS

- **Multi-Tenancy**: If the application pivots from B2C to B2B, a `Workspace` or `Tenant` model will need to be added, and almost every existing model (Users, Notes, Roles) will need a `tenantId` foreign key and composite `@unique` constraints.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Structural Integrity: The unbreakable foundation of the application's data.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
HIGH (Coupled to PostgreSQL).

Scalability:
HIGH (Exceptional use of indexes and soft references).

Primary Concern:
The mismatch between the enabled `fullTextSearchPostgres` feature and the actual repository implementation.
