# 0009: Universal Cursor Pagination Strategy

## Context

As the project prepares for large-scale transactional ERP modules (e.g., Audit Logs, Notes, Ledgers), the need for efficient, highly concurrent pagination becomes critical. Offset-based pagination (`LIMIT` / `OFFSET`) is suitable for small administrative tables (Users, Roles) but exhibits O(N) performance degradation and skipped/duplicated records under high concurrency for massive datasets.

Our previous cursor pagination utility (`PaginateCursor.js`) was deprecated because it hardcoded assumptions around `CUID2` string formats and sorted purely by `id DESC`. However, the project's primary keys are universally `UUIDv4`, which have zero inherent chronological order. Attempting to sort by a timestamp like `createdAt` while providing a cursor on an uncorrelated `UUID` can cause pagination drift during high-concurrency inserts.

## Decision

We are adopting a **Deterministic Tuple Cursor Pagination Engine** for all transactional and chronological queries.

### Rules

1. **Offset Pagination (`Paginate.js`)**: Approved only for administrative datasets.
2. **Cursor Pagination (`CursorPaginate.js`)**: Mandatory for transactional chronological datasets.
3. **Tuple Sorting**: Every cursor pagination query must deterministically sort using a combination of a timestamp field and the primary key (e.g., `(createdAt, id)`).
4. **Mandatory Composite Indexes**: Every model using `CursorPaginate` MUST define a composite index matching the exact tuple ordering fields and sort direction. For example: `@@index([createdAt(sort: Desc), id(sort: Desc)])`. The Universal Cursor Engine must never assume a specific timestamp field, so the index must match the `sortByField`.
5. **Base64 Cursors**: The cursor value exposed to the client MUST be an opaque Base64-encoded string representing the tuple (e.g., `eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTEyVDEwOjAwOjAwLjAwMFoiLCJpZCI6InV1aWQtdmFsdWUifQ==`), hiding the internal tuple complexity from frontend consumers.

## Consequences

- **Positive:** Absolute consistency during pagination, even if multiple records are inserted in the exact same millisecond. Prevents skipped records and duplicated records.
- **Positive:** Performance remains O(1) regardless of page depth due to exact database index lookups on the composite tuple index.
- **Negative:** Clients must pass the opaque Base64 cursor back to the server unmodified. Manually constructing API requests becomes slightly more tedious during debugging.
- **Negative:** Requires explicitly defining `@@index([timestamp(sort: Desc), id(sort: Desc)])` to avoid expensive in-memory sort nodes, increasing index maintenance overhead on write-heavy tables.
