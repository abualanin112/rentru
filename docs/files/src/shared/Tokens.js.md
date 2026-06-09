# File Documentation

File:
`src/shared/Tokens.js`

Domain:
Shared Utilities

Layer:
Constants

Runtime Role:
Provides a centralized, strongly-typed dictionary for the different types of JWTs issued by the system.

Dependencies:

- None.

---

# 2. PURPOSE

"Magic strings" (e.g., typing `'access'` or `'resetPassword'` directly into code) are the source of many critical bugs. If a developer typos `'resetpassword'` when generating a token, and another developer checks for `'resetPassword'` during validation, the system will break silently.

This file exports a constant object that acts as an Enum, ensuring that token types are uniform across validation, generation, and database storage.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Holds exactly four string constants: `ACCESS`, `REFRESH`, `RESET_PASSWORD`, `VERIFY_EMAIL`.

---

# 4. IMPORT ANALYSIS

This file has no dependencies.

---

# 5. EXPORT ANALYSIS

## Exported Variables

### `tokenTypes`

Called by:

- `src/modules/iam/services/token.service.js` (Injects into JWT payload)
- `src/modules/iam/services/auth.service.js` (Validates against this type)

---

# 6. INTERNAL EXECUTION FLOW

N/A. This is a constant dictionary.

---

# 7. IMPORTANT CODE EXAMPLES

## Strict Type Enforcement

```javascript
const tokenTypes = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  RESET_PASSWORD: 'resetPassword',
  VERIFY_EMAIL: 'verifyEmail',
};
```

**Why this matters:**
When `token.service.js` generates a reset token, it embeds `tokenTypes.RESET_PASSWORD` into the JWT payload (`type` claim). When `auth.service.js` verifies the token, it asserts that the claim exactly matches `tokenTypes.RESET_PASSWORD`. This prevents a malicious user from taking a `VERIFY_EMAIL` token they received in their inbox, and submitting it to the `/v1/auth/reset-password` endpoint.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/iam/services/token.service.js`

Responsibility: Generation.
Relationship: Injects these constants into the cryptographic signing payload.

---

# 9. DATABASE INTERACTIONS

The values here are directly mapped to the `type` column in the `tokens` database table.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Prevents Token Confusion attacks by strictly segregating token utility.

---

# 11. VALIDATION FLOW

None natively, but acts as the source of truth for validation checks.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

None.

---

# 14. EXTENSION POINTS

- **MFA Tokens**: If Multi-Factor Authentication is added, an `MFA_SETUP` and `MFA_VERIFY` type would be added here.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Security Logic: Ensures tokens are only used for their intended purpose.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
None. Clean implementation of a constants dictionary.
