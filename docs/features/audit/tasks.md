# Audit Logging Tasks & Backlog

## Completed

- `[x]` Database schema design with decoupled soft references.
- `[x]` ALS integration for automatic `reqId` and `actorId` extraction.
- `[x]` Deep metadata payload sanitization logic.
- `[x]` Transaction-aware execution interface.

## Planned

- `[ ]` **Admin Audit Dashboard UI**: Create an exposed API (`GET /v1/audit`) protected by super-admin roles (`read:audit:any`) to allow UI rendering of system events.
- `[ ]` **Event Forwarding**: Integrate the audit logs with external SIEM (Security Information and Event Management) tools or export streams (e.g., AWS Kinesis, Datadog) for long-term cold storage.
