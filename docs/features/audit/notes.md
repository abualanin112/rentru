# Audit Logging Notes

## Technical Debt

- **Pagination Strategy**: If the Admin UI is built, the `AuditLog` table will grow massive very quickly. Cursor-based pagination on `[createdAt]` will be mandatory. Querying by `entityId` or `actorId` will require heavy index optimization.
- **Log Archival**: Currently, the `AuditLog` table grows infinitely. We need a cron job or background worker to move logs older than 90 days into a cold-storage archival format (e.g., S3 CSV dump) and purge them from the active PostgreSQL database.

## Assumptions

- **Synchronous Persistence**: We assume that inserting into the `AuditLog` table does not significantly bottleneck the main HTTP response latency. If it becomes a bottleneck, we might need to push audit events to an asynchronous message queue (e.g., Redis Streams) instead of writing them directly to PostgreSQL during the HTTP lifecycle (though this would break the transactional atomicity requirement for mutations).
