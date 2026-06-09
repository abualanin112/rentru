# Authentication & Security Wiki

## Strategy

The system utilizes a **stateless/stateful hybrid** authentication architecture driven by Passport.js and JWTs, with database-backed token management.

### Mechanism

1. **Passport-JWT**: Passport is configured to extract Bearer tokens from the `Authorization` header.
2. **Token Types**:
   - `ACCESS`: Short-lived JWT.
   - `REFRESH`: Long-lived token stored in the database.
   - `RESET_PASSWORD` / `VERIFY_EMAIL`: Ephemeral task tokens.

## Token Lifecycle

1. **Login**: User authenticates via email/password (`iam/controllers/auth.controller.js`).
2. **Generation**: An Access Token (JWT) and a Refresh Token (stored in DB) are generated. The Refresh Token is grouped by a `familyId` to represent a specific "session" or device.
3. **Verification**: `passport.js` decodes the JWT, verifies the signature using `config.jwt.secret`, checks expiration, and retrieves the User via `findById`.
4. **Refresh**: When the access token expires, the client submits the refresh token. The system verifies it against the `Token` DB table. If valid, a new token pair is issued, and the old refresh token is marked as blacklisted or deleted (token rotation).

## Security Boundaries

### Token Invalidation

Because JWTs are inherently stateless until expiration, instant invalidation is handled via the Refresh Token architecture:

- **Mass Revocation**: Filtering by `familyId` allows invalidation of a complete user session (all devices).
- **Compromise Mitigation**: If a reused/blacklisted refresh token is presented, the system can revoke the entire `familyId`.

### Privilege Escalation Prevention

- **RBAC Hierarchy**: The `Role` model utilizes a `level` integer. This is a critical design choice for ERP systems to prevent lower-tier admins from creating roles with higher privileges than their own.

### Attack Surface Mitigations

- **Brute Force**: Express Rate Limiter is applied globally to `/v1`, with a stricter limiter specifically for auth routes.
- **Token Leakage**: `pino` logger aggressively redacts all `authorization` headers and password fields.
- **XSS/CSRF**: Assuming standard practices, though tokens are delivered as JSON payloads (susceptible to XSS if stored in localStorage). For maximum security, transitioning to `HttpOnly` cookies for the refresh token is recommended for production.
