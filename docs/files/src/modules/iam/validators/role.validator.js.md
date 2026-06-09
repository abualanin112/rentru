# File Documentation

File:
`src/modules/iam/validators/role.validator.js`

Domain:
Identity and Access Management (IAM)

Layer:
Validation Layer

Runtime Role:
Defines the Zod schemas for Role and Permission assignment endpoints, ensuring integrity before hitting the database.

Dependencies:

- `zod`
- `cuid2Schema` from `src/shared/CustomValidator.js`

---

# 2. PURPOSE

Roles are highly sensitive records because they dictate system-wide privileges.

This file ensures that when an Admin creates a new role (e.g., "Guest Writer") or assigns an existing role to a user, the payload strictly conforms to the expected shapes. It provides length constraints, type coercion, and array validation for permissions.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Validates the creation and modification of `Role` entities.
- Ensures the role `level` (used for preventing vertical escalation) is strictly typed as an integer between 0 and 100.
- Ensures the `permissions` array (if provided) contains strictly formatted CUID strings.
- Validates URL parameters for mapping operations (`assignRole`, `removeRole`).

---

# 4. IMPORT ANALYSIS

## Important Imports

### `cuid2Schema`

Used for:

- Validating the `permissionId` arrays, `userId` params, and `roleId` params.
  Coupling Level: HIGH (Tightly coupled to the database primary key format).

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `createRole`, `getRoles`, `getRole`, `updateRole`, `deleteRole`, `assignRole`, `removeRole`

Called by:

- `src/modules/iam/routes/role.route.js` (Presumed; maps to standard CRUD and assignment endpoints).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `createRole`

1. The validation middleware intercepts the `POST /roles` request.
2. Zod evaluates `req.body.name`. Must be string, 2-100 characters.
3. Zod evaluates `req.body.description`. Optional string.
4. Zod evaluates `req.body.level`. Coerces the value to a number. Ensures it is an integer between 0 and 100.
5. Zod evaluates `req.body.permissions`. If present, must be an array. Iterates over the array, enforcing `cuid2Schema` on every single element.
6. Returns the validated object to the controller.

---

# 7. IMPORTANT CODE EXAMPLES

## Level Validation

```javascript
level: z.coerce.number().int().min(0).max(100);
```

**Why this matters:**
The `level` property is the foundation of the ERP's Privilege Escalation Prevention engine (`authorization.service.js`). If a client could pass `level: 99999` or `level: -1`, they could break the mathematical logic that determines who can assign roles. Bounding it between 0 and 100 ensures predictable behavior.

## Array CUID Validation

```javascript
permissions: z.array(cuid2Schema('permissionId')).optional();
```

**Why this matters:**
This allows the API to accept a list of permission IDs during role creation. By validating each element as a CUID, it prevents an attacker from passing an array of SQL injection strings, causing Prisma to throw an error when attempting the `connect` operation.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/iam/routes/role.route.js` (Presumed)

Responsibility: Routing.
Relationship: Injects these schemas.

---

# 9. DATABASE INTERACTIONS

None.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Prevents out-of-bounds role levels and malformed relational arrays.

---

# 11. VALIDATION FLOW

Explicitly defines the rules.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Silent Array Stripping

If a user sends `permissions: "cuid123"`, Zod will throw an error because it expects an array. If they send `permissions: ["cuid1", 123]`, it will throw an error. This is good, but complex forms often require robust error messaging to explain _which_ element of the array failed.

---

# 14. EXTENSION POINTS

- **Name Regex**: Currently, `name` is any string. It should probably be restricted to alphanumeric and spaces to prevent UI injection (e.g., `name: "Admin <script>..."`).

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Security Configuration: Ensures the admin interfaces for building Role hierarchies supply clean data.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
The `name` and `description` fields lack XSS protection (Regex boundaries).
