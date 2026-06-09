# File Documentation

File:
`src/shared/Paginate.js`

Domain:
Shared Utilities

Layer:
Data Access / Utility

Runtime Role:
Abstracts standard offset-based pagination and relationship mapping logic for Prisma models.

Dependencies:

- None.

---

# 2. PURPOSE

If every repository implements its own pagination logic, bugs related to sorting stability and total page calculations will multiply.

This file provides a unified `paginate` function that standardizes how the API responds to lists (e.g., `{ results, page, limit, totalPages, totalResults }`). It also provides secure parsers that translate HTTP query strings (`sortBy=name:desc`, `populate=owner.notes`) into Prisma's complex nested object syntax (`orderBy`, `include`).

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- `parseSortBy`: Translates comma-separated sort strings into Prisma `orderBy` arrays. Crucially, appends a deterministic tie-breaker.
- `parsePopulate`: Translates dot-notation strings into deeply nested Prisma `include` objects.
- `paginate`: Executes a `count` query and a `findMany` query in parallel, computes the math, and returns the standard envelope.

---

# 4. IMPORT ANALYSIS

This file has no dependencies.

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `parseSortBy`, `parsePopulate`, `paginate`

Called by:

- `src/modules/iam/repositories/user.repository.js`
- `src/modules/iam/repositories/role.repository.js`

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `paginate`

1. Receives the `prismaModel` delegate (e.g., `prisma.user`), `filter`, and `options`.
2. Calculates the `skip` offset based on `(page - 1) * limit`.
3. Calls `parseSortBy` and `parsePopulate`.
4. Executes `Promise.all` to run `count()` and `findMany()` concurrently against the database.
5. Calculates `totalPages` using `Math.ceil()`.
6. Returns the standardized object.

---

# 7. IMPORTANT CODE EXAMPLES

## Deterministic Sorting Fix

```javascript
// Always append a deterministic tie-breaker to prevent unstable sorting anomalies
// during offset pagination in PostgreSQL (where identical timestamps cause jumping rows)
parsed.push({ id: 'asc' });
```

**Why this matters:**
This is a critical bug fix for PostgreSQL offset pagination. If you sort by `createdAt`, and 10 users are created in the exact same millisecond, PostgreSQL does not guarantee the order of those 10 rows. When a user requests `page=1`, Postgres might return User A. When they request `page=2`, the database might shift the identical timestamps, and return User A _again_. By forcefully appending the primary key (`id: 'asc'`) to every single sort operation, the order becomes perfectly deterministic, preventing jumping rows.

## Concurrent Querying

```javascript
  const [totalResults, results] = await Promise.all([
    prismaModel.count({ where: filter }),
    prismaModel.findMany({ ... }),
  ]);
```

**Why this matters:**
Offset pagination requires knowing the total number of rows to calculate `totalPages`. A naive implementation would `await count()`, and then `await findMany()`, doubling the network latency. `Promise.all` executes them simultaneously over separate connections in the Prisma pool, halving the response time.

---

# 8. CROSS-FILE RELATIONSHIPS

### Repositories

Responsibility: Integration.
Relationship: Used as a mixin for repositories that require admin-style list views.

---

# 9. DATABASE INTERACTIONS

None directly (receives the delegated model).

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
None natively. It relies entirely on the repository layer (e.g., `user.repository.js`) to whitelist the `populate` options _before_ they are passed here, otherwise this utility will gladly execute `include: { passwords: true }` if asked.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Deep Population DOS

The `parsePopulate` function has no depth limit. A malicious user could send `populate=a.b.c.d.e.f.g`. Prisma translates this into a massive 7-level deep `LEFT JOIN` in SQL, which will crash the database due to memory exhaustion. Repositories _must_ aggressively sanitize the `populate` string.

### Offset Pagination Degradation

Offset pagination (`skip`) is an $O(N)$ operation in PostgreSQL. If a user requests `page=10000, limit=10`, the database must compute and sort 100,000 rows, discard 99,990 of them, and return 10. This is notoriously slow at scale.

---

# 14. EXTENSION POINTS

- **Max Depth Constraint**: Add a hardcoded depth check inside `parsePopulate` (e.g., `if (parts.length > 3) throw Error`).

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Administration: Powers the data tables and grids used by system admins.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
LOW (Due to fundamental limitations of SQL offset `SKIP` operations on large datasets).

Primary Concern:
The DOS risk associated with unrestricted `populate` depth.
