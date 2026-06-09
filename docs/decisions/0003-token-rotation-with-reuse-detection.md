# ADR 0003: Token Rotation with Reuse Detection

## Status

Accepted & Implemented

## Context

We rely on JSON Web Tokens (JWT) for authentication. Access tokens are stateless and short-lived. To maintain long-lived sessions without requiring the user to constantly re-authenticate, we use Refresh Tokens. However, refresh tokens are vulnerable to theft via XSS or database exfiltration.

## Decision

We implemented Refresh Token Rotation combined with strict Reuse Detection.

- **Rotation**: Every time a refresh token is used, it is marked as `blacklisted: true` in the database, and a new token is issued.
- **Family Grouping**: Tokens are grouped by a `familyId`.
- **Reuse Detection**: If a blacklisted token is presented to the `/refresh-tokens` endpoint outside of a 2-second concurrency grace period, we assume the token was stolen. The system immediately revokes the **entire token family** by deleting all tokens sharing that `familyId`.

## Consequences

- **Positive**: Massively increases session security. A stolen refresh token is useless once the legitimate user refreshes their session, and vice versa.
- **Negative**: Requires database lookups and writes for every refresh request. Can cause false positives (revoking a legitimate session) if the frontend sends concurrent refresh requests that exceed the 2-second grace window.
- **Mitigation**: The 2-second grace window absorbs 99% of frontend network race conditions.
