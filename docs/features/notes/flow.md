# Notes Flows

## 1. Creation Flow

1. **Request**: `POST /v1/notes` with body `{ title, content, tags? }`.
2. **Authorization**: Middleware checks for `create:notes:own` permission.
3. **Execution**: `note.service` creates the Note, assigning `ownerId` from the authenticated user.
4. **Audit**: A `notes.created` event is logged containing the Note ID and actor ID.
5. **Response**: Note object returned (201 Created).

## 2. Reading & Searching Flow (Cursor Pagination)

1. **Request**: `GET /v1/notes` with optional query params `search`, `archived`, `limit`, `sortBy`, `cursor`.
2. **Authorization**: Middleware checks for `read:notes:own`.
3. **Execution**: `note.service` builds a Prisma query:
   - Always applies `ownerId = req.user.id`.
   - If `search` is provided, applies PostgreSQL full-text search vector matching.
   - If `cursor` is provided, fetches the next batch using cursor-based keyset pagination.
4. **Response**: Note array and pagination metadata returned (200 OK).

## 3. Update / Archiving Flow

1. **Request**: `PATCH /v1/notes/:noteId` with updated fields (e.g., `archived: true`).
2. **Authorization**: Middleware checks for `update:notes:own`.
3. **Execution**: `note.service` queries the Note by ID.
4. **Ownership Check**: Service explicitly verifies `note.ownerId === req.user.id` (unless the user has `update:notes:any` admin override).
5. **Mutation**: Note is updated in the database.
6. **Audit**: A `notes.updated` event is logged.
7. **Response**: Updated Note returned.

## 4. Hook-Triggered Deletion Flow (User Deletion)

1. **Trigger**: IAM module initiates a user deletion transaction.
2. **Hook Callback**: IAM invokes `deleteManyByOwnerId` (registered in the composition root `router.js`).
3. **Execution**: `note.repository` executes `deleteMany` for the given `ownerId`, injecting the provided Prisma transaction client.
4. **Commit**: If the user deletion succeeds, the notes are hard-deleted.
