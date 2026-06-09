# File Documentation

File:
`src/shared/Password.js`

Domain:
Shared Utilities

Layer:
Cryptographic / Security Utility

Runtime Role:
Abstracts the `bcryptjs` hashing algorithm, exposing centralized `hashPassword` and `comparePassword` functions.

Dependencies:

- `bcryptjs`

---

# 2. PURPOSE

If the application ever needs to migrate from `bcrypt` to `argon2` (a more modern, memory-hard hashing algorithm), it would be disastrous if `bcrypt` was imported directly into the `user.service.js`, `auth.service.js`, and seed scripts.

By abstracting the hashing algorithm into this shared utility, the underlying cryptographic library can be swapped out system-wide by changing exactly two functions.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- `hashPassword`: Salting and hashing a plaintext string.
- `comparePassword`: Securely comparing a plaintext string against a stored hash to mitigate timing attacks.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `bcryptjs`

Used for:

- Core cryptographic execution.
  Coupling Level: HIGH (But isolated to this file).

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `hashPassword`, `comparePassword`

Called by:

- `src/modules/iam/services/user.service.js` (for registration/updates)
- `src/modules/iam/services/auth.service.js` (for login verification)

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `hashPassword`

1. Receives plaintext `password`.
2. Calls `bcrypt.hash(password, 8)`.
   - The `8` is the "cost factor" (salt rounds).
   - Bcrypt automatically generates a cryptographic salt, appends it to the password, runs the Blowfish cipher 2^8 (256) times, and returns the combined salt+hash string.

---

# 7. IMPORTANT CODE EXAMPLES

## Cost Factor Tuning

```javascript
const hashPassword = async (password) => {
  return bcrypt.hash(password, 8);
};
```

**Why this matters:**
The cost factor (`8`) dictates how much CPU time is required to hash the password. A higher number makes it exponentially harder for an attacker to crack stolen hashes via brute force, but it also slows down the login endpoint, making the API vulnerable to CPU exhaustion DoS attacks. `8` is generally considered the absolute minimum acceptable standard for modern web applications. (Note: standard bcrypt defaults to `10`).

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/iam/services/user.service.js`

Responsibility: Hashing before database insertion.
Relationship: The service blindly trusts this utility to provide secure strings.

---

# 9. DATABASE INTERACTIONS

None directly, but the output is exactly what gets written to the database.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
This is the core of the credential protection mechanism.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

None.

---

# 13. ARCHITECTURAL RISKS

### Insufficient Cost Factor

The cost factor of `8` is currently hardcoded and relatively low. Enterprise systems typically use `10` or `12`. Furthermore, the cost factor is not pulled from `config.js`. If hardware becomes faster over the next 5 years, the cost factor should be easily tunable via an environment variable rather than requiring a code change.

---

# 14. EXTENSION POINTS

- **Argon2 Migration**: Replace `bcryptjs` with `argon2` to increase memory-hardness and defend against GPU cracking clusters.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- Credential Security: Protects the literal passwords of the entire userbase.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
HIGH

Primary Concern:
The hardcoded cost factor of `8` should be elevated to a config variable and increased.
