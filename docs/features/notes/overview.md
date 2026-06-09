# Notes Overview

## Purpose

The Notes module encapsulates the primary business domain of the application: creating, reading, updating, and deleting textual notes with organizational features like tags and archiving.

## Status

Active and Stable. Features advanced database search and cursor-based pagination.

## Priority

High. This is the core data layer for the user.

## Dependencies

- **PostgreSQL / Prisma**: For persisting notes and executing full-text search queries.
- **IAM Module**: For asserting data ownership (authorization) and registering deletion cascading hooks.
- **Audit Logging Module**: For tracking mutations (creates, updates, deletes) on notes for compliance.
