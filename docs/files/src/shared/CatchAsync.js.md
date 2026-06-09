# File Documentation

File:
`src/shared/CatchAsync.js`

Domain:
Shared Utilities

Layer:
Cross-cutting Core

Runtime Role:
A higher-order function that wraps Express middleware and controllers, automatically catching any unhandled Promise rejections and routing them to the Express `next()` function.

Dependencies:

- None.

---

# 2. PURPOSE

Express 4.x does not natively support async/await error handling. If an `async` controller throws an error (e.g., a database connection fails) and it is not explicitly wrapped in a `try/catch` block, the Node.js process will crash with an `UnhandledPromiseRejection`, or the HTTP request will hang indefinitely until it times out.

This utility prevents developers from having to write `try/catch` boilerplate in every single controller.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Takes an asynchronous function (`fn`) as an argument.
- Returns a new Express middleware signature `(req, res, next)`.
- Wraps the execution of `fn` in a `Promise.resolve()`.
- Catches any errors and passes them to `next(err)`.

---

# 4. IMPORT ANALYSIS

This file has no dependencies.

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `catchAsync`

Called by:

- Every controller in the application (e.g., `user.controller.js`, `note.controller.js`).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow

1. Controller file is parsed by Node.js.
2. `catchAsync` receives the raw `async (req, res, next)` function.
3. It returns a standard closure to the Express router.
4. When a request hits the route, Express executes the closure.
5. The closure executes the async function.
6. If the function succeeds, it typically calls `next()` internally or sends a response.
7. If the function throws (e.g., `throw new ApiError(...)`), the `.catch((err) => next(err))` block intercepts the error.
8. Express routes the error to `error.middleware.js`.

---

# 7. IMPORTANT CODE EXAMPLES

## The Boilerplate Killer

```javascript
export const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => next(err));
};
```

**Why this matters:**
Without this file, every controller would look like this:

```javascript
const createNote = async (req, res, next) => {
  try {
    const note = await createNoteService(req.body);
    res.send(note);
  } catch (err) {
    next(err);
  }
};
```

With `catchAsync`, it becomes a clean, declarative two-liner:

```javascript
const createNote = catchAsync(async (req, res, next) => {
  const note = await createNoteService(req.body);
  res.send(note);
});
```

---

# 8. CROSS-FILE RELATIONSHIPS

### Controllers

Responsibility: Wrapping all domain controllers.
Relationship: This is a foundational utility that almost every route handler relies upon.

---

# 9. DATABASE INTERACTIONS

None.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Prevents application crashes (Denial of Service) caused by unhandled promise rejections.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

None. Defers error logging to the global error handler.

---

# 13. ARCHITECTURAL RISKS

### Express 5 Upgrade

Express 5.x introduces native support for asynchronous promise rejections. When the framework is upgraded to v5, this file will become completely obsolete and should be aggressively removed from the codebase to reduce indirection.

---

# 14. EXTENSION POINTS

- None. This function is complete and should not be modified.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- System Reliability: Ensures the API never hangs.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
Needs to be removed when migrating to Express 5.
