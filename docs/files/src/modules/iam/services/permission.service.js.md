# File Documentation

File:
`src/modules/iam/services/permission.service.js`

Domain:
Identity and Access Management (IAM)

Layer:
Domain Service Layer

Runtime Role:
The central engine for resolving, caching, and evaluating the Role-Based Access Control (RBAC) graph.

Dependencies:

- `src/infrastructure/prisma.js`
- `src/infrastructure/cache.js`
- `src/infrastructure/logger.js`

---

# 2. PURPOSE

In a complex ERP, determining if a user can "update a note" requires traversing a deep relational graph: User → UserRole → Role → RolePermission → Permission. Performing a 5-table JOIN on _every single authenticated HTTP request_ would destroy database performance.

This file solves that problem. It flattens the complex relational graph into an extremely fast in-memory Set of strings (e.g., `['read:users:any', 'update:notes:own']`). It caches these sets in LRU memory and provides sophisticated invalidation mechanisms (including a global kill switch) to ensure security updates propagate instantly without sacrificing performance.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Computes the flattened array of permissions for a user by querying Prisma with deeply nested `includes`.
- Reads and writes to `cache.js` to avoid hitting the database.
- Implements pure logical matching (`matchesPermission`) that understands Wildcards (`*:*:*`) and Scope Escalation (`:any` implicitly satisfies `:own`).
- Calculates the maximum role level for a user (used by `authorization.service.js` to prevent vertical escalation).
- Provides targeted cache invalidation functions (`invalidateUserPermissionCache`) and a global emergency version bump (`bumpGlobalPermissionCacheVersion`).

---

# 4. IMPORT ANALYSIS

## Important Imports

### `cache.js`

Used for:

- Lightning-fast retrieval of the flattened permission Sets, and Atomic increments for the global version key.
  Coupling Level: HIGH (This service heavily relies on caching to achieve its performance SLA).

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `getUserPermissions`, `hasPermission`, `matchesPermission`

Used for evaluating access.

### `getMaxRoleLevel`

Used by the role assignment logic.

### `invalidateUserPermissionCache`, `invalidateRolePermissionCache`, `bumpGlobalPermissionCacheVersion`

Lifecycle hooks to ensure cache consistency.

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `getUserPermissions`

1. Fetches the `GLOBAL_VERSION_KEY` from the cache (e.g., `v1`).
2. Constructs the targeted cache key: `rbac:permissions:v1:user:{userId}`.
3. Checks the cache. If hit, returns the `Set`.
4. On miss, it queries `prisma.userRole` and joins `role`, `rolePermissions`, and `permission`.
5. Iterates through the graph, concatenating `action`, `resource`, and `scope` into a single string.
6. Saves the array to the cache with a 5-minute TTL.
7. Returns the Set.

## Execution Flow: `matchesPermission`

1. Checks for an exact string match (e.g., `read:notes:own` === `read:notes:own`).
2. Checks if the user has the SuperAdmin wildcard (`*:*:*`).
3. **Scope Escalation**: If the requested permission is for `:own`, it uses Regex/String-replace to look for the `:any` variant in the user's set. If found, returns true.

---

# 7. IMPORTANT CODE EXAMPLES

## Scope Escalation Engine

```javascript
const matchesPermission = (grantedPermissions, requiredPermission) => {
  // Exact match
  if (grantedPermissions.has(requiredPermission)) return true;

  // Super admin wildcard
  if (grantedPermissions.has(WILDCARD_PERMISSION)) return true;

  // Scope escalation: :any supersedes :own
  if (requiredPermission.endsWith(':own')) {
    const anyVariant = requiredPermission.replace(/:own$/, ':any');
    if (grantedPermissions.has(anyVariant)) return true;
  }

  return false;
};
```

**Why this matters:**
This pure function is the core of the ERP's security model. It prevents database bloat. Without this logic, an "Admin" role would need to be explicitly granted both `update:users:any` AND `update:users:own`. By coding the hierarchy directly into the engine, the database schema remains small and comprehensible.

## Global Version Bumping (The Kill Switch)

```javascript
const bumpGlobalPermissionCacheVersion = async () => {
  const newVersion = await cacheIncr(GLOBAL_VERSION_KEY);
  logger.info({ event: 'rbac.cache.version_bumped', newVersion }, 'Global permission cache version bumped atomically');
  return newVersion;
};
```

**Why this matters:**
If an attacker discovers a vulnerability in a specific Role and begins exploiting it, an Admin might update that Role's permissions in the UI. Because permissions are cached for 5 minutes, the attacker would normally retain access. By calling this function, the system atomically increments `v1` to `v2`. Because the cache keys are prefixed with the version (`...:v1:user...`), all existing cached entries are instantly orphaned, forcing every subsequent request to re-evaluate against the database immediately.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/middleware/auth.middleware.js`

Responsibility: Transport security.
Relationship: This file is executed on _every_ protected HTTP request via the middleware.

### `src/modules/iam/services/authorization.service.js`

Responsibility: ABAC logic.
Relationship: Uses `getMaxRoleLevel` to prevent privilege escalation during role assignments.

---

# 9. DATABASE INTERACTIONS

Touched Models:

- `UserRole`, `Role`, `RolePermission`, `Permission`

Transaction Boundary:

- Runs as dirty reads outside of transactions (acceptable for caching layers).

Query Patterns:

- Deeply nested `findMany` using Prisma's `include`. This is heavy, which is why caching it is mandatory.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
This file translates database configurations into runtime security decisions.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

Logs heavily on cache misses and explicit cache invalidations, which helps SREs track down "permission flapping" if the cache is being invalidated too often.

---

# 13. ARCHITECTURAL RISKS

### Single Node Cache

Because this uses `cache.js` (which is backed by `lru-cache` in memory), calling `invalidateUserPermissionCache(userId)` on Node A will NOT invalidate the cache on Node B.
To achieve true enterprise scale, this module absolutely requires Redis.

---

# 14. EXTENSION POINTS

- **Negative Permissions**: Currently, all permissions are additive. If the ERP requires "Deny" policies (e.g., granting `:any` but explicitly denying `delete`), `matchesPermission` would need to be rewritten to evaluate `-delete:users:any` strings first.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- System Performance: Prevents the database from melting under the load of evaluating complex SQL joins on every HTTP request.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
MEDIUM (Couples database schema directly to string representations).

Scalability:
LOW (Due to local memory cache invalidation issues). Needs Redis.

Primary Concern:
The lack of distributed cache invalidation is a critical flaw for multi-node deployments. If an Admin removes a user's permissions, that user might still have access for 5 minutes on other pods.
