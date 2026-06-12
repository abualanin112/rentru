# ADR 0010: Audit Cold Storage & Export Architecture

## Status

Approved

## Context

As the Audit Log captures all critical events across the ERP, it grows rapidly. To prevent database bloat while maintaining forensic integrity and SIEM compatibility, we require a cold storage export mechanism. The design must adhere strictly to the "Direct Database Architecture" (ADR-0001) and "Audit Immutability" mandates.

## Decisions

### 1. Cursor Pattern (No AuditLog Modification)

We reject any design that mutates `AuditLog` (e.g., adding `sentAt`, `status`, or `exportedAt`). Instead, we introduce a single `AuditExportCursor` table. This preserves absolute immutability and ensures high query performance without constant index rebuilding.
AuditExportCursor is the only mutable state within the Audit Export subsystem.
The cursor tracks `lastExportedCreatedAt` and `lastExportedId`.

### 2. At-Least-Once Delivery

Delivery Guarantee: At-Least-Once

The export pipeline guarantees that audit records are exported at least once.
Duplicate exports are acceptable.
Missing exports are unacceptable.

If a batch is successfully uploaded to Cloudflare R2 but the transaction updating the `AuditExportCursor` fails, the exact same batch will be re-uploaded on the next cycle. Duplicates in SIEM are acceptable; data loss is strictly prohibited.

### 3. Cloudflare R2 & Format Constraints

- **Destination**: Cloudflare R2
- **Format**: NDJSON (Newline Delimited JSON) to support streaming ingestion.
- **Compression**: GZIP to minimize egress and storage costs.
- **Partition Strategy**: Daily folders (`audit-logs/YYYY/MM/DD/`).
- **Filename**: `batch-[timestamp]-[uuid].ndjson.gz`

### 4. Background Worker Constraints

- The exporter runs as an in-process worker via `node-cron`.
- Concurrency across horizontally scaled pods is prevented using `pg_try_advisory_lock(880015)`.
- No external queues (BullMQ, Redis, RabbitMQ) are allowed.

### 5. Deferred Complexity

- **No DeadLetter Queue**: Prisma enforces JSON schema validation on `INSERT`, rendering serialization failure extremely rare. Poison pill handling is deferred.
- **No Purge Policy**: Purging historical data from PostgreSQL involves legal and compliance risks. Data purging is explicitly forbidden in this phase and requires a dedicated future ADR.

## Consequences

- **Positive**: 100% forensic immutability maintained. Zero dependency overhead introduced. Extremely cheap Cloudflare R2 storage.
- **Negative**: "At-Least-Once" delivery means downstream SIEM tools must deduplicate records using `AuditLog.id` if cursor updates fail.
