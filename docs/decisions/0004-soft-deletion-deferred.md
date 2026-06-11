# ADR 0004: Soft Deletion Deferred

## Status

Superseded by IAM ERP Phase 1-5 Domain Schema

## Context

When an entity (User or Note) is deleted, we must decide whether to physically remove the record from the database (hard delete) or simply mark it as deleted (soft delete via a `deletedAt` timestamp).

## Decision

We currently implement **Hard Deletions** and rely on cascading hooks to clean up related data (e.g., deleting a User triggers a hook to delete their Notes). The implementation of a global `deletedAt` soft deletion pattern has been explicitly deferred.

## Rationale

- Implementing soft deletion properly with an ORM requires altering almost every query in the system to explicitly exclude `deletedAt: null`. Prisma does support middlewares/extensions for this, but it introduces hidden query complexity.
- Hard deletions keep the database size manageable and enforce strict data hygiene.
- Because we have a Decoupled Audit Log (ADR 0002), we still retain the historical record of the entity's existence and its final state prior to deletion.

## Consequences

- **Positive**: Simpler business logic and database queries. Smaller active database size.
- **Negative**: Data recovery is impossible without restoring from a full database backup.
- **Resolution**: **SUPERSEDED**. The IAM ERP architecture now enforces strict **Soft Deletions** via `deletedAt` for financial and operational integrity. Hard deletion is explicitly banned for the `User` entity. Prisma Client Extensions ("Silent Guardian") have been implemented to automate the injection of `deletedAt: null` to mitigate the query complexity concern mentioned in this ADR.
