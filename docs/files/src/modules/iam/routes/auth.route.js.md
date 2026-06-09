# File Documentation

File:
`src/modules/iam/routes/auth.route.js`

Domain:
Identity and Access Management (IAM)

Layer:
Transport / Routing Layer

Runtime Role:
Binds HTTP endpoints (URLs) to specific authentication controller methods and orchestrates the middleware pipeline (Validation, Rate Limiting, Authentication) for each route.

Dependencies:

- `express.Router`
- `auth.middleware.js`
- `validate.middleware.js`
- `rate-limiter.middleware.js`
- `auth.validator.js`
- `auth.controller.js`

---

# 2. PURPOSE

The routing layer acts as the blueprint of the API. It explicitly defines what URLs are available, what HTTP methods they accept, and the exact sequence of middleware required before the business logic is allowed to execute.

Furthermore, this file houses the OpenAPI (Swagger) specifications for these endpoints, ensuring the documentation lives immediately adjacent to the code it describes.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Instantiates an Express Router.
- Maps `POST /register`, `POST /login`, etc., to their respective controller functions.
- Injects the `validate` middleware with the appropriate Zod schema for every endpoint.
- Injects the `auth` middleware for endpoints that require an existing session (e.g., `send-verification-email`).
- Applies the `refreshLimiter` rate limit to the `/refresh-tokens` endpoint.
- Exports the configured router for mounting by the Composition Root (`router.js`).

---

# 4. IMPORT ANALYSIS

## Important Imports

### `validate.middleware.js` & `auth.validator.js`

Used for:

- Guaranteeing that payloads like `req.body.email` and `req.body.password` exactly match the schema before the controller executes.
  Coupling Level: HIGH (Routing and Validation are tightly bound).

### `rate-limiter.middleware.js`

Used for:

- Explicitly protecting sensitive endpoints from brute force.

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `export { router as authRoutes }`

Called by:

- `src/modules/router.js` (Mounted under `/v1/auth`).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `POST /refresh-tokens`

1. Request hits the Express app and is routed to `/v1/auth/refresh-tokens`.
2. **Middleware 1: `refreshLimiter`**
   - Checks if this IP has requested too many refreshes in the last 15 minutes. If so, aborts with 429.
3. **Middleware 2: `validate(authValidation.refreshTokens)`**
   - Checks if `req.body.refreshToken` exists and is a valid string. If not, aborts with 400.
4. **Controller: `authController.refreshTokens`**
   - All defensive checks have passed. The controller executes the domain logic.

---

# 7. IMPORTANT CODE EXAMPLES

## Route Definition Pipeline

```javascript
router.post('/refresh-tokens', refreshLimiter, validate(authValidation.refreshTokens), authController.refreshTokens);
```

**Why this matters:**
This single line clearly defines the perimeter defense. Notice the explicit placement of `refreshLimiter` _before_ the validation step. This saves CPU cycles: if an IP is being rate-limited, there is no need to run the (slightly more expensive) Zod validation engine.

## Swagger Documentation

```javascript
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login
 *     tags: [Auth]
 *     ...
 */
```

**Why this matters:**
By colocating the Swagger JSDoc blocks directly inside the route file, developers are far more likely to update the documentation when they change the route parameters or response shapes, preventing drift between the implementation and the API contract.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/router.js`

Responsibility: Central route aggregation.
Relationship: Imports this router to mount it onto the global API path.

---

# 9. DATABASE INTERACTIONS

None directly.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Enforces validation and rate-limiting. Also enforces `auth()` for routes that require an authenticated user (e.g., verifying an email after login).

---

# 11. VALIDATION FLOW

Explicitly binds Zod validators to routes.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Global Rate Limits

While `/refresh-tokens` has `refreshLimiter`, `/login` and `/register` do not explicitly mount the `authLimiter` here. Looking at `src/modules/router.js` from Phase 1, `authLimiter` is mounted globally on the `/auth` path. This split (mounting some limiters globally and some on specific routes) can be confusing and lead to double-limiting or missed limits.

---

# 14. EXTENSION POINTS

- **OAuth 2.0 / SSO**: If Google or SAML login is added, new endpoints (e.g., `GET /google/callback`) would be defined here, hooking into Passport's OAuth strategies.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- API Surface Area: Defines exactly how frontend clients interact with the Authentication subsystem.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
The rate-limiter logic is slightly fragmented between this file and the global `router.js` composition root.
