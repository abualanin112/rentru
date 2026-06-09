# File Documentation

File:
`src/infrastructure/passport.js`

Domain:
Infrastructure / Security

Layer:
Authentication Integration

Runtime Role:
Configures the JWT strategy for `passport.js` to handle token validation and user hydration for authenticated routes.

Dependencies:

- `passport-jwt`
- `config.js`
- `src/shared/Tokens.js` (Token Types)
- `src/modules/iam/repositories/user.repository.js` (Database Access)

---

# 2. PURPOSE

This file bridges the generic `passport` authentication framework with the application's specific JWT and Database implementation.

Instead of writing custom middleware to parse `Authorization` headers, decode JWTs, verify signatures, and query the database on every authenticated route, this file centralizes that logic into a standardized Passport Strategy.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Extracts the Bearer token from the HTTP `Authorization` header.
- Verifies the cryptographic signature of the token against the `JWT_SECRET`.
- Validates the logical type of the token (rejecting Refresh or Reset Password tokens from accessing standard API routes).
- Queries the database to fetch the underlying User entity associated with the token's `sub` (subject) claim.
- Attaches the hydrated user object to `req.user` for downstream business logic.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `passport-jwt`

Used for:

- Standardized extraction and cryptographic verification of the token.
  Coupling Level: HIGH (Core security logic relies on this).

### `user.repository.js`

Used for:

- Hydrating the user identity from the database.
  Coupling Level: MODERATE. (In a strict layered architecture, infrastructure shouldn't import domain repositories, but Passport strategies often require this pragmatism to avoid circular dependencies).

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `export { jwtStrategy }`

The configured Passport strategy instance.

Called by:

- `src/app.js` (passed to `passport.use('jwt', jwtStrategy)`).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow

1. Strategy receives the incoming HTTP Request.
2. `ExtractJwt.fromAuthHeaderAsBearerToken()` pulls the token.
3. Passport verifies the token signature using `config.jwt.secret`.
4. If the signature is valid, `jwtVerify(payload, done)` is triggered.
5. The payload type is checked. If it's not `ACCESS`, authentication fails.
6. `findById` is called to fetch the user from PostgreSQL.
7. Only essential fields (`id`, `name`, `email`, `isEmailVerified`) are selected to minimize database latency.
8. If the user doesn't exist (e.g., deleted after the token was issued), authentication fails.
9. If successful, `done(null, user)` is called, which tells Passport to attach the user to the Express `req` object and proceed to the next middleware.

---

# 7. IMPORTANT CODE EXAMPLES

## Token Type Validation

```javascript
if (payload.type !== tokenTypes.ACCESS) {
  throw new Error('Invalid token type');
}
```

**Why this matters:**
This prevents a critical security vulnerability known as "Token Confusion." Without this check, a malicious user could take a valid Refresh Token or a Password Reset token (which might have a very long lifespan) and use it as an Access Token to call standard API endpoints.

## Optimized Hydration

```javascript
const user = await findById(payload.sub, {
  select: {
    id: true,
    name: true,
    email: true,
    isEmailVerified: true,
  },
});
```

**Why this matters:**
This query runs on _every single authenticated request_. Doing a full `SELECT *` (which might pull large text fields or join heavy relations) would cripple the database. By strictly selecting only the required fields, memory and bandwidth overhead are minimized.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/middleware/auth.middleware.js`

Responsibility: Route protection.
Relationship: The auth middleware acts as the bridge that explicitly invokes this JWT strategy on protected routes using `passport.authenticate('jwt')`.

---

# 9. DATABASE INTERACTIONS

Touched Models:

- `User`

Transaction Boundary:

- None. This is a read-only query.

Query Patterns:

- High-frequency primary key lookup (`findById`).
- Potential Risks: This is a textbook bottleneck. In high-scale systems, this query is often cached in Redis because querying Postgres 50 times per second for the same user is inefficient.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
This file handles _Authentication_ (Who are you?), not _Authorization_ (Are you allowed to do this?). Once `req.user` is populated, downstream middleware handles RBAC checks.

---

# 11. VALIDATION FLOW

Relies on `passport-jwt` to validate token expiration (`exp` claim) and signature integrity before the `jwtVerify` callback is even fired.

---

# 12. LOGGING & OBSERVABILITY

Currently lacks logging. A failed authentication will bubble up to Passport, which silently rejects it (sending a 401).

---

# 13. ARCHITECTURAL RISKS

### Database Bottleneck

As mentioned, querying the primary database on every single API request for user validation limits the maximum throughput of the API to the maximum throughput of the database.

---

# 14. EXTENSION POINTS

- **Redis Caching**: The `findById` call here is the most critical target for Redis caching in the entire application.
- **Tenant Isolation**: If the ERP moves to a multi-tenant model, the tenant ID must be extracted from the token and attached to `req.user` here.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- System Security: Prevents unauthorized access to ERP endpoints.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
MEDIUM (Coupled to the User repository).

Scalability:
LOW (Due to synchronous DB hit on every request).

Primary Concern:
Needs Redis caching for the User lookup to support high scale.
