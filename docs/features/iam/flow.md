# IAM Flows

## 1. Authentication Flow (Login)

1. **Client Request**: `POST /v1/auth/login` with `{ email, password }`.
2. **Validation**: Zod schema validates input format.
3. **Verification**: `auth.service` fetches User by email (explicitly including password hash) and compares via bcrypt.
4. **Token Generation**: `token.service` generates:
   - Stateless JWT Access Token.
   - Hashed JWT Refresh Token (stored in DB with a unique `familyId`).
5. **Audit**: `auth.login` event is logged.
6. **Response**: Tokens and User object (sans password) returned to client.

## 2. Session Refresh Flow (Rotation & Reuse Detection)

1. **Client Request**: `POST /v1/auth/refresh-tokens` with `{ refreshToken }`.
2. **Verification**: JWT signature validated. Hash looked up in the DB.
3. **Check Status**:
   - **If Valid & Not Blacklisted**: Old token is marked as `blacklisted: true`. A new token pair is generated using the same `familyId`.
   - **If Valid & Blacklisted**: REUSE DETECTED.
     - A 2-second grace period is evaluated for concurrent network requests.
     - If outside the grace period, the **entire token family is revoked** (deleted).
     - `auth.refresh.reuse_detected` audit event is logged.
     - `401 Unauthorized` is returned.

## 3. Authorization Flow (RBAC)

1. **Client Request**: Client sends request with `Authorization: Bearer <Access Token>`.
2. **Authentication Middleware**: Passport JWT strategy validates token and fetches basic user info.
3. **Authorization Middleware** (`auth.middleware.js`):
   - Receives required permissions for the route (e.g., `update:notes:own`).
   - Resolves the user's assigned Roles and Permissions from the DB (or LRU cache).
   - Checks if the user possesses the required permission or a superseding permission (e.g., `update:notes:any` or `*:*:*`).
   - If missing, `403 Forbidden` is returned.
4. **Service Execution**:
   - Route controller calls the service layer.
   - Service asserts ownership logic if the permission was scoped to `:own`.

## 4. Cascading Deletion Flow

1. **Client Request**: `DELETE /v1/users/:userId`.
2. **Transaction Start**: Prisma `$transaction` begins.
3. **Hooks Execution**: `userService` fires registered hooks (e.g., `deleteManyByOwnerId` from the Notes module).
4. **Entity Deletion**: The User record is deleted. Associated `Token` and `UserRole` records cascade automatically via FKs.
5. **Audit**: `user.deleted` event is logged within the same transaction.
6. **Transaction Commit**: If all steps succeed, commit. If any fail, rollback.
