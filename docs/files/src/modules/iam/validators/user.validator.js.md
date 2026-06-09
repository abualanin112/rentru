# File Documentation

File:
`src/modules/iam/validators/user.validator.js`

Domain:
Identity and Access Management (IAM)

Layer:
Validation Layer

Runtime Role:
Defines the Zod schemas for User entity CRUD endpoints, including type coercion for query parameters and safety checks for partial updates.

Dependencies:

- `zod`
- `cuid2Schema`, `password` from `src/shared/CustomValidator.js`

---

# 2. PURPOSE

Ensures that API consumers interact with the `/v1/users` endpoints using the correct types and constraints.

It handles the complexity of HTTP serialization (e.g., turning stringified numbers from the URL into actual JavaScript integers) and ensures that URL parameters (`/:userId`) strictly conform to the expected database ID format (CUID2) before hitting the database.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Validates creation payloads (`email`, `name`, `password`, `role`).
- Validates query strings (`getUsers`), applying coercion so `?limit=10` becomes `10` instead of `"10"`.
- Validates URL parameters (`/:userId`) to prevent malformed CUIDs from causing Prisma crashes.
- Implements a safety refinement on `updateUser` to ensure the client actually provided at least one field to update.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `cuid2Schema`

Used for:

- Ensuring that `userId` parameters are cryptographically secure CUID2 strings, rejecting classic UUIDs or short strings instantly.
  Coupling Level: HIGH (Couples the API router directly to the DB's primary key generation strategy).

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `createUser`, `getUsers`, `getUser`, `updateUser`, `deleteUser`

Called by:

- `src/modules/iam/routes/user.route.js`

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `updateUser`

1. Matches `params: { userId }` against the `cuid2Schema`.
2. Inspects `body: { email, name, password }`. All are `.optional()`.
3. Evaluates `.refine((data) => Object.keys(data).length > 0)`.
   - If the client sends an empty payload `{}`, or a payload with only unknown fields `{ foo: 'bar' }` (which Zod strips, resulting in `{}`), this refinement throws an error.
   - This prevents the controller from executing a completely useless database transaction.

---

# 7. IMPORTANT CODE EXAMPLES

## Type Coercion

```javascript
const getUsers = z.object({
  query: z.object({
    name: z.string().optional(),
    role: z.string().optional(),
    sortBy: z.string().optional(),
    limit: z.coerce.number().int().optional(),
    page: z.coerce.number().int().optional(),
  }),
});
```

**Why this matters:**
Everything extracted from `req.query` in Express is a string. If the validation schema just said `limit: z.number()`, the validation would _fail_ because `"10"` is not a number. `z.coerce.number()` instructs Zod to run `Number("10")` first, and then validate the result. Furthermore, `.int()` ensures the client didn't request `?page=1.5`. The `validate.middleware.js` then overwrites `req.query` with these coerced values, meaning the controller can safely trust `typeof req.query.limit === 'number'`.

## Update Emptiness Check

```javascript
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Must have at least one field to update',
  })
```

**Why this matters:**
A classic API bug occurs when a client sends a payload containing an incorrectly spelled field (e.g., `{ emaill: 'test@test.com' }`). Zod safely strips `emaill` to prevent Mass Assignment. However, the resulting object is `{}`. The database runs `UPDATE users SET () WHERE id = X`, which is either a no-op or a syntax error. This refinement ensures the client receives a clear 400 error indicating they provided no valid fields.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/iam/routes/user.route.js`

Responsibility: Routing.
Relationship: Passes these schemas into the validation middleware.

---

# 9. DATABASE INTERACTIONS

None directly. However, it protects the database from malformed `userId` queries.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Prevents Mass Assignment by silently stripping unknown properties.

---

# 11. VALIDATION FLOW

Explicitly defines the rules.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Redundant Field Declarations

The `createUser` and `updateUser` schemas redefine the `email` and `name` rules independently. If the business decides `name` must be `z.string().min(2)`, it must be updated in both places. Using a base `userSchema` and utilizing Zod's `.pick()` and `.partial()` methods would be more DRY (Don't Repeat Yourself).

---

# 14. EXTENSION POINTS

- **Sort Validation**: Currently `sortBy: z.string().optional()` allows the client to pass arbitrary strings (like `sortBy=password:desc`). This should be refined with a regex or enum to only allow sorting by safe, indexed columns (like `name` or `createdAt`).

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- API Usability: Ensures clients receive fast, explicit 400 errors when they format data incorrectly, saving time compared to waiting for a database constraint error.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
The `sortBy` parameter is not strictly validated against safe column names, which could lead to slow queries if the frontend sorts by an unindexed column.
