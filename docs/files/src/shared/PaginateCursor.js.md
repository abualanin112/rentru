# File Documentation

File:
`src/shared/PaginateCursor.js`

Domain:
Shared Utilities

Layer:
Data Access / Utility

Runtime Role:
Abstracts ultra-high-performance, cursor-based pagination for high-volume streams like feeds, chat logs, or infinite-scroll note lists.

Dependencies:

- None.

---

# 2. PURPOSE

Because the standard `Paginate.js` offset approach degrades severely on large datasets, this file provides an alternative specifically designed for infinite scrolling UI patterns.

Cursor pagination relies on an index (the ID). Instead of saying "skip 100,000 rows," it says "fetch 10 rows where the ID is less than X." This is an $O(1)$ operation in PostgreSQL, making it instantaneously fast regardless of whether the user is on page 1 or page 10,000.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Receives the Prisma model, filters, and a `cursor` (ID).
- Computes `take: limit + 1`.
- Always sorts by `{ id: 'desc' }`.
- Analyzes the results to determine if a "next page" exists.
- Slices off the extra verification row before returning the data to the client.

---

# 4. IMPORT ANALYSIS

This file has no dependencies.

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `paginateCursor`

Called by:

- `src/modules/notes/note.repository.js`

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow

1. Receives `limit = 10`. Sets `take = 11`.
2. Asks Prisma to fetch 11 rows starting after the `cursor`.
3. If 11 rows are returned, it means there is more data in the database. Sets `hasNextPage = true`.
4. If 10 or fewer rows are returned, it means the database is exhausted. Sets `hasNextPage = false`.
5. If `hasNextPage` is true, slices off the 11th row so the client only receives the requested 10.
6. Extracts the `id` of the 10th row and assigns it to `nextCursor`.
7. Returns `{ results, nextCursor, hasNextPage }`.

---

# 7. IMPORTANT CODE EXAMPLES

## Time-Sorted CUIDs

```javascript
  const results = await model.findMany({
    ...
    orderBy: { id: 'desc' }, // Time-sorted CUID2 makes this mathematically faster and collision-safe
  });
```

**Why this matters:**
Cursor pagination _requires_ the sorted column to be perfectly unique. If you cursor-sort by `createdAt`, and two rows have the identical millisecond timestamp, the cursor will skip one of them randomly.

Because the project uses `CUID2` as its primary key, and CUID2 includes a monotonically increasing timestamp component, sorting by `id: 'desc'` is identical to sorting by `createdAt: 'desc'`, but mathematically collision-proof. This is a brilliant architectural synergy between the ID generation strategy and the pagination strategy.

## The N+1 Trick

```javascript
  const take = limit + 1;
  ...
  const hasNextPage = results.length > limit;
  const data = hasNextPage ? results.slice(0, -1) : results;
```

**Why this matters:**
In offset pagination, you run a `count()` query to find out if there are more pages. Running a `count()` on a table with 50 million rows is extremely slow.

Cursor pagination completely bypasses the count query. By simply asking the database for _one more row than the user requested_, the system can deduce if there is another page. If the client asked for 10, and the database returned 11, there is a next page. The 11th row is sliced off, saving a massive amount of database compute.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/notes/note.repository.js`

Responsibility: Integration.
Relationship: Used to power the high-traffic `/notes` infinite scroll view.

---

# 9. DATABASE INTERACTIONS

None directly.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
None.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Lack of Total Count

Cursor pagination fundamentally cannot tell the user "You are on page 5 of 100". It can only say "There is a next page." This makes it unsuitable for administrative grids, which is why the system also maintains the `Paginate.js` offset utility.

### Forced Sorting

This utility hardcodes `orderBy: { id: 'desc' }`. If the user wants to sort their notes alphabetically by `title`, this utility cannot be used. Cursor pagination on non-unique columns (like `title`) is notoriously difficult and requires composite cursors.

---

# 14. EXTENSION POINTS

- **Bi-directional Scrolling**: Currently, this only supports scrolling "down" (`nextCursor`). It could be extended to support `previousCursor` for jumping back up a feed.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- High-Performance UI: Enables instant infinite-scroll feeds on mobile and web applications regardless of the company's data volume.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
EXTREMELY HIGH

Primary Concern:
None. This is the optimal implementation of cursor pagination using CUIDs.
