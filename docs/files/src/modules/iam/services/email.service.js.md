# File Documentation

File:
`src/modules/iam/services/email.service.js`

Domain:
Identity and Access Management (IAM)

Layer:
Domain Service Layer

Runtime Role:
Compiles domain-specific email templates (password resets, verifications) and delegates network transmission to the infrastructure mailer.

Dependencies:

- `transport`, `sendEmail` from `src/infrastructure/mailer.js`

---

# 2. PURPOSE

While `mailer.js` knows _how_ to send an email over SMTP, it shouldn't know _what_ an email says. This file separates the domain logic (the text, the subjects, the frontend URL construction) from the infrastructure logic.

This separation makes it trivial to swap out email templates, support internationalization (i18n), or change frontend domains without touching the core networking code.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Constructs the raw text and URLs for "Reset Password" emails.
- Constructs the raw text and URLs for "Verify Email" emails.
- Calls `sendEmail()` to dispatch the constructed payloads.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `sendEmail`

Used for:

- Actually pushing the compiled strings over the network.
  Coupling Level: HIGH.

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `sendResetPasswordEmail`, `sendVerificationEmail`

Called by:

- `src/modules/iam/controllers/auth.controller.js` (during `forgotPassword` and `sendVerificationEmail` routes).

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow: `sendResetPasswordEmail`

1. Receives the target `to` address and the previously generated `token`.
2. Hardcodes the subject.
3. Constructs the frontend URL using string interpolation (e.g., `http://link-to-app/reset-password?token=XYZ`).
4. Constructs the email body text.
5. Invokes `await sendEmail(to, subject, text)`.

---

# 7. IMPORTANT CODE EXAMPLES

## Frontend Coupling

```javascript
// replace this url with the link to the reset password page of your front-end app
const resetPasswordUrl = `http://link-to-app/reset-password?token=${token}`;
```

**Why this matters:**
This is currently hardcoded and tightly coupled to the frontend domain layout. In a true enterprise environment, the base URL (`http://link-to-app`) must be extracted to `config.js` so it can vary between Development, Staging, and Production environments without code changes.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/iam/controllers/auth.controller.js`

Responsibility: Transport.
Relationship: The controller calls `tokenService.generateResetPasswordToken()`, waits for the string, and passes it directly to this service.

---

# 9. DATABASE INTERACTIONS

None.

---

# 10. AUTHORIZATION & SECURITY

Security Boundary:
Ensures tokens are correctly appended to the URL. The actual tokens are generated upstream.

---

# 11. VALIDATION FLOW

None.

---

# 12. LOGGING & OBSERVABILITY

None. (Delegated to `mailer.js`).

---

# 13. ARCHITECTURAL RISKS

### Synchronous Execution

As mentioned in `mailer.js`, this function is `await`-ed directly in the Express request lifecycle. If SMTP is slow, the HTTP request hangs.

### Hardcoded URLs

The frontend URL is hardcoded in the string, which will break in production unless modified.

---

# 14. EXTENSION POINTS

- **HTML Templates**: This currently only sends plain text. It should be extended to use a templating engine (like Handlebars or EJS) to compile rich HTML emails.
- **Configurable Domains**: Move `http://link-to-app` into `.env` (e.g., `FRONTEND_URL`).

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- User Communication: The primary vector for the system to asynchronously communicate credentials to the user.

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW

Scalability:
LOW (Due to synchronous `await` over network I/O).

Primary Concern:
Hardcoded frontend URLs need to be extracted to configuration immediately.
