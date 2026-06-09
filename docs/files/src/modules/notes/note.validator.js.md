# File Documentation

File:
`src/modules/notes/note.validator.js`

Domain:
Notes / Core Business Logic

Layer:
Validation Layer

Runtime Role:
Defines the Zod schemas for Note entity CRUD endpoints, explicitly handling text constraints and cursor-based pagination types.

Dependencies:

- `zod`
- `cuid2Schema` from `src/shared/CustomValidator.js`

---

# 2. PURPOSE

Because notes contain arbitrary text entered by end users, they are a primary vector for injection attacks and denial-of-service (via excessively large payloads).

This file strictly constraints the `title` and `content` fields (e.g., maximum length of 10,000 characters). It also validates the cursor payload for the pagination endpoint, ensuring that random strings cannot be passed as CUID cursors.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Validates creation payloads (`title`, `content`, `archived`, `tags`).
- Automatically transforms tag arrays to lowercase strings.
- Enforces min/max length constraints to protect the database from overflow.
- Validates query strings (`getNotes`), enforcing `cursor` to be a valid CUID.
- Implements a safety refinement on `updateNote` to ensure the client actually provided at least one field to update.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `cuid2Schema`

Used for:

- Validating the `noteId` parameter and the pagination `cursor`.
  Coupling Level: HIGH (Coupled to the DB primary key format).

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `createNote`, `getNotes`, `getNote`, `updateNote`, `deleteNote`

Called by:

- `src/modules/notes/note.route.js`

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `createNote`

1. The validation middleware intercepts `POST /notes`.
2. Zod evaluates `req.body.title`. Trims whitespace. Checks `min(3)` and `max(200)`.
3. Zod evaluates `req.body.content`. Trims whitespace. Checks `min(1)` and `max(10000)`.
4. Zod evaluates `req.body.tags`. If provided, ensures it is an array. Trims and lowercases every string in the array automatically.
5. Returns the cleansed, lowercased, trimmed object to the controller.

---

# 7. IMPORTANT CODE EXAMPLES

## Automatic Normalization

```javascript
tags: z.array(z.string().trim().toLowerCase()).optional();
```

**Why this matters:**
This is an excellent use of Zod's transformation capabilities. If a user sends `{ tags: [" React ", "NODEJS"] }`, Zod will intercept it and output `{ tags: ["react", "nodejs"] }`. This prevents the database from storing identical tags with different casing, which would break search and grouping features later.

## Cursor Validation

```javascript
const getNotes = z.object({
  query: z.object({
    search: z.string().optional(),
    archived: z.enum(['true', 'false']).optional(),
    sortBy: z.string().optional(),
    limit: z.coerce.number().int().positive().optional(),
    cursor: cuid2Schema('cursor').optional(),
  }),
});
```

**Why this matters:**
Unlike offset pagination which uses integers (`?page=2`), cursor pagination uses the ID of the last seen item (`?cursor=cl...123`). Validating that this cursor is an exact CUID string before passing it to Prisma prevents database execution errors. Notice that `archived` is forced to an enum of string literals (`'true'`, `'false'`) because Express query parameters are always strings, bypassing Zod's strict boolean check.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/notes/note.route.js`

Responsibility: Routing.
Relationship: Passes these schemas into the validation middleware.

---

# 9. DATABASE INTERACTIONS

None directly.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Prevents Payload Overflow (DOS) by capping content length at 10,000 characters.

---

# 11. VALIDATION FLOW

Explicitly defines the rules.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Query Boolean Coercion

The `archived: z.enum(['true', 'false'])` validation works, but the controller now has to manually parse this string: `filter.archived = req.query.archived === 'true'`. Zod provides a `.transform()` method that could cleanly convert the string literal into a real JS boolean here in the validation layer, simplifying the controller.

---

# 14. EXTENSION POINTS

- **Rich Text Formats**: If the app moves to Markdown or Slate.js, the `content` validator might need to be changed to an `object` or `array` schema rather than a flat string.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- System Stability: Ensures large text blobs don't crash the database.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
None. Clean use of Zod modifiers.
