# File Documentation

File:
`src/shared/CustomValidator.js`

Domain:
Shared Utilities

Layer:
Validation Layer

Runtime Role:
Provides centralized, reusable validation logic (like Password Complexity and Database ID formats) to ensure consistency across the application.

Dependencies:

- `zod`

---

# 2. PURPOSE

If the password complexity rules change from "8 characters" to "12 characters with a symbol," developers should not have to hunt down validation schemas in `auth.validator`, `user.validator`, and `admin.validator`.

This file centralizes those core business rules so they can be written and tested once, and imported anywhere.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Exposes a raw `cuid2` regex test function.
- Exposes a `cuid2Schema` factory function that returns a pre-configured Zod string validation with a custom error message.
- Exposes a raw `password` validation function that enforces length and alphanumeric requirements.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `zod`

Used for:

- Constructing the `ZodEffects` refinement for the CUID schema.
  Coupling Level: HIGH (Coupled to the validation library).

---

# 5. EXPORT ANALYSIS

## Exported Variables / Functions

### `cuid2`, `cuid2Schema`, `password`

Called by:

- `src/modules/iam/validators/*`
- `src/modules/notes/note.validator.js`

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `cuid2Schema('noteId')`

1. A domain validator calls the factory: `noteId: cuid2Schema('noteId')`.
2. The factory returns a `z.string().refine(...)` chain.
3. During runtime validation, Zod evaluates the string against the `cuid2` regex: `/^[a-z][a-z0-9]{24}$/`.
4. If it fails, Zod throws the custom message: `'"noteId" must be a valid CUID2 identifier'`.

---

# 7. IMPORTANT CODE EXAMPLES

## CUID2 Regex Protection

```javascript
const cuid2 = (value) => {
  // CUID2 pattern: 25 alphanumeric characters starting with a lowercase letter
  return /^[a-z][a-z0-9]{24}$/.test(value);
};
```

**Why this matters:**
CUIDs (Collision Resistant Unique Identifiers) are the primary keys for the entire database. If the API allowed classic UUIDs (`123e4567-e89b-12d3...`) to pass the validation layer, Prisma would attempt to execute the query and throw a `P2023` database error. Validating this at the application edge prevents unnecessary database connections and provides a much cleaner error message to the client.

## Reusable Zod Factories

```javascript
const cuid2Schema = (fieldName = 'identifier') => {
  return z.string().refine(cuid2, {
    message: `"${fieldName}" must be a valid CUID2 identifier`,
  });
};
```

**Why this matters:**
This allows domain validators to easily customize the error message based on the parameter they are validating, without rewriting the regex logic.

---

# 8. CROSS-FILE RELATIONSHIPS

### Domain Validators

Responsibility: Using these building blocks.
Relationship: The entire validation strategy rests on these custom primitives.

---

# 9. DATABASE INTERACTIONS

None directly, but strictly enforces primary key structure before database access.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Prevents NoSQL/SQL injection and malformed parameter attacks.

---

# 11. VALIDATION FLOW

This is the core of the validation definitions.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Basic Password Rules

The current password rule `!value.match(/\d/) || !value.match(/[a-zA-Z]/)` only guarantees 1 number and 1 letter. For an enterprise ERP, this usually needs to be expanded to require uppercase letters and special symbols to meet SOC2/ISO27001 requirements.

---

# 14. EXTENSION POINTS

- **Email Denylisting**: If the company decides to ban registration from disposable email providers (like Mailinator), an `emailValidator` should be added here to run the address against a blocked-domain list.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Input Governance: Ensures foundational data types are identical across all domains.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
Password constraints are slightly weak for enterprise standards.
