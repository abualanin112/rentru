# File Documentation

File:
`src/modules/notes/note.repository.js`

Domain:
Notes / Core Business Logic

Layer:
Data Access / Repository Layer

Runtime Role:
Abstracts Prisma database operations for the `Note` entity, implementing advanced search filtering and cursor-based pagination.

Dependencies:

- `src/infrastructure/prisma.js`
- `src/shared/PaginateCursor.js`

---

# 2. PURPOSE

This file isolates the Notes domain from the underlying ORM.

It provides standard data access methods while enforcing critical data boundaries: translating HTTP search parameters into safe SQL queries, explicitly mapping object hierarchies on creation, and aggressively scrubbing nested relational data (like the User object) to prevent credential leaks.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Standard `create`, `findById`, `updateById`, `deleteById` operations utilizing the `tx = prisma` pattern.
- Bulk deletion (`deleteManyByOwnerId`) for IAM lifecycle hooks.
- Implements `buildWhereClause` to safely translate a `search` string into a Prisma `OR` query against the `title` and `content` fields.
- Connects the Prisma `note` model to the high-performance `PaginateCursor.js` utility.
- Enforces a strict `cleanNoteIncludes` whitelist whenever the `owner` relation is requested.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `paginateCursor`

Used for:

- Executing high-performance, stateless pagination using CUID cursors instead of standard integer offsets.
  Coupling Level: HIGH.

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `create`, `findById`, `updateById`, `deleteById`, `deleteManyByOwnerId`, `paginateNotes`

Called by:

- `src/modules/notes/note.service.js`

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `paginateNotes`

1. Receives the `filter` object (e.g., `{ ownerId: 'abc', search: 'meeting' }`).
2. Calls `buildWhereClause(filter)`.
   - Extracts `search`.
   - Constructs a Prisma `OR` array: `{ OR: [{ title: { contains: 'meeting' } }, { content: { contains: 'meeting' } }] }`.
3. Validates and parses the `limit` (default 10).
4. Extracts the `cursor`.
5. **Security Check**: Looks at `options.populate`. If the caller requested `owner`, it replaces the dynamic `include` directive with the hardcoded `cleanNoteIncludes` whitelist.
6. Calls `paginateCursor` with the assembled query parameters.

---

# 7. IMPORTANT CODE EXAMPLES

## Strict Relational Whitelist

```javascript
/**
 * Strict, non-bypassable nested relational whitelist
 * to prevent overfetching or database metadata/password leaks.
 */
const cleanNoteIncludes = {
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
};
```

**Why this matters:**
If a frontend developer requests `/notes?populate=owner`, the `paginateCursor` utility would natively execute `include: { owner: true }`. This would pull the entire User record. Even though `prisma.js` omits the password globally, it would still pull `createdAt`, `updatedAt`, `isEmailVerified`, and potentially other sensitive internal fields attached to the User. By hardcoding this whitelist in the repository, it creates a final, impenetrable Data Loss Prevention (DLP) layer for nested relations.

## Dynamic Search Construction

```javascript
if (search) {
  where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { content: { contains: search, mode: 'insensitive' } }];
}
```

**Why this matters:**
This allows the API to support a single `?search=xyz` query parameter that spans multiple columns. Setting `mode: 'insensitive'` instructs Postgres to use `ILIKE` instead of `LIKE`, dramatically improving the user experience for full-text search.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/shared/PaginateCursor.js`

Responsibility: Abstract cursor pagination logic.
Relationship: The repository acts as the bridge between the domain-specific Model (`note`) and the generic cursor algorithm.

---

# 9. DATABASE INTERACTIONS

Touched Models:

- `Note`

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Enforces relational data hiding (`cleanNoteIncludes`).

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### ILIKE Performance

The `contains: search, mode: 'insensitive'` query translates to `ILIKE '%search%'` in PostgreSQL. This causes a full table scan, bypassing standard B-Tree indexes. For a large table of notes, this will become incredibly slow.
To fix this at scale, a `tsvector` column with a GIN index should be added to PostgreSQL, and Prisma should be updated to use the `search` full-text API instead of `contains`.

---

# 14. EXTENSION POINTS

- **Tags/Categories**: If notes are extended to support arrays of tags, `buildWhereClause` will need to be updated to support filtering by `hasSome` or `hasEvery` on the tag relation.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Search & Retrieval: Directly dictates the speed and accuracy of finding critical business notes.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
MEDIUM (The `ILIKE` search will degrade on large datasets).

Primary Concern:
Full-text search implementation needs optimization (GIN indexes) for enterprise scale.
