# IAM Domain

## Entities

### User

The core identity. Contains personal information and authentication credentials.

- **Fields**: `id`, `name`, `email`, `password`, `isEmailVerified`, `role` (legacy), timestamps.
- **Invariants**: Passwords must be hashed. Emails must be verified before certain operations (if configured).

### Token

Ephemeral session and verification artifacts.

- **Fields**: `id`, `token` (hashed), `type` (refresh, resetPassword, verifyEmail), `expires`, `blacklisted`, `familyId`, `ip`, `userAgent`, timestamps.
- **Relationships**: Belongs to `User` (cascade on delete).

### Role

A named collection of permissions defining a privilege level.

- **Fields**: `id`, `name`, `description`, `level`, `isSystem`, timestamps.
- **Invariants**: Higher `level` integers denote greater privilege.

### Permission

A granular right to perform an action on a resource.

- **Fields**: `id`, `action`, `resource`, `scope`, `description`.
- **Invariants**: Combined `action`, `resource`, `scope` must be unique.

### UserRole (Junction)

Links a User to multiple Roles.

### RolePermission (Junction)

Links a Role to multiple Permissions.

## Entity Map

```
User (1) ---- (M) Token
User (1) ---- (M) UserRole (M) ---- (1) Role
Role (1) ---- (M) RolePermission (M) ---- (1) Permission
```
