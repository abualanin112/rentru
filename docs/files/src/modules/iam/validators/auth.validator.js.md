# File Documentation

File:
`src/modules/iam/validators/auth.validator.js`

Domain:
Identity and Access Management (IAM)

Layer:
Validation Layer

Runtime Role:
Defines the strict structural and typological rules (Zod schemas) for all incoming payloads to the Authentication endpoints.

Dependencies:

- `zod`
- `src/shared/CustomValidator.js` (for shared `password` rules)

---

# 2. PURPOSE

Controllers should assume that `req.body` is completely safe. This file acts as the explicit contract between the frontend and the backend.

It defines exactly what fields are allowed, what types they must be, and specific business rules (e.g., minimum password strength). By placing these schemas in a dedicated file, they can be easily unit-tested or even exported to a monorepo for the frontend to share.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Exposes `register`, `login`, `logout`, `refreshTokens`, `forgotPassword`, `resetPassword`, and `verifyEmail` schemas.
- Maps expected data to the Express request structure (`body`, `query`, `params`).
- Applies the shared custom `password` refinement logic.
- Strips any unknown fields sent by the client.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `password` from `CustomValidator.js`

Used for:

- Guaranteeing that password complexity rules (length, alphanumeric requirements) are identical across the entire application.

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `register`, `login`, `logout`, `refreshTokens`, `forgotPassword`, `resetPassword`, `verifyEmail`

Called by:

- `src/modules/iam/routes/auth.route.js` (passed into the `validate` middleware).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `resetPassword`

1. The router executes `validate(resetPassword)`.
2. Zod inspects `req.query.token`. It must be a string.
3. Zod inspects `req.body.password`. It must be a string.
4. Zod applies the `refine(password)` function to the string.
   - If the password is "123", it fails the Regex/length checks.
   - Zod throws an error with the specific custom message: "password must be at least 8 characters...".
5. If everything passes, Zod returns a new object containing _only_ the mapped `query` and `body` fields, stripping everything else.

---

# 7. IMPORTANT CODE EXAMPLES

## Express Object Mapping

```javascript
const resetPassword = z.object({
  query: z.object({
    token: z.string(),
  }),
  body: z.object({
    password: z.string().refine(password, {
      message: 'password must be at least 8 characters and contain at least 1 letter and 1 number',
    }),
  }),
});
```

**Why this matters:**
This schema perfectly mirrors the Express `req` object. Because the HTTP standard uses the URL for the token (`?token=XYZ`) but the Body for the payload, the schema explicitly validates both sources simultaneously. This makes it impossible for a developer to accidentally look for the token in the body instead of the query parameters.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/middleware/validate.middleware.js`

Responsibility: Executor.
Relationship: This file defines the _rules_, but the middleware actually executes them and catches the errors.

---

# 9. DATABASE INTERACTIONS

None.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Prevents NoSQL/SQL injection, cross-site scripting (XSS) via strict string typing, and Mass Assignment.

---

# 11. VALIDATION FLOW

This is the definition of the validation flow.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Lack of Rate Limiting inside Validation

While not strictly a validation concern, very large payloads (e.g., a 10MB string for the password) could theoretically cause Regex Denial of Service (ReDoS) inside Zod's `refine`. A global Express body-parser limit (e.g., `100kb`) is required to protect this layer.

---

# 14. EXTENSION POINTS

- **Stronger Password Rules**: If compliance requires special characters or prevents dictionary words, the `password` custom validator in `shared` is the only place that needs updating.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Data Quality: Ensures the ERP never receives garbage data for core identities.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
None. Zod is the industry standard for this task.
