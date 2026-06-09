# File Documentation

File:
`src/modules/iam/services/auth.service.js`

Domain:
Identity and Access Management (IAM)

Layer:
Domain Service Layer

Runtime Role:
Implements the core business logic and transactional orchestration for user authentication lifecycles (login, logout, token rotation, credential resets).

Dependencies:

- `token.service.js`
- `user.repository.js`
- `token.repository.js`
- `src/infrastructure/prisma.js` (Transactions)
- `src/shared/Password.js` (Bcrypt)
- `src/modules/audit/index.js` (Audit Logging)

---

# 2. PURPOSE

While the `auth.controller.js` handles the HTTP transport, this file contains the actual _rules_ of authentication.

It orchestrates complex, multi-step database interactions (often wrapped in Prisma transactions) to ensure that users are securely logged in, their tokens are rotated properly, and password resets are handled atomically without race conditions.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Validates raw passwords against stored bcrypt hashes.
- Revokes refresh tokens during logout.
- Rotates refresh tokens securely, actively detecting and mitigating Token Reuse attacks.
- Atomically resets passwords while simultaneously invalidating the single-use reset token.
- Verifies email addresses and cleans up associated verification tokens.
- Emits detailed `logEvent` audit trails for all critical security actions.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `user.repository.js` & `token.repository.js`

Used for:

- Executing database operations.
  Coupling Level: HIGH (Domain services directly depend on repositories for persistence).

### `runInTransaction` from `../../../infrastructure/prisma.js`

Used for:

- Guaranteeing atomicity (e.g., changing a password AND deleting the reset token must either both succeed or both fail).

### `logEvent` from `../../audit/index.js`

Used for:

- Writing immutable security audit logs to the database for compliance.

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `loginUserWithEmailAndPassword`, `logout`, `refreshAuth`, `resetPassword`, `verifyEmail`

Called by:

- `src/modules/iam/controllers/auth.controller.js`

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `refreshAuth`

1. Receives the `refreshToken` string from the controller.
2. Opens a Prisma database transaction `runInTransaction(async (tx) => ...)`.
3. Verifies the cryptographic signature of the token and fetches its database record.
4. Fetches the associated user.
5. **Threat Detection**: Checks if `refreshTokenDoc.blacklisted === true`.
   - If true, someone is trying to use an old token.
   - It checks a 2-second grace period (to allow for frontend React `<StrictMode>` race conditions).
   - If outside the grace period, it identifies a **Token Reuse Attack**.
   - It immediately deletes the _entire_ token family (revoking access for the attacker and the victim), logs an `authz.escalation.attempted` audit event, and throws a 401.
6. **Normal Rotation**: If not blacklisted, it updates the current token to `blacklisted: true` (instead of deleting it, which enables the threat detection above).
7. Emits an audit log for the rotation.
8. Generates a new Access/Refresh token pair tied to the exact same `familyId` and returns it.
9. Transaction commits.

---

# 7. IMPORTANT CODE EXAMPLES

## Strict Password Retrieval

```javascript
// Explicitly fetch password using findByEmail with includePassword: true
const user = await findByEmail(email, { includePassword: true });
if (!user || !(await comparePassword(password, user.password))) {
  // ...
}
```

**Why this matters:**
Because `prisma.js` globally omits passwords, a standard `findUnique` will return `undefined` for the password hash. The repository must be explicitly instructed to bypass the omission layer for this specific login function.

## Atomic Password Reset

```javascript
await runInTransaction(async (tx) => {
  // ... verify token ...
  const hashedPassword = await hashPassword(newPassword);

  // Update user password and delete reset tokens atomically
  await updateUserById(user.id, { password: hashedPassword }, tx);
  await deleteManyTokens(
    {
      userId: user.id,
      type: tokenTypes.RESET_PASSWORD,
    },
    tx,
  );
});
```

**Why this matters:**
If the server crashes exactly after updating the password but _before_ deleting the reset token, an attacker could steal the reset token and use it again. Wrapping both in `runInTransaction` ensures the database rolls back the password change if the token deletion fails.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/audit/index.js`

Responsibility: Audit Logging.
Relationship: This service is one of the heaviest producers of Audit events (logins, logouts, password resets are all critical compliance events).

---

# 9. DATABASE INTERACTIONS

Touched Models:

- `User`
- `Token`

Transaction Boundary:

- `refreshAuth`, `resetPassword`, and `verifyEmail` all run inside explicit transaction boundaries.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
This file is the epicenter of authentication security. It implements industry-standard Token Rotation with Reuse Detection, preventing stolen refresh tokens from providing perpetual access.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

Emits detailed structured logs (`auth.login.failed`, `auth.refresh.reuse_detected`) alongside persistent database audit trails.

---

# 13. ARCHITECTURAL RISKS

### Cryptographic Overhead

Bcrypt hashing (`hashPassword`, `comparePassword`) is intentionally CPU-intensive. If an attacker floods the `/login` endpoint, they can starve the Node.js event loop. This relies entirely on `rate-limiter.middleware.js` to protect it.

---

# 14. EXTENSION POINTS

- **Account Lockout**: If an account fails to login 5 times, this file should update the user record to `isLocked: true` to prevent persistent offline cracking attempts.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Credential Security: Ensures passwords and tokens are handled according to strict cryptographic and transactional standards.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
HIGH (Coupled to Prisma transactions and specific Repositories).

Scalability:
MEDIUM (Bcrypt limits throughput).

Primary Concern:
None. The Token Reuse Detection implementation is robust and highly secure.
