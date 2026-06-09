# File Documentation

File:
`src/modules/notes/note.route.js`

Domain:
Notes / Core Business Logic

Layer:
Transport / Routing Layer

Runtime Role:
Binds HTTP endpoints to the Note CRUD controller methods, enforcing explicit Role-Based Access Control (RBAC) strings.

Dependencies:

- `express.Router`
- `auth.middleware.js`
- `validate.middleware.js`
- `note.validator.js`
- `note.controller.js`

---

# 2. PURPOSE

This file exposes the API for managing the core `Note` entity.

It defines the URL structure (`/v1/notes`) and configures the middleware pipeline (Auth -> Validation -> Controller) for each endpoint. It also houses the OpenAPI (Swagger) specifications for the Note domain.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Instantiates an Express Router.
- Maps HTTP verbs (`GET`, `POST`, `PATCH`, `DELETE`) to the note controllers.
- Injects the `auth` middleware, passing the specific `:own` scoped permission strings required.
- Injects the `validate` middleware to ensure query parameters and body payloads match the Zod schemas.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `auth.middleware.js`

Used for:

- Enforcing RBAC perimeter security.
  Coupling Level: HIGH.

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `export { router as noteRoutes }`

Called by:

- `src/modules/router.js` (Mounted under `/v1/notes`).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `PATCH /:noteId`

1. Request hits `/v1/notes/cl...123`.
2. **Middleware 1: `auth('update:notes:own')`**
   - The auth middleware verifies the JWT.
   - It checks the cache/database to ensure the user has the `update:notes:own` permission. If not, it rejects with 403.
3. **Middleware 2: `validate(noteValidation.updateNote)`**
   - Zod validates the `req.body` (e.g., ensuring `title` is a string, stripping unknown fields).
   - Zod validates `req.params.noteId` (ensuring it matches the CUID format).
4. **Controller: `noteController.updateNote`**
   - Executes the domain logic.

---

# 7. IMPORTANT CODE EXAMPLES

## Strict Scope Definition

```javascript
router
  .route('/')
  .post(auth('create:notes:own'), validate(noteValidation.createNote), noteController.createNote)
  .get(auth('read:notes:own'), validate(noteValidation.getNotes), noteController.getNotes);
```

**Why this matters:**
Notice that all note routes strictly require the `:own` scope. There are no `:any` endpoints defined here. This mathematically guarantees that no user (not even an Admin) can use these specific routes to view or modify someone else's notes. (If an Admin needs to view all notes in the system, a separate endpoint like `/v1/admin/notes` with `auth('read:notes:any')` would need to be created).

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/notes/note.controller.js`

Responsibility: Execution.
Relationship: The router points traffic to these functions.

---

# 9. DATABASE INTERACTIONS

None directly.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
This file defines the system's Role-Based Access Control matrix for the Notes domain.

---

# 11. VALIDATION FLOW

Explicitly binds Zod validators to routes.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Missing Admin Endpoints

Because there are no `:any` routes, customer support representatives or system administrators currently have no API access to troubleshoot or moderate note content.

---

# 14. EXTENSION POINTS

- **Nested Routing**: If notes get comments, they might be mounted here as `router.use('/:noteId/comments', commentRoutes)`.

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
None. Clean Express routing pattern.
