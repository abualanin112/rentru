# IAM Rules

Extract of confirmed business rules governing identity and access management.

## User Rules

- **Email Uniqueness**: User emails must be globally unique.
- **Data Protection**: Passwords must never be returned in API queries (Prisma `omit` applied globally).
- **Deletion Cascade**: Deleting a user must delete all their tokens, roles, and associated domain entities (e.g., Notes), but leave Audit Logs intact.

## Token Rules

- **Access Tokens**: Short-lived (default 30 minutes). Stateless.
- **Refresh Tokens**: Long-lived (default 30 days). Hashed via SHA-256 before DB insertion.
- **Reuse Detection**: Presenting a blacklisted token outside a 2-second grace period results in immediate revocation of the entire token family.
- **Logout**: Logout is fully idempotent; it returns 204 even if the token does not exist.

## Authorization Rules

- **Permission Syntax**: `action:resource:scope`.
- **Scope Hierarchy**: The `:any` scope implicitly satisfies the `:own` scope for the same action and resource.
- **Super Admin**: The wildcard permission `*:*:*` satisfies any permission check.
- **Escalation Prevention**: A user attempting to assign a role to another user must hold a maximum role `level` greater than or equal to the `level` of the role being assigned.
- **Caching**: Resolved permissions are cached in an LRU memory cache for 5 minutes. Cache versioning is used for global invalidation during schema changes.
