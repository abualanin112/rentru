# Audit Logging Overview

## Purpose

The Audit module provides an immutable, append-only system-wide event log. It is designed to track "who did what, when, and to what entity" for security compliance and debugging.

## Status

Active and Stable. Fully integrated with IAM and Notes modules.

## Priority

High. Critical for security monitoring and compliance.

## Dependencies

- **PostgreSQL / Prisma**: For persisting `AuditLog` records.
- **AsyncLocalStorage (ALS)**: For automatically injecting the `reqId` (correlation ID) and `actorId` into audit events without polluting function signatures.
