# ADR 0008: Remove Application Cache Layer

Date: 2026-06-12

## Status

Accepted & Implemented

## Context

Initially, caching mechanisms (such as Redis or in-memory LRU caches) were considered to optimize authentication, session lookup, and database read paths. However, caching introduces data synchronization issues, stateful dependencies, cache invalidation complexities, and additional hosting costs. Given the simplicity and scale of the monolith, maintaining a cache layer for authorization and identity verification is an unnecessary optimization.

## Decision

We will completely remove the application-level cache layer and adopt a Direct Database Architecture.

- **Direct Database Access**: All authorization checks, session validations, invitation verifications, branch isolation logic, and user lifecycle operations must query PostgreSQL directly via Prisma.
- **Cache Prohibition**: Application-level caching layers (such as `lru-cache`, in-memory cache stores, or Redis caching) are strictly prohibited unless a future ADR explicitly approves and details a specific use-case.
- **Performance Optimization Strategy**: Performance optimization must be achieved through indexing, query optimization, projections, pagination, and database tuning rather than cached authorization or identity data.

## Consequences

- **Positive**: Simplified backend architecture; the database acts as the single source of truth.
- **Positive**: Zero cache invalidation bugs, race conditions, or stale authorization data issues.
- **Positive**: Lower hosting overhead and infrastructure footprint (no Redis dependency required for basic read operations).
- **Negative**: Increased load on PostgreSQL for repetitive reads (e.g., resolving user permissions on every request).
- **Mitigation**: Addressed by PostgreSQL composite indexes and direct query resolution, ensuring queries execute in sub-millisecond ranges.
