# File Documentation

File:
`src/modules/iam/routes/user.route.js`

Domain:
Identity and Access Management (IAM)

Layer:
Transport / Routing Layer

Runtime Role:
Binds HTTP endpoints to the User CRUD controller methods, enforcing explicit Role-Based Access Control (RBAC) strings.

Dependencies:

- `express.Router`
- `auth.middleware.js`
- `validate.middleware.js`
- `user.validator.js`
- `user.controller.js`

---

# 2. PURPOSE

This file exposes the administrative and self-service APIs for the User entity.

Critically, this file acts as the **RBAC Perimeter**. By looking at this file, a security auditor can immediately see exactly which permissions are required to access which endpoints, without having to trace logic deep into the controllers or services.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Instantiates an Express Router.
- Maps HTTP verbs (`GET`, `POST`, `PATCH`, `DELETE`) to the user controllers.
- Injects the `auth` middleware, passing the specific `action:resource:scope` strings required.
- Injects the `validate` middleware to ensure query parameters (like `page`, `limit`) and body payloads match the Zod schemas.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `auth.middleware.js`

Used for:

- Enforcing RBAC.
  Coupling Level: HIGH.

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `export { router as userRoutes }`

Called by:

- `src/modules/router.js` (Mounted under `/v1/users`).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `PATCH /:userId`

1. Request hits `/v1/users/cl...123`.
2. **Middleware 1: `auth('update:users:own')`**
   - The auth middleware verifies the JWT.
   - It checks the cache/database to ensure the user has the `update:users:own` permission (or higher, like `update:users:any`). If not, it rejects with 403.
3. **Middleware 2: `validate(userValidation.updateUser)`**
   - Zod validates the `req.body` (e.g., ensuring `email` is formatted correctly, stripping unknown fields).
   - Zod validates `req.params.userId` (ensuring it matches the CUID format).
4. **Controller: `userController.updateUser`**
   - The controller executes. As documented previously, it will then perform the ABAC assertion (`assertCanManageUser`) to ensure the user actually owns the ID they are trying to update.

---

# 7. IMPORTANT CODE EXAMPLES

## RESTful Routing with Chaining

```javascript
router
  .route('/:userId')
  .get(auth('read:users:own'), validate(userValidation.getUser), userController.getUser)
  .patch(auth('update:users:own'), validate(userValidation.updateUser), userController.updateUser)
  .delete(auth('delete:users:own'), validate(userValidation.deleteUser), userController.deleteUser);
```

**Why this matters:**
This syntax (`router.route().get().patch().delete()`) is the Express best practice for grouping routes that share the same path. It reduces typos and makes the file significantly easier to read. Notice how the scopes are all set to `:own`. The router establishes the baseline perimeter (you must at least have permission to edit _your own_ profile), while the controller handles the complex ABAC of deciding if you are actually editing your own profile.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/iam/controllers/user.controller.js`

Responsibility: Execution.
Relationship: The router merely points traffic to these functions.

---

# 9. DATABASE INTERACTIONS

None directly.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
This file is the explicit manifestation of the system's Role-Based Access Control matrix.

---

# 11. VALIDATION FLOW

Explicitly binds Zod validators to routes.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Silent Scope Failures

If a developer accidentally types `auth('read:user:own')` (singular `user` instead of `users`), the middleware will check for a permission that doesn't exist, effectively locking out all users from the endpoint. There is currently no compile-time checking for these string literals.

---

# 14. EXTENSION POINTS

- **Bulk Endpoints**: If `DELETE /users` (bulk delete) is added, it must be protected with `auth('delete:users:any')`.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- API Security: The ultimate authority on which routes require which permissions.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
The string literals used in the `auth()` middleware are prone to typos. Exporting a constant dictionary of available permissions (e.g., `Permissions.READ_USERS_OWN`) would prevent silent lockouts.
