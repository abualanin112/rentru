# File Documentation

File:
`src/modules/iam/repositories/user.repository.js`

Domain:
Identity and Access Management (IAM)

Layer:
Data Access / Repository Layer

Runtime Role:
Abstracts Prisma database operations for the `User` entity.

Dependencies:

- `src/infrastructure/prisma.js`
- `src/shared/Paginate.js`

---

# 2. PURPOSE

Similar to the `token.repository.js`, this isolates User data access.

It provides standard CRUD, complex cursor/offset pagination integration, and specific overrides to Prisma's global security defaults (such as selectively allowing password hashes to be retrieved during login).

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Standard `create`, `updateById`, `deleteById` operations utilizing the `tx = prisma` pattern.
- Implements `findByEmail` with a specific security override to fetch the password hash.
- Implements `isEmailTaken` to check for uniqueness without retrieving the whole user object.
- Connects the Prisma `user` model to the generic `Paginate.js` utility and strictly controls which relational populations are allowed to be dynamically requested by API clients.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `paginate`

Used for:

- Abstracting away the complexity of calculating total pages, next cursors, and offset math.
  Coupling Level: HIGH.

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `create`, `findById`, `findByEmail`, `isEmailTaken`, `updateById`, `deleteById`, `paginateUsers`

Called by:

- `src/modules/iam/services/user.service.js`
- `src/modules/iam/services/auth.service.js`

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `paginateUsers`

1. Receives a `filter` (e.g., `{ role: 'admin' }`) and `options` (e.g., `{ limit: 20, populate: 'notes,invalid' }`).
2. Defines `ALLOWED_POPULATIONS = ['notes']`.
3. If `populate` is provided in the options, it splits the comma-separated string.
4. It filters the requested populations against `ALLOWED_POPULATIONS`.
   - `notes` is kept.
   - `invalid` is stripped.
5. Re-joins the safe populations into a string.
6. Passes the `tx.user` delegate, the `filter`, and the safe `options` to the generic `paginate` utility.
7. Returns the standardized `{ results, page, limit, totalPages, totalResults }` object.

---

# 7. IMPORTANT CODE EXAMPLES

## Overriding Global Security Safeties

```javascript
const findByEmail = async (email, { includePassword = false } = {}, tx = prisma) => {
  return tx.user.findUnique({
    where: { email },
    omit: { password: !includePassword },
  });
};
```

**Why this matters:**
In `src/infrastructure/prisma.js`, a global extension configures `omit: { password: true }` for the entire application. However, `auth.service.js` needs the password hash to verify a login. This repository method explicitly overrides the global omit setting when `includePassword: true` is passed, strictly confining password exposure to this one specific execution path.

## Protected Pagination

```javascript
const ALLOWED_POPULATIONS = ['notes'];

if (paginateOptions.populate) {
  paginateOptions.populate = paginateOptions.populate
    .split(',')
    .map((rel) => rel.trim())
    .filter((rel) => ALLOWED_POPULATIONS.includes(rel))
    .join(',');
}
```

**Why this matters:**
If a frontend developer maliciously passes `?populate=sessions,tokens,auditLogs` to the `/v1/users` endpoint, the `paginate` utility might try to instruct Prisma to `include` those tables. This whitelist guarantees that only safe, explicitly allowed relations can be requested via the URL.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/shared/Paginate.js`

Responsibility: Abstract pagination logic.
Relationship: The repository acts as the bridge between the domain-specific Model (`user`) and the generic algorithm.

---

# 9. DATABASE INTERACTIONS

Touched Models:

- `User`

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Enforces strict limits on what relational data can be extracted via the API (`ALLOWED_POPULATIONS`).

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Flexible Filters in Pagination

The `filter` parameter is passed directly to the `paginate` utility, which passes it to Prisma's `where` clause. If `user.controller.js` does not aggressively sanitize `req.query` (using the `pick` utility), an attacker could pass complex Prisma operators (like `password: { startsWith: 'a' }`) into the URL. This relies entirely on the Controller layer doing its job.

---

# 14. EXTENSION POINTS

- **New Relations**: As new modules are built (e.g., `Profiles`, `Settings`), they must be explicitly added to `ALLOWED_POPULATIONS` if the frontend needs to fetch them alongside the user list.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Data Access Governance: Provides the lowest-level access controls before hitting the database.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH.

Primary Concern:
The security model relies on the controller filtering the `req.query` before passing it to `paginateUsers`.
