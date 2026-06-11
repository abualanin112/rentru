# ADR 0003: Token Rotation with Reuse Detection

## Status

Accepted & Implemented

## Context

We rely on JSON Web Tokens (JWT) for authentication. Access tokens are stateless and short-lived. To maintain long-lived sessions without requiring the user to constantly re-authenticate, we use Refresh Tokens. However, refresh tokens are vulnerable to theft via XSS or database exfiltration.

## Decision

We implemented Refresh Token Rotation combined with strict Reuse Detection tied directly to the `Session` entity.

- **Rotation**: Every time a refresh token is used, a new token is issued and its SHA-256 hash replaces the `refreshTokenHash` in the user's active `Session` record.
- **Strict Single Device Policy**: Rather than token families, the system enforces a strict single device policy via a unique constraint `@@unique([userId])` on the `Session` table.
- **Reuse Detection**: If a refresh token is presented that does not match the `refreshTokenHash` stored in the database, the system evaluates a 2-second concurrency grace period. If outside the grace period, we assume the token was stolen. The system immediately revokes the session by deleting the `Session` record entirely (the Immediate Kill Switch).

## Consequences

- **Positive**: Massively increases session security. A stolen refresh token is useless once the legitimate user refreshes their session, and vice versa. It simplifies database architecture by tying tokens directly to the single active session.
- **Negative**: Requires database lookups and writes for every refresh request. Can cause false positives (revoking a legitimate session) if the frontend sends concurrent refresh requests that exceed the 2-second grace window.
- **Mitigation**: The 2-second grace window absorbs 99% of frontend network race conditions, provided the frontend implements request deduplication/mutex locks during token refreshes.
