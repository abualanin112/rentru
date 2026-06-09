# File Documentation

File:
`src/infrastructure/mailer.js`

Domain:
Infrastructure / Communications

Layer:
External Integration

Runtime Role:
SMTP client wrapper for dispatching outbound emails (e.g., password resets, verifications).

Dependencies:

- `nodemailer`
- `config.js`
- `logger.js`

---

# 2. PURPOSE

This file abstracts the complexities of the Node.js `nodemailer` library. It provides a simple, clean, Promise-based API (`sendEmail`) for the rest of the application to use without needing to know the underlying SMTP configuration, hostnames, or authentication strategies.

---

# 3. RUNTIME RESPONSIBILITIES

Runtime Responsibilities:

- Instantiates a persistent SMTP connection pool using `nodemailer`.
- During application boot (in non-test environments), it actively pings the SMTP server (`transport.verify()`) to ensure credentials are valid, logging the success or failure.
- Provides a generic wrapper function to dispatch outbound emails using the configured `EMAIL_FROM` address.

---

# 4. IMPORT ANALYSIS

## Important Imports

### `nodemailer`

Used for:

- Connecting to external SMTP relays (like SendGrid, Mailgun, or AWS SES) and compiling emails.

### `config.js`

Used for:

- Fetching SMTP credentials and the default Sender address.

---

# 5. EXPORT ANALYSIS

## Exported Functions

### `export { transport, sendEmail }`

`sendEmail` is the primary interface used by domain services.
`transport` is exported primarily for unit/integration testing mocks.

Called by:

- `src/modules/iam/services/email.service.js`

---

# 6. INTERNAL EXECUTION FLOW

## Execution Flow

1. Evaluates SMTP configuration and creates a `transport`.
2. Asynchronously attempts to verify the SMTP connection.
   - On success: Logs `system.email.connected`.
   - On failure: Logs a warning (does not crash the process).
3. When `sendEmail(to, subject, text)` is invoked:
   - Constructs a standardized Nodemailer message object.
   - Pushes the message over the active SMTP TCP connection.
   - Resolves or rejects based on the network response.

---

# 7. IMPORTANT CODE EXAMPLES

## Startup Verification

```javascript
/* istanbul ignore next */
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info({ event: 'system.email.connected' }, 'Connected to email server'))
    .catch(() =>
      logger.warn(
        { event: 'system.email.connection_failed' },
        'Unable to connect to email server. Make sure you have configured the SMTP options in .env',
      ),
    );
}
```

**Why this matters:**
Fail-fast principle. If SMTP credentials have expired, Ops will see this warning in the logs exactly when the pod boots up, rather than finding out days later when a user complains that password reset emails aren't arriving. Notice it does _not_ throw an error; an ERP system shouldn't crash entirely just because the email relay is temporarily down.

---

# 8. CROSS-FILE RELATIONSHIPS

### `src/modules/iam/services/email.service.js`

Responsibility: IAM Email domain logic.
Relationship: The IAM email service takes domain-specific actions (like compiling an HTML template for a "Reset Password" flow) and then delegates the actual network dispatch to this file.

---

# 9. DATABASE INTERACTIONS

None.

---

# 10. AUTHORIZATION & SECURITY

Security Risk:
SMTP credentials stored in memory. As long as `config.js` secures the environment variables, this file is safe.

---

# 11. VALIDATION FLOW

Relies on `nodemailer`'s internal validation for email formatting.

---

# 12. LOGGING & OBSERVABILITY

- Logs connection status on boot.
- Does _not_ log outbound email contents (which would be a major PII leak).

---

# 13. ARCHITECTURAL RISKS

### Synchronous Network Blocking

The `sendEmail` function is currently `await`-ed directly within HTTP request lifecycles (via the `email.service.js`). Since SMTP negotiation can take 1-3 seconds, this will severely degrade API response times for routes that trigger emails.

---

# 14. EXTENSION POINTS

- **Queue Integration**: To fix the synchronous blocking risk mentioned above, `sendEmail` should eventually be rewritten to push a payload onto a Redis queue (e.g., BullMQ) rather than executing `transport.sendMail` inline.

---

# 15. ERP BUSINESS IMPACT

This file participates in:

- User Lifecycle: Enables user onboarding (verification) and recovery (password resets).

---

# 16. FINAL ENGINEERING ASSESSMENT

Maintainability:
HIGH

Coupling:
LOW (Cleanly hides `nodemailer` details).

Scalability:
LOW (Executing SMTP requests inline during HTTP routes does not scale well).

Primary Concern:
Inline SMTP requests. Should be offloaded to a background worker as the user base grows.
