# Audit Logging Domain

## Entities

### AuditLog

An immutable record of a system event.

- **Fields**:
  - `id`: Primary key (cuid).
  - `event`: Canonical event taxonomy (e.g., `auth.login`). String (`VARCHAR(100)`).
  - `reqId`: Correlation ID mapping to the `pino-http` operational trace. String.
  - `actorId`: Soft reference to the User ID who triggered the action. String.
  - `entityType`: The type of entity affected (e.g., `User`, `Note`). String.
  - `entityId`: Soft reference to the specific entity ID affected. String.
  - `action`: Secondary classifier (`CREATE`, `UPDATE`, `DELETE`, `EXECUTE`). String (`VARCHAR(50)`).
  - `metadata`: Sanitized JSON payload containing event-specific data.
  - `reason`: Optional text explaining the action (useful for administrative overrides).
  - `createdAt`: Timestamp.

- **Indexes**:
  - `[actorId]`
  - `[entityType, entityId]`
  - `[reqId]`
  - `[createdAt]`
  - `[event, createdAt]`

## Entity Map

_(No direct relational maps. Soft references only.)_
