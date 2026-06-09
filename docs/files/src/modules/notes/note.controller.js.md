# File Documentation

File:
`src/modules/notes/note.controller.js`

Domain:
Notes / Core Business Logic

Layer:
Transport / Controller Layer

Runtime Role:
HTTP transport logic for Note CRUD operations. Enforces strict Attribute-Based Access Control (ABAC) to guarantee users can only interact with their own notes.

Dependencies:

- `note.service.js`
- `note.serializer.js`
- `CatchAsync`
- `ApiError`

---

# 2. PURPOSE

This controller serves as the primary HTTP entrypoint for the application's core business domain: managing notes.

It differs from the IAM controllers because it enforces a hard multi-tenant isolation pattern. Instead of relying on an external `authorizationService` to check if a user _can_ access a note, this controller explicitly hardcodes the `ownerId` into all database filters and actively suppresses information disclosure if an IDOR attempt is detected.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Extracts pagination and search parameters.
- Hardcodes `req.user.id` as the `ownerId` into all queries.
- Verifies ownership on reads, updates, and deletes.
- If a user tries to access a note they don't own, throws a generic `404 Not Found` (instead of 403 Forbidden) to prevent attackers from enumerating valid Note IDs.
- Sets `res.locals.payload` and assigns the `serializeNote` DTO mapper.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `note.service.js`

Used for:

- Executing domain operations.
  Coupling Level: HIGH.

### `serializeNote`

Used for:

- Stripping internal/sensitive fields before returning the response.

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `createNote`, `getNotes`, `getNote`, `updateNote`, `deleteNote`

Called by:

- `src/modules/notes/note.route.js`

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `getNotes` (List)

1. Receives the `GET /notes` request.
2. Initializes the filter object: `{ ownerId: req.user.id }`. This ensures no other user's notes can ever be returned.
3. Checks for `archived` or `search` query parameters and appends them to the filter.
4. Constructs the pagination options (sorting, limits, and cursor).
5. Calls `queryNotes(filter, options)`.
6. Attaches the result to `res.locals.payload` and `res.locals.serializer`.
7. Calls `next()`.

## Execution Flow: `updateNote`

1. Receives `PATCH /notes/:noteId`.
2. Fetches the existing note using `getNoteById(req.params.noteId)`.
3. Validates existence AND ownership:
   ```javascript
   if (!existingNote || existingNote.ownerId !== req.user.id) {
     throw new ApiError(httpStatus.NOT_FOUND, 'Note not found');
   }
   ```
4. If passed, calls `updateNoteById`.
5. Passes to interceptor.

---

# 7. IMPORTANT CODE EXAMPLES

## Information Disclosure Prevention

```javascript
// Return 404 for both missing notes AND notes owned by another user
// (avoids information disclosure about note existence)
if (!note || note.ownerId !== req.user.id) {
  throw new ApiError(httpStatus.NOT_FOUND, 'Note not found');
}
```

**Why this matters:**
If an attacker loops through random CUIDs hitting `GET /notes/:id`, and the API returns `403 Forbidden` for a valid ID but `404 Not Found` for an invalid ID, the attacker can map out exactly which IDs exist in the database (even if they can't read them). Returning `404` for _both_ scenarios completely blinds the attacker.

## Tenant Isolation

```javascript
const filter = {
  ownerId: req.user.id,
};
```

**Why this matters:**
This makes data leakage virtually impossible on list views. Even if the database or the service layer has a bug, the query itself is strictly constrained to the authenticated user's ID at the transport perimeter.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/notes/note.route.js`

Responsibility: Routing.
Relationship: The route maps HTTP methods to these functions.

---

# 9. DATABASE INTERACTIONS

None directly. Defers to `note.service.js`.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Prevents IDOR (Insecure Direct Object Reference) and Information Enumeration.

---

# 11. VALIDATION FLOW

Validation occurs upstream in the router.

---

# 12. LOGGING & OBSERVABILITY

Handled by the service layer.

---

# 13. ARCHITECTURAL RISKS

### Manual Isolation Checks

The pattern `if (!note || note.ownerId !== req.user.id)` is repeated in `getNote`, `updateNote`, and `deleteNote`. If a developer adds a new method (e.g., `archiveNote`) and forgets this check, an IDOR vulnerability is introduced. Abstracting this into a shared policy or middleware might reduce risk.

---

# 14. EXTENSION POINTS

- **Shared Notes**: If the application eventually supports "collaborative notes", this controller will need to be rewritten to check a `NoteShares` junction table rather than just the strict `ownerId`.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Core Product Delivery: Handles the primary business value of the application (creating and managing notes).

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
None. Excellent use of the 404 obfuscation pattern for security.
