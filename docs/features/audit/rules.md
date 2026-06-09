# Audit Logging Rules

Extract of confirmed business rules governing the Audit domain.

## Decoupling Rule

- **No Foreign Keys**: The `AuditLog` database table must explicitly avoid `@relation` foreign keys to other tables (like `User` or `Note`). This guarantees that audit logs survive the deletion or archival of parent entities, ensuring historical accuracy is never lost.

## Taxonomy Standard

- **Event Naming**: `event` strings must follow a canonical taxonomy: `{domain}.{action}` (e.g. `auth.login`, `notes.created`, `authz.escalation.attempted`).
- **Entity Type Standard**: `entityType` must use PascalCase matching the domain model (e.g., `User`, `Note`, `Role`).
- **Action Standard**: `action` must be a secondary classifier in uppercase: `CREATE`, `UPDATE`, `DELETE`, `EXECUTE`.

## Sanitization Constraints

- **Redaction Keys**: Any metadata key matching `['password', 'token', 'refreshToken', 'accessToken', 'authorization']` (case-insensitive) must be overwritten with `[REDACTED]`.
- **Depth Limit**: JSON objects nested deeper than 3 levels are truncated to `[TRUNCATED]`.
- **Array Limit**: Arrays with more than 50 items are sliced, and an overflow warning string is appended.
- **String Length Limit**: Strings exceeding 2000 characters are truncated.
