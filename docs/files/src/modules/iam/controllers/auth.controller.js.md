# File Documentation

File:
`src/modules/iam/controllers/auth.controller.js`

Domain:
Identity and Access Management (IAM)

Layer:
Transport / Controller Layer

Runtime Role:
Orchestrates HTTP requests related to user authentication lifecycles (registration, login, token rotation, and credential recovery).

Dependencies:

- `authService`
- `userService`
- `tokenService`
- `emailService`
- `serializeUser`
- `CatchAsync`

---

# 2. PURPOSE

Controllers should contain zero business logic. Their sole purpose is to act as the HTTP traffic director.

This file receives validated DTOs from the Express router, orchestrates the necessary domain services (often multiple services in sequence, like creating a user _and then_ generating tokens), and packages the result into `res.locals` for the global `response-interceptor` to format and send back to the client.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Extracts data from `req.body` and `req.query`.
- Extracts client metadata (`req.ip`, `User-Agent`) for secure token generation.
- Dispatches commands to the IAM domain services.
- Manages HTTP status codes (e.g., setting `201 Created` or `204 No Content`).
- Delegates the serialization of the User entity to `serializeUser` before sending it to the client, ensuring password hashes are not leaked.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `*Service` from `../services/index.js`

Used for:

- Executing domain logic.
  Coupling Level: HIGH. (Orchestrates `authService`, `userService`, `tokenService`, `emailService`).

### `serializeUser`

Used for:

- Stripping internal/sensitive fields from the user record before placing it in the response payload.

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `register`, `login`, `logout`, `refreshTokens`, `forgotPassword`, `resetPassword`, `sendVerificationEmail`, `verifyEmail`

Called by:

- `src/modules/iam/routes/auth.route.js`

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `register`

1. Extracts the validated user creation DTO from `req.body`.
2. Calls `userService.createUser(req.body)` which saves the record to the database.
3. Calls `tokenService.generateAuthTokens()` to instantly log the user in, passing the IP and User-Agent for token binding/auditing.
4. Sets the HTTP status to `201 CREATED`.
5. Prepares the payload containing the `serializeUser(user)` and the `tokens`.
6. Calls `next()` to pass control to the `response-interceptor`.

```mermaid
graph TD
    Router[auth.route.js] --> Controller[register]
    Controller --> UserService[userService.createUser]
    UserService --> Db[(Database)]
    Db --> UserService
    UserService --> Controller
    Controller --> TokenService[tokenService.generateAuthTokens]
    TokenService --> Controller
    Controller --> Interceptor[Sets res.locals & next()]
```

---

# 7. IMPORTANT CODE EXAMPLES

## Service Orchestration

```javascript
const register = catchAsync(async (req, res, next) => {
  const user = await userService.createUser(req.body);
  const tokens = await tokenService.generateAuthTokens(user, undefined, null, req.ip, req.get('User-Agent'));
  res.locals.statusCode = httpStatus.CREATED;
  res.locals.payload = { user: serializeUser(user), tokens };
  next();
});
```

**Why this matters:**
This perfectly illustrates the Controller pattern. It doesn't know _how_ a user is created, or _how_ tokens are signed. It simply reads the HTTP request, calls the appropriate domain logic in the correct order, and formats the HTTP response. Notice the extraction of `req.ip` and `req.get('User-Agent')`—transport details are extracted here because Domain Services should never be passed Express `req` objects directly.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/iam/routes/auth.route.js`

Responsibility: Routing.
Relationship: Binds these controller functions to specific URL endpoints and attaches the validation middleware.

### `src/middleware/response-interceptor.middleware.js`

Responsibility: Response Formatting.
Relationship: By setting `res.locals.payload` and calling `next()`, this controller explicitly defers HTTP serialization to the interceptor.

---

# 9. DATABASE INTERACTIONS

None directly. All database interaction is deferred to the Service/Repository layers.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:

- Protects downstream services from knowing about HTTP headers by explicitly extracting only what is needed (IP, User-Agent).
- Explicitly enforces serialization (`serializeUser(user)`) before the payload leaves the controller.

---

# 11. VALIDATION FLOW

Validation is guaranteed to have already occurred via `validate.middleware.js` in the router before these functions execute. `req.body` is completely trusted at this stage.

---

# 12. LOGGING & OBSERVABILITY

Errors are caught by the `catchAsync` wrapper and forwarded to the global error handler.

---

# 13. ARCHITECTURAL RISKS

### Synchronous Side-Effects

The `forgotPassword` endpoint `await`s the `emailService.sendResetPasswordEmail`. If the SMTP server is slow, the HTTP request hangs. This is a known risk in `mailer.js` and bubbles up to this controller.

---

# 14. EXTENSION POINTS

- **MFA / 2FA**: If Multi-Factor Authentication is added, the `login` controller will need to be modified to check if the user requires MFA, and if so, return a temporary `mfa_token` instead of full access tokens.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- System Entry: Acts as the absolute front door to the ERP. Every employee or API client must pass through this orchestration logic to obtain access.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW (Coupled only to domain abstractions, not implementations).

Scalability:
HIGH.

Primary Concern:
None. The code is exceptionally clean and perfectly respects architectural layer boundaries.
