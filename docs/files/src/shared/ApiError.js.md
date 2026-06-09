# File Documentation

File:
`src/shared/ApiError.js`

Domain:
Shared Utilities

Layer:
Cross-cutting Core

Runtime Role:
Provides a standardized Error class used to safely bubble HTTP status codes and operational flags up to the global error middleware.

Dependencies:

- None. (Extends native `Error`).

---

# 2. PURPOSE

Standard Node.js `Error` objects only contain a `message` and a `stack`.

When a controller throws an error, the global error handler (`error.middleware.js`) needs to know two critical things:

1. What HTTP Status Code should be sent to the client? (e.g., 404, 400, 500).
2. Is this a predictable business error (`isOperational = true`) or a catastrophic system bug (`isOperational = false`)?

This class extends the native `Error` to encapsulate this routing metadata.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Captures the stack trace correctly, omitting the constructor itself from the trace.
- Stores `statusCode`.
- Stores `isOperational`.
- Utilizes the modern ES2022 `cause` property to wrap lower-level errors without losing their stack traces.

---

# 4. IMPORT ANALYSIS

This file has no dependencies. It is pure JavaScript.

---

# 5. EXPORT ANALYSIS

## Exported Classes

### `ApiError`

Called by:

- Virtually every service and controller in the codebase.

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: Instantiation

1. A service calls `throw new ApiError(404, 'User not found')`.
2. The `super(message, { cause })` call initializes the native Error.
3. `statusCode` is set to 404.
4. `isOperational` defaults to `true`.
5. `Error.captureStackTrace` is called to generate a clean stack trace pointing to where the service threw the error, _not_ pointing to the `ApiError.js` file itself.

---

# 7. IMPORTANT CODE EXAMPLES

## Error Wrapping via `cause`

```javascript
  constructor(statusCode, message, isOperational = true, stack = '', cause = null) {
    super(message, { cause });
    // ...
    if (cause) {
      this.cause = cause;
    }
```

**Why this matters:**
If a database query throws a `PrismaClientKnownRequestError`, you want to catch it and throw an `ApiError(400, 'Invalid relation')` to the client. However, if you simply throw the new error, you lose the original Prisma stack trace, making debugging impossible. By passing `cause: originalError`, Node.js preserves both stack traces in the logs, allowing developers to see the exact sequence of events.

## isOperational Flag

```javascript
this.isOperational = isOperational;
```

**Why this matters:**
In `error.middleware.js`, if `isOperational` is `false`, the system assumes the Node.js process is in an undefined state (e.g., Out Of Memory, disconnected from DB) and gracefully shuts down the container after responding to the user. Setting `isOperational` to `true` (the default) indicates this is a normal business logic violation (like a bad password) and the server can safely continue running.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/middleware/error.middleware.js`

Responsibility: Catching and responding.
Relationship: The middleware is specifically designed to interpret the properties defined by this class.

---

# 9. DATABASE INTERACTIONS

None.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
None directly, but setting `isOperational = false` will prevent the raw database error message from leaking to the frontend in production.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

The structure provided by `ApiError` makes Pino error logs significantly more readable.

---

# 13. ARCHITECTURAL RISKS

### Overuse in Domain Logic

Currently, services throw `ApiError`. This couples the Domain layer strictly to HTTP concepts (`statusCode`, 404, 400). In a pure Clean Architecture, the domain should throw domain-specific errors (e.g., `UserNotFoundError`), and the Controller should catch that and map it to an `ApiError(404)`. However, in a pragmatic Modular Monolith, allowing services to throw HTTP codes directly is a common and acceptable shortcut to reduce boilerplate.

---

# 14. EXTENSION POINTS

- **Translation Keys**: An enterprise extension would be adding a `translationKey` (e.g., `error.auth.user_not_found`) to the constructor so the frontend can dynamically translate the error message into the user's local language.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Developer Experience & Reliability: Ensures that errors are handled predictably and cleanly across the entire organization.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
None. Standard and effective custom Error implementation.
