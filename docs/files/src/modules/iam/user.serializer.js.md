# File Documentation

File:
`src/modules/iam/user.serializer.js`

Domain:
Identity and Access Management (IAM)

Layer:
Data Transfer Object (DTO) / Presentation Layer

Runtime Role:
Explicitly maps internal database records (Prisma objects) to clean, safe, frontend-ready API responses.

Dependencies:

- None. (Pure JavaScript function).

---

# 2. PURPOSE

If an API controller ends with `res.send(user)`, the entire database row goes to the client. If Prisma adds a new column like `passwordResetToken` or `internalBillingId`, those fields will silently leak to the frontend.

This file implements an **Explicit Whitelist Serializer**. It guarantees that regardless of how the database schema evolves, only the specifically listed fields will ever be transmitted over the network.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Receives a raw `User` object from the controller or database.
- Handles null/undefined safety.
- Constructs a brand new JavaScript object containing _only_ the explicitly defined fields (`id`, `email`, `name`, `isEmailVerified`, `createdAt`, `updatedAt`).
- Intentionally drops `password` and `role`.
- Exposes `serializeUsers` to map arrays of users efficiently.

---

# 4. IMPORT ANALYSIS

This file has no external dependencies. It is a pure, stateless function.

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `serializeUser`, `serializeUsers`

Called by:

- `user.controller.js`
- `auth.controller.js`
- `response-interceptor.middleware.js` (via reference).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow

1. Controller sets `res.locals.serializer = serializeUser`.
2. The `response-interceptor.middleware.js` executes `serializer(payload)`.
3. The function checks `if (!user) return null`.
4. It builds a new object literal mapping key-to-key.
5. Returns the new object.

---

# 7. IMPORTANT CODE EXAMPLES

## Explicit Whitelisting

```javascript
const serializeUser = (user) => {
  if (!user) return null;
  // Explicit whitelist mapping
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isEmailVerified: user.isEmailVerified,
    // explicitly NOT mapping `password` or legacy `role`
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
```

**Why this matters:**
The alternative to whitelisting is blacklisting (e.g., `delete user.password; return user;`). Blacklisting is dangerous because if a developer adds `twoFactorSecret` to the database tomorrow, they will likely forget to add `delete user.twoFactorSecret` to the blacklist, causing a critical security leak. Whitelisting is "Fail-Closed" security. New fields are hidden by default until explicitly added here.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/middleware/response-interceptor.middleware.js`

Responsibility: Application of the serializer.
Relationship: The interceptor natively supports these functions, iterating over arrays automatically if necessary.

---

# 9. DATABASE INTERACTIONS

None.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
This is the final Data Loss Prevention (DLP) layer before the JSON is sent over the TCP socket.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Missing Relational Data

If a controller requests a user _and_ their notes (`populate=notes`), this serializer will strip the `notes` array out of the response entirely because it is not explicitly mapped. Complex relationships often require complex, deeply nested serializers (e.g., calling `serializeNote` inside `serializeUser`).

---

# 14. EXTENSION POINTS

- **Role Serialization**: Currently, the `role` field is stripped because it was marked legacy in the controller. If the frontend needs to know the user's role names, this serializer should be updated to map `user.userRoles.map(ur => ur.role.name)` if that relational data is present.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Privacy Compliance: Guarantees that internal system states or hashed credentials never leak to employee browsers.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH (Pure functions are extremely fast).

Primary Concern:
The inability to serialize nested relations (`notes`) without modifying this core function limits its utility in complex graph queries.
