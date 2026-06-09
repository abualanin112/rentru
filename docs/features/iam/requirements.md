# IAM Requirements

## Functional Requirements

- **Registration**: Users can register using a name, email, and password.
- **Authentication**: Users can log in to receive an Access Token and a Refresh Token.
- **Session Management**: Users can log out, invalidating their current session.
- **Token Rotation**: Users can use a valid Refresh Token to obtain a new token pair. The old refresh token is blacklisted.
- **Reuse Detection**: If a blacklisted Refresh Token is used, the system must revoke the entire token family.
- **Account Recovery**: Users can request a password reset via email.
- **Identity Verification**: Users can verify their email address via a secure token link.
- **User Management**: Administrators can retrieve, update, and delete users.
- **Access Control**: The system must enforce route and resource access based on assigned user roles and granular permissions.

## Non-Functional Requirements

- **Security**: Passwords must be hashed using bcrypt (cost 12).
- **Stateless Access**: Access tokens must be short-lived, cryptographically signed JWTs that do not require database lookups to verify.
- **Data Protection**: User passwords must never be accidentally returned in API responses (enforced via Prisma omit configuration).
- **Rate Limiting**: All `/auth` routes must be strictly rate-limited to prevent brute-force attacks.
- **Atomicity**: Complex operations, such as User Deletion, must occur inside a database transaction to prevent orphaned related data (e.g., Notes).
