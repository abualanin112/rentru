# ADR 0002: Decoupled Audit Logging

## Status

Accepted & Implemented

## Context

We need to maintain an immutable log of system events (who did what, when) for security, debugging, and compliance. Initially, one might link audit logs directly to the business entities using foreign keys to ensure data integrity.

## Decision

We decided to decouple the `AuditLog` table entirely from the business schema.

- **No Foreign Keys**: `actorId` and `entityId` are stored as plain strings (soft references) rather than strict foreign keys with `@relation`.
- **JSON Payload**: We store event metadata in a `JSON` column, heavily sanitized before insertion.
- **Transactional Injection**: We allow the audit service to accept an active Prisma transaction client to ensure atomic writes alongside business logic.

## Consequences

- **Positive**: Deleting a User or a Note does not cascade and delete their historical audit logs. The audit trail remains intact and immutable indefinitely.
- **Negative**: The database cannot enforce referential integrity. Queries attempting to join `AuditLog` to `User` might fail if the user was hard-deleted.
- **Mitigation**: The system relies on the soft references and external application logic to correlate events when necessary.
